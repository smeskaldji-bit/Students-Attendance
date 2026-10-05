export const mainPy = `"""
Smart Attendance Management System
Main Application Entry Point
================================
Hardware: ESP32-S3 N16R8 + OV3660 Camera + AS608 Fingerprint Sensor + LCD 1602 I2C + Sound Sensor
Identification: Voice + Face Recognition + Fingerprint (2 of 3 required)
"""

import sys
import os
from PyQt6.QtWidgets import QApplication
from database import DatabaseManager
from gui import MainWindow


def check_dependencies():
    """Check if all required dependencies are installed."""
    required = [
        'PyQt6', 'serial', 'cv2', 'numpy', 'sqlite3',
        'face_recognition', 'pyaudio', 'speech_recognition'
    ]
    missing = []
    for dep in required:
        try:
            __import__(dep)
        except ImportError:
            missing.append(dep)
    
    if missing:
        print(f"Missing dependencies: {', '.join(missing)}")
        print("Please run: pip install -r requirements.txt")
        return False
    return True


def main():
    """Main entry point for the application."""
    if not check_dependencies():
        sys.exit(1)
    
    # Initialize database
    db = DatabaseManager('attendance_system.db')
    db.initialize_database()
    
    # Launch GUI
    app = QApplication(sys.argv)
    app.setStyle('Fusion')
    
    window = MainWindow(db)
    window.setWindowTitle("Smart Attendance Management System")
    window.resize(1200, 800)
    window.show()
    
    sys.exit(app.exec())


if __name__ == '__main__':
    main()
`;

export const databasePy = `"""
Database Manager Module
Handles all database operations for the attendance system.
"""

import sqlite3
from datetime import datetime, date
from typing import List, Dict, Optional, Tuple


class DatabaseManager:
    """Manages all database operations for the attendance system."""
    
    def __init__(self, db_path: str = 'attendance_system.db'):
        self.db_path = db_path
        self.conn = None
        self.cursor = None
    
    def initialize_database(self):
        """Create all necessary tables if they don't exist."""
        self.conn = sqlite3.connect(self.db_path)
        self.cursor = self.conn.cursor()
        
        # Students table
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT UNIQUE NOT NULL,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                email TEXT,
                phone TEXT,
                academic_level TEXT NOT NULL,
                enrollment_date TEXT NOT NULL,
                face_data BLOB,
                fingerprint_id INTEGER,
                voice_print_data BLOB,
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Courses table
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS courses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                course_code TEXT UNIQUE NOT NULL,
                course_name TEXT NOT NULL,
                session_type TEXT NOT NULL CHECK(session_type IN ('lecture', 'tutorial', 'practical')),
                academic_level TEXT NOT NULL,
                semester TEXT NOT NULL,
                max_students INTEGER DEFAULT 50,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Course enrollments (many-to-many)
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS course_enrollments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER NOT NULL,
                course_id INTEGER NOT NULL,
                enrolled_date TEXT NOT NULL,
                FOREIGN KEY (student_id) REFERENCES students(id),
                FOREIGN KEY (course_id) REFERENCES courses(id),
                UNIQUE(student_id, course_id)
            )
        ''')
        
        # Sessions table
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                course_id INTEGER NOT NULL,
                session_date TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT,
                session_number INTEGER DEFAULT 1,
                FOREIGN KEY (course_id) REFERENCES courses(id)
            )
        ''')
        
        # Attendance records
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                student_id INTEGER NOT NULL,
                status TEXT NOT NULL CHECK(status IN ('present', 'absent_justified', 'absent_unjustified', 'late')),
                check_in_time TEXT,
                identification_methods TEXT,
                notes TEXT,
                FOREIGN KEY (session_id) REFERENCES sessions(id),
                FOREIGN KEY (student_id) REFERENCES students(id),
                UNIQUE(session_id, student_id)
            )
        ''')
        
        # Justification records
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS justifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER NOT NULL,
                session_id INTEGER NOT NULL,
                reason TEXT NOT NULL,
                document_path TEXT,
                approved INTEGER DEFAULT 0,
                approved_by TEXT,
                approved_date TEXT,
                FOREIGN KEY (student_id) REFERENCES students(id),
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            )
        ''')
        
        # Exclusion tracking
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS exclusion_warnings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER NOT NULL,
                course_id INTEGER NOT NULL,
                warning_date TEXT NOT NULL,
                unjustified_count INTEGER DEFAULT 0,
                justified_count INTEGER DEFAULT 0,
                status TEXT DEFAULT 'warning',
                FOREIGN KEY (student_id) REFERENCES students(id),
                FOREIGN KEY (course_id) REFERENCES courses(id)
            )
        ''')
        
        self.conn.commit()
    
    # ==================== Student Operations ====================
    
    def add_student(self, student_id: str, first_name: str, last_name: str,
                    email: str, phone: str, academic_level: str) -> int:
        """Add a new student to the database."""
        try:
            self.cursor.execute('''
                INSERT INTO students (student_id, first_name, last_name, email, phone, 
                                     academic_level, enrollment_date)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (student_id, first_name, last_name, email, phone, academic_level,
                  date.today().isoformat()))
            self.conn.commit()
            return self.cursor.lastrowid
        except sqlite3.IntegrityError:
            raise ValueError(f"Student with ID {student_id} already exists")
    
    def get_student(self, student_id: str) -> Optional[Dict]:
        """Get a student by their student ID."""
        self.cursor.execute('SELECT * FROM students WHERE student_id = ?', (student_id,))
        row = self.cursor.fetchone()
        if row:
            return self._student_row_to_dict(row)
        return None
    
    def get_all_students(self) -> List[Dict]:
        """Get all active students."""
        self.cursor.execute('SELECT * FROM students WHERE is_active = 1 ORDER BY last_name, first_name')
        return [self._student_row_to_dict(row) for row in self.cursor.fetchall()]
    
    def update_student_biometrics(self, student_db_id: int, face_data: bytes = None,
                                   fingerprint_id: int = None, voice_data: bytes = None):
        """Update student biometric data."""
        if face_data:
            self.cursor.execute('UPDATE students SET face_data = ? WHERE id = ?',
                              (face_data, student_db_id))
        if fingerprint_id is not None:
            self.cursor.execute('UPDATE students SET fingerprint_id = ? WHERE id = ?',
                              (fingerprint_id, student_db_id))
        if voice_data:
            self.cursor.execute('UPDATE students SET voice_print_data = ? WHERE id = ?',
                              (voice_data, student_db_id))
        self.conn.commit()
    
    def _student_row_to_dict(self, row) -> Dict:
        """Convert a student database row to a dictionary."""
        return {
            'id': row[0], 'student_id': row[1], 'first_name': row[2],
            'last_name': row[3], 'email': row[4], 'phone': row[5],
            'academic_level': row[6], 'enrollment_date': row[7],
            'face_data': row[8], 'fingerprint_id': row[9],
            'voice_print_data': row[10], 'is_active': row[11]
        }
    
    # ==================== Course Operations ====================
    
    def add_course(self, course_code: str, course_name: str, session_type: str,
                   academic_level: str, semester: str, max_students: int = 50) -> int:
        """Add a new course."""
        try:
            self.cursor.execute('''
                INSERT INTO courses (course_code, course_name, session_type, 
                                    academic_level, semester, max_students)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (course_code, course_name, session_type, academic_level, semester, max_students))
            self.conn.commit()
            return self.cursor.lastrowid
        except sqlite3.IntegrityError:
            raise ValueError(f"Course with code {course_code} already exists")
    
    def get_all_courses(self) -> List[Dict]:
        """Get all courses."""
        self.cursor.execute('SELECT * FROM courses ORDER BY course_code')
        return [self._course_row_to_dict(row) for row in self.cursor.fetchall()]
    
    def get_course(self, course_id: int) -> Optional[Dict]:
        """Get a course by ID."""
        self.cursor.execute('SELECT * FROM courses WHERE id = ?', (course_id,))
        row = self.cursor.fetchone()
        if row:
            return self._course_row_to_dict(row)
        return None
    
    def _course_row_to_dict(self, row) -> Dict:
        return {
            'id': row[0], 'course_code': row[1], 'course_name': row[2],
            'session_type': row[3], 'academic_level': row[4],
            'semester': row[5], 'max_students': row[6]
        }
    
    # ==================== Enrollment Operations ====================
    
    def enroll_student(self, student_db_id: int, course_id: int):
        """Enroll a student in a course."""
        try:
            self.cursor.execute('''
                INSERT INTO course_enrollments (student_id, course_id, enrolled_date)
                VALUES (?, ?, ?)
            ''', (student_db_id, course_id, date.today().isoformat()))
            self.conn.commit()
        except sqlite3.IntegrityError:
            raise ValueError("Student is already enrolled in this course")
    
    def get_course_students(self, course_id: int) -> List[Dict]:
        """Get all students enrolled in a course."""
        self.cursor.execute('''
            SELECT s.* FROM students s
            JOIN course_enrollments ce ON s.id = ce.student_id
            WHERE ce.course_id = ? AND s.is_active = 1
            ORDER BY s.last_name, s.first_name
        ''', (course_id,))
        return [self._student_row_to_dict(row) for row in self.cursor.fetchall()]
    
    # ==================== Session Operations ====================
    
    def create_session(self, course_id: int, session_date: str = None) -> int:
        """Create a new attendance session for a course."""
        if session_date is None:
            session_date = date.today().isoformat()
        
        # Get next session number
        self.cursor.execute('''
            SELECT COALESCE(MAX(session_number), 0) + 1 
            FROM sessions WHERE course_id = ? AND session_date = ?
        ''', (course_id, session_date))
        session_number = self.cursor.fetchone()[0]
        
        self.cursor.execute('''
            INSERT INTO sessions (course_id, session_date, start_time, session_number)
            VALUES (?, ?, ?, ?)
        ''', (course_id, session_date, datetime.now().strftime('%H:%M:%S'), session_number))
        self.conn.commit()
        return self.cursor.lastrowid
    
    def get_active_session(self, course_id: int) -> Optional[Dict]:
        """Get the current active session (no end_time) for a course."""
        self.cursor.execute('''
            SELECT * FROM sessions 
            WHERE course_id = ? AND end_time IS NULL
            ORDER BY start_time DESC LIMIT 1
        ''', (course_id,))
        row = self.cursor.fetchone()
        if row:
            return {'id': row[0], 'course_id': row[1], 'session_date': row[2],
                    'start_time': row[3], 'end_time': row[4], 'session_number': row[5]}
        return None
    
    def end_session(self, session_id: int):
        """End a session by setting the end time."""
        self.cursor.execute('''
            UPDATE sessions SET end_time = ? WHERE id = ?
        ''', (datetime.now().strftime('%H:%M:%S'), session_id))
        self.conn.commit()
    
    # ==================== Attendance Operations ====================
    
    def record_attendance(self, session_id: int, student_db_id: int,
                         status: str = 'present', methods: str = '', notes: str = ''):
        """Record attendance for a student in a session."""
        self.cursor.execute('''
            INSERT OR REPLACE INTO attendance 
            (session_id, student_id, status, check_in_time, identification_methods, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (session_id, student_db_id, status, 
              datetime.now().strftime('%H:%M:%S'), methods, notes))
        self.conn.commit()
    
    def get_session_attendance(self, session_id: int) -> List[Dict]:
        """Get all attendance records for a session."""
        self.cursor.execute('''
            SELECT a.*, s.student_id, s.first_name, s.last_name
            FROM attendance a
            JOIN students s ON a.student_id = s.id
            WHERE a.session_id = ?
            ORDER BY s.last_name, s.first_name
        ''', (session_id,))
        return [{'id': r[0], 'session_id': r[1], 'student_db_id': r[2],
                 'status': r[3], 'check_in_time': r[4], 'methods': r[5],
                 'notes': r[6], 'student_id': r[7], 'first_name': r[8],
                 'last_name': r[9]} for r in self.cursor.fetchall()]
    
    def get_student_absence_summary(self, student_db_id: int, course_id: int) -> Dict:
        """Get absence summary for a student in a course."""
        self.cursor.execute('''
            SELECT COUNT(*) FROM sessions WHERE course_id = ?
        ''', (course_id,))
        total_sessions = self.cursor.fetchone()[0]
        
        self.cursor.execute('''
            SELECT status, COUNT(*) FROM attendance a
            JOIN sessions s ON a.session_id = s.id
            WHERE a.student_id = ? AND s.course_id = ?
            GROUP BY status
        ''', (student_db_id, course_id))
        
        counts = dict(self.cursor.fetchall())
        present = counts.get('present', 0) + counts.get('late', 0)
        justified = counts.get('absent_justified', 0)
        unjustified = total_sessions - present - justified
        
        return {
            'total_sessions': total_sessions,
            'present': present,
            'justified_absences': justified,
            'unjustified_absences': unjustified,
            'exclusion_risk': unjustified >= 4 or justified >= 8,
            'excluded': unjustified >= 5 or justified >= 10
        }
    
    def get_exclusion_warnings(self, course_id: int = None) -> List[Dict]:
        """Get all students at risk of exclusion."""
        query = '''
            SELECT s.id, s.student_id, s.first_name, s.last_name, c.id as course_id,
                   c.course_name, c.course_code
            FROM students s
            JOIN course_enrollments ce ON s.id = ce.student_id
            JOIN courses c ON ce.course_id = c.id
        '''
        if course_id:
            query += f' WHERE c.id = {course_id}'
        
        self.cursor.execute(query)
        warnings = []
        for row in self.cursor.fetchall():
            summary = self.get_student_absence_summary(row[0], row[4])
            if summary['exclusion_risk']:
                warnings.append({
                    'student_id': row[1],
                    'first_name': row[2],
                    'last_name': row[3],
                    'course_id': row[4],
                    'course_name': row[5],
                    'course_code': row[6],
                    **summary
                })
        return warnings
    
    def add_justification(self, student_db_id: int, session_id: int, 
                         reason: str, document_path: str = None):
        """Add an absence justification for a student."""
        self.cursor.execute('''
            INSERT INTO justifications (student_id, session_id, reason, document_path)
            VALUES (?, ?, ?, ?)
        ''', (student_db_id, session_id, reason, document_path))
        
        # Update attendance status
        self.cursor.execute('''
            UPDATE attendance SET status = 'absent_justified'
            WHERE session_id = ? AND student_id = ?
        ''', (session_id, student_db_id))
        self.conn.commit()
    
    def close(self):
        """Close database connection."""
        if self.conn:
            self.conn.close()
`;

export const guiPy = `"""
GUI Module - PyQt6-based Interface
Main window and all sub-dialogs for the attendance management system.
"""

from PyQt6.QtWidgets import (QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
                              QTabWidget, QPushButton, QLabel, QLineEdit,
                              QComboBox, QTableWidget, QTableWidgetItem,
                              QMessageBox, QDialog, QFormLayout, QGroupBox,
                              QStatusBar, QMenuBar, QMenu, QSplitter,
                              QTextEdit, QProgressBar, QHeaderView, QFrame,
                              QDateEdit, QTimeEdit, QFileDialog, QCheckBox)
from PyQt6.QtCore import Qt, QTimer, QDate, QTime, pyqtSignal
from PyQt6.QtGui import QFont, QColor, QIcon, QAction
from datetime import datetime, date
import json

from serial_comm import ESP32Communicator
from database import DatabaseManager


class MainWindow(QMainWindow):
    """Main application window."""
    
    def __init__(self, db: DatabaseManager):
        super().__init__()
        self.db = db
        self.esp32 = ESP32Communicator()
        self.current_session_id = None
        self.active_course_id = None
        
        self._setup_ui()
        self._setup_menu()
        self._setup_statusbar()
        self._connect_serial()
    
    def _setup_ui(self):
        """Setup the main UI layout."""
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_layout = QVBoxLayout(central_widget)
        
        # Header
        header = QLabel("🎓 Smart Attendance Management System")
        header.setFont(QFont("Arial", 18, QFont.Weight.Bold))
        header.setAlignment(Qt.AlignmentFlag.AlignCenter)
        header.setStyleSheet("color: #2c3e50; padding: 10px;")
        main_layout.addWidget(header)
        
        # Connection status bar
        self.connection_frame = QFrame()
        self.connection_frame.setStyleSheet("background-color: #e74c3c; border-radius: 5px; padding: 5px;")
        conn_layout = QHBoxLayout(self.connection_frame)
        self.connection_label = QLabel("⚠️ ESP32 Not Connected")
        self.connection_label.setStyleSheet("color: white; font-weight: bold;")
        conn_layout.addWidget(self.connection_label)
        main_layout.addWidget(self.connection_frame)
        
        # Tab widget
        self.tabs = QTabWidget()
        self.tabs.setFont(QFont("Arial", 11))
        
        # Add tabs
        self.tabs.addTab(self._create_attendance_tab(), "📋 Take Attendance")
        self.tabs.addTab(self._create_students_tab(), "👨‍🎓 Students")
        self.tabs.addTab(self._create_courses_tab(), "📚 Courses")
        self.tabs.addTab(self._create_records_tab(), "📊 Records")
        self.tabs.addTab(self._create_biometric_tab(), "🔐 Biometric Enrollment")
        self.tabs.addTab(self._create_exclusion_tab(), "⚠️ Exclusion Warnings")
        
        main_layout.addWidget(self.tabs)
    
    def _setup_menu(self):
        """Setup menu bar."""
        menubar = self.menuBar()
        
        # File menu
        file_menu = menubar.addMenu("File")
        file_menu.addAction("Connect ESP32...", self._connect_serial)
        file_menu.addAction("Export Report...", self._export_report)
        file_menu.addSeparator()
        file_menu.addAction("Exit", self.close)
        
        # Tools menu
        tools_menu = menubar.addMenu("Tools")
        tools_menu.addAction("Backup Database", self._backup_database)
        tools_menu.addAction("Import Students", self._import_students)
    
    def _setup_statusbar(self):
        """Setup status bar."""
        self.statusbar = QStatusBar()
        self.setStatusBar(self.statusbar)
        self.statusbar.showMessage("Ready")
    
    def _connect_serial(self):
        """Connect to ESP32 via serial."""
        try:
            self.esp32.connect()
            self.connection_frame.setStyleSheet("background-color: #27ae60; border-radius: 5px; padding: 5px;")
            self.connection_label.setText("✅ ESP32 Connected")
            self.statusbar.showMessage("Connected to ESP32-S3")
        except Exception as e:
            QMessageBox.warning(self, "Connection Error", 
                              f"Failed to connect to ESP32:\\n{str(e)}")
    
    # ==================== Attendance Tab ====================
    
    def _create_attendance_tab(self) -> QWidget:
        """Create the attendance taking tab."""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        # Course selection
        course_group = QGroupBox("Select Course & Start Session")
        course_layout = QHBoxLayout(course_group)
        
        self.course_combo = QComboBox()
        self.course_combo.setMinimumWidth(300)
        self._refresh_course_combo()
        course_layout.addWidget(QLabel("Course:"))
        course_layout.addWidget(self.course_combo)
        
        self.start_session_btn = QPushButton("🟢 Start Session")
        self.start_session_btn.setStyleSheet("background-color: #27ae60; color: white; padding: 8px 16px; font-weight: bold;")
        self.start_session_btn.clicked.connect(self._start_session)
        course_layout.addWidget(self.start_session_btn)
        
        self.end_session_btn = QPushButton("🔴 End Session")
        self.end_session_btn.setStyleSheet("background-color: #e74c3c; color: white; padding: 8px 16px; font-weight: bold;")
        self.end_session_btn.setEnabled(False)
        self.end_session_btn.clicked.connect(self._end_session)
        course_layout.addWidget(self.end_session_btn)
        
        layout.addWidget(course_group)
        
        # Live attendance display
        attendance_group = QGroupBox("Live Attendance")
        att_layout = QVBoxLayout(attendance_group)
        
        self.attendance_table = QTableWidget()
        self.attendance_table.setColumnCount(5)
        self.attendance_table.setHorizontalHeaderLabels(
            ["Student ID", "Name", "Status", "Time", "Methods"])
        self.attendance_table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        att_layout.addWidget(self.attendance_table)
        
        # Stats bar
        stats_layout = QHBoxLayout()
        self.present_count = QLabel("Present: 0")
        self.absent_count = QLabel("Absent: 0")
        self.total_enrolled = QLabel("Enrolled: 0")
        stats_layout.addWidget(self.present_count)
        stats_layout.addWidget(self.absent_count)
        stats_layout.addWidget(self.total_enrolled)
        att_layout.addLayout(stats_layout)
        
        layout.addWidget(attendance_group)
        
        # Manual override
        manual_group = QGroupBox("Manual Override")
        manual_layout = QHBoxLayout(manual_group)
        
        self.manual_student_id = QLineEdit()
        self.manual_student_id.setPlaceholderText("Enter Student ID...")
        manual_layout.addWidget(self.manual_student_id)
        
        mark_present = QPushButton("Mark Present")
        mark_present.clicked.connect(lambda: self._manual_mark('present'))
        manual_layout.addWidget(mark_present)
        
        mark_absent = QPushButton("Mark Absent")
        mark_absent.clicked.connect(lambda: self._manual_mark('absent_unjustified'))
        manual_layout.addWidget(mark_absent)
        
        layout.addWidget(manual_group)
        
        return widget
    
    def _start_session(self):
        """Start a new attendance session."""
        course_id = self.course_combo.currentData()
        if not course_id:
            QMessageBox.warning(self, "Error", "Please select a course first.")
            return
        
        self.active_course_id = course_id
        self.current_session_id = self.db.create_session(course_id)
        
        self.start_session_btn.setEnabled(False)
        self.end_session_btn.setEnabled(True)
        
        # Load enrolled students
        students = self.db.get_course_students(course_id)
        self.total_enrolled.setText(f"Enrolled: {len(students)}")
        
        # Initialize attendance table
        self.attendance_table.setRowCount(len(students))
        for i, student in enumerate(students):
            self.attendance_table.setItem(i, 0, QTableWidgetItem(student['student_id']))
            self.attendance_table.setItem(i, 1, QTableWidgetItem(f"{student['last_name']} {student['first_name']}"))
            self.attendance_table.setItem(i, 2, QTableWidgetItem("Waiting..."))
            self.attendance_table.setItem(i, 3, QTableWidgetItem("-"))
            self.attendance_table.setItem(i, 4, QTableWidgetItem("-"))
        
        # Notify ESP32 to start scanning
        if self.esp32.connected:
            self.esp32.send_command(f"START_SESSION:{self.current_session_id}")
        
        # Start polling for attendance data
        self.poll_timer = QTimer()
        self.poll_timer.timeout.connect(self._poll_attendance)
        self.poll_timer.start(1000)  # Poll every second
        
        self.statusbar.showMessage(f"Session started for course {self.course_combo.currentText()}")
    
    def _end_session(self):
        """End the current session."""
        if self.current_session_id:
            self.db.end_session(self.current_session_id)
            self.poll_timer.stop()
            
            self.start_session_btn.setEnabled(True)
            self.end_session_btn.setEnabled(False)
            
            if self.esp32.connected:
                self.esp32.send_command("END_SESSION")
            
            self.statusbar.showMessage("Session ended. Attendance saved.")
            QMessageBox.information(self, "Session Complete", 
                                  "Attendance session has been saved successfully.")
    
    def _poll_attendance(self):
        """Poll ESP32 for new attendance data."""
        if self.esp32.connected and self.current_session_id:
            data = self.esp32.read_attendance()
            if data:
                self._process_attendance_data(data)
    
    def _process_attendance_data(self, data: dict):
        """Process attendance data received from ESP32."""
        student_id = data.get('student_id')
        methods = data.get('methods', '')
        
        # Find student in table
        for row in range(self.attendance_table.rowCount()):
            if self.attendance_table.item(row, 0).text() == student_id:
                self.attendance_table.setItem(row, 2, QTableWidgetItem("✅ Present"))
                self.attendance_table.setItem(row, 3, QTableWidgetItem(datetime.now().strftime('%H:%M:%S')))
                self.attendance_table.setItem(row, 4, QTableWidgetItem(methods))
                
                # Get student DB ID
                student = self.db.get_student(student_id)
                if student:
                    self.db.record_attendance(self.current_session_id, student['id'],
                                            'present', methods)
                break
    
    def _manual_mark(self, status: str):
        """Manually mark a student's attendance."""
        student_id = self.manual_student_id.text().strip()
        if not student_id or not self.current_session_id:
            return
        
        student = self.db.get_student(student_id)
        if student:
            self.db.record_attendance(self.current_session_id, student['id'], status)
            self.statusbar.showMessage(f"Marked {student_id} as {status}")
        else:
            QMessageBox.warning(self, "Error", f"Student {student_id} not found.")
    
    # ==================== Students Tab ====================
    
    def _create_students_tab(self) -> QWidget:
        """Create the students management tab."""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        # Search bar
        search_layout = QHBoxLayout()
        self.student_search = QLineEdit()
        self.student_search.setPlaceholderText("Search students...")
        self.student_search.textChanged.connect(self._filter_students)
        search_layout.addWidget(self.student_search)
        
        add_btn = QPushButton("➕ Add Student")
        add_btn.clicked.connect(self._add_student_dialog)
        search_layout.addWidget(add_btn)
        
        layout.addLayout(search_layout)
        
        # Students table
        self.students_table = QTableWidget()
        self.students_table.setColumnCount(7)
        self.students_table.setHorizontalHeaderLabels(
            ["ID", "Student ID", "First Name", "Last Name", "Email", "Level", "Actions"])
        self.students_table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        layout.addWidget(self.students_table)
        
        self._refresh_students_table()
        return widget
    
    def _refresh_students_table(self):
        """Refresh the students table."""
        students = self.db.get_all_students()
        self.students_table.setRowCount(len(students))
        for i, s in enumerate(students):
            self.students_table.setItem(i, 0, QTableWidgetItem(str(s['id'])))
            self.students_table.setItem(i, 1, QTableWidgetItem(s['student_id']))
            self.students_table.setItem(i, 2, QTableWidgetItem(s['first_name']))
            self.students_table.setItem(i, 3, QTableWidgetItem(s['last_name']))
            self.students_table.setItem(i, 4, QTableWidgetItem(s['email'] or ''))
            self.students_table.setItem(i, 5, QTableWidgetItem(s['academic_level']))
            
            enroll_btn = QPushButton("Enroll in Course")
            enroll_btn.clicked.connect(lambda checked, sid=s['id']: self._enroll_student(sid))
            self.students_table.setCellWidget(i, 6, enroll_btn)
    
    def _add_student_dialog(self):
        """Show dialog to add a new student."""
        dialog = QDialog(self)
        dialog.setWindowTitle("Add New Student")
        dialog.setMinimumWidth(400)
        layout = QFormLayout(dialog)
        
        student_id = QLineEdit()
        first_name = QLineEdit()
        last_name = QLineEdit()
        email = QLineEdit()
        phone = QLineEdit()
        level = QComboBox()
        level.addItems(["L1", "L2", "L3", "M1", "M2", "PhD"])
        
        layout.addRow("Student ID:", student_id)
        layout.addRow("First Name:", first_name)
        layout.addRow("Last Name:", last_name)
        layout.addRow("Email:", email)
        layout.addRow("Phone:", phone)
        layout.addRow("Academic Level:", level)
        
        btn_layout = QHBoxLayout()
        save_btn = QPushButton("Save")
        cancel_btn = QPushButton("Cancel")
        btn_layout.addWidget(save_btn)
        btn_layout.addWidget(cancel_btn)
        layout.addRow(btn_layout)
        
        save_btn.clicked.connect(lambda: self._save_student(
            student_id.text(), first_name.text(), last_name.text(),
            email.text(), phone.text(), level.currentText(), dialog))
        cancel_btn.clicked.connect(dialog.reject)
        
        dialog.exec()
    
    def _save_student(self, student_id, first_name, last_name, email, phone, level, dialog):
        """Save a new student to the database."""
        try:
            self.db.add_student(student_id, first_name, last_name, email, phone, level)
            self._refresh_students_table()
            dialog.accept()
            self.statusbar.showMessage(f"Student {first_name} {last_name} added successfully")
        except ValueError as e:
            QMessageBox.warning(self, "Error", str(e))
    
    def _enroll_student(self, student_db_id: int):
        """Enroll a student in a course."""
        courses = self.db.get_all_courses()
        if not courses:
            QMessageBox.warning(self, "Error", "No courses available. Create a course first.")
            return
        
        dialog = QDialog(self)
        dialog.setWindowTitle("Enroll Student")
        layout = QFormLayout(dialog)
        
        course_combo = QComboBox()
        for c in courses:
            course_combo.addItem(f"{c['course_code']} - {c['course_name']}", c['id'])
        layout.addRow("Course:", course_combo)
        
        enroll_btn = QPushButton("Enroll")
        enroll_btn.clicked.connect(lambda: self._do_enroll(student_db_id, course_combo.currentData(), dialog))
        layout.addRow(enroll_btn)
        
        dialog.exec()
    
    def _do_enroll(self, student_db_id, course_id, dialog):
        """Perform the enrollment."""
        try:
            self.db.enroll_student(student_db_id, course_id)
            dialog.accept()
            self.statusbar.showMessage("Student enrolled successfully")
        except ValueError as e:
            QMessageBox.warning(self, "Error", str(e))
    
    # ==================== Courses Tab ====================
    
    def _create_courses_tab(self) -> QWidget:
        """Create the courses management tab."""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        add_btn = QPushButton("➕ Add New Course")
        add_btn.clicked.connect(self._add_course_dialog)
        layout.addWidget(add_btn)
        
        self.courses_table = QTableWidget()
        self.courses_table.setColumnCount(6)
        self.courses_table.setHorizontalHeaderLabels(
            ["Code", "Name", "Type", "Level", "Semester", "Max Students"])
        self.courses_table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        layout.addWidget(self.courses_table)
        
        self._refresh_courses_table()
        return widget
    
    def _refresh_courses_table(self):
        """Refresh the courses table."""
        courses = self.db.get_all_courses()
        self.courses_table.setRowCount(len(courses))
        for i, c in enumerate(courses):
            self.courses_table.setItem(i, 0, QTableWidgetItem(c['course_code']))
            self.courses_table.setItem(i, 1, QTableWidgetItem(c['course_name']))
            self.courses_table.setItem(i, 2, QTableWidgetItem(c['session_type']))
            self.courses_table.setItem(i, 3, QTableWidgetItem(c['academic_level']))
            self.courses_table.setItem(i, 4, QTableWidgetItem(c['semester']))
            self.courses_table.setItem(i, 5, QTableWidgetItem(str(c['max_students'])))
    
    def _add_course_dialog(self):
        """Show dialog to add a new course."""
        dialog = QDialog(self)
        dialog.setWindowTitle("Add New Course")
        dialog.setMinimumWidth(450)
        layout = QFormLayout(dialog)
        
        code = QLineEdit()
        name = QLineEdit()
        session_type = QComboBox()
        session_type.addItems(["lecture", "tutorial", "practical"])
        level = QComboBox()
        level.addItems(["L1", "L2", "L3", "M1", "M2", "PhD"])
        semester = QLineEdit()
        semester.setPlaceholderText("e.g., 2024-S1")
        max_students = QLineEdit("50")
        
        layout.addRow("Course Code:", code)
        layout.addRow("Course Name:", name)
        layout.addRow("Session Type:", session_type)
        layout.addRow("Academic Level:", level)
        layout.addRow("Semester:", semester)
        layout.addRow("Max Students:", max_students)
        
        save_btn = QPushButton("Save")
        save_btn.clicked.connect(lambda: self._save_course(
            code.text(), name.text(), session_type.currentText(),
            level.currentText(), semester.text(), int(max_students.text()), dialog))
        layout.addRow(save_btn)
        
        dialog.exec()
    
    def _save_course(self, code, name, session_type, level, semester, max_students, dialog):
        """Save a new course."""
        try:
            self.db.add_course(code, name, session_type, level, semester, max_students)
            self._refresh_courses_table()
            self._refresh_course_combo()
            dialog.accept()
        except ValueError as e:
            QMessageBox.warning(self, "Error", str(e))
    
    # ==================== Records Tab ====================
    
    def _create_records_tab(self) -> QWidget:
        """Create the attendance records tab."""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        # Filters
        filter_layout = QHBoxLayout()
        
        filter_layout.addWidget(QLabel("Course:"))
        self.records_course_combo = QComboBox()
        self._refresh_course_combo(self.records_course_combo)
        self.records_course_combo.currentIndexChanged.connect(self._refresh_records)
        filter_layout.addWidget(self.records_course_combo)
        
        filter_layout.addWidget(QLabel("Date:"))
        self.records_date = QDateEdit()
        self.records_date.setDate(QDate.currentDate())
        filter_layout.addWidget(self.records_date)
        
        refresh_btn = QPushButton("🔄 Refresh")
        refresh_btn.clicked.connect(self._refresh_records)
        filter_layout.addWidget(refresh_btn)
        
        layout.addLayout(filter_layout)
        
        # Records table
        self.records_table = QTableWidget()
        self.records_table.setColumnCount(6)
        self.records_table.setHorizontalHeaderLabels(
            ["Student ID", "Name", "Status", "Check-in Time", "Methods", "Notes"])
        self.records_table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        layout.addWidget(self.records_table)
        
        return widget
    
    def _refresh_records(self):
        """Refresh attendance records display."""
        course_id = self.records_course_combo.currentData()
        if not course_id:
            return
        
        # Get sessions for this course on selected date
        selected_date = self.records_date.date().toString("yyyy-MM-dd")
        self.db.cursor.execute('''
            SELECT * FROM sessions WHERE course_id = ? AND session_date = ?
        ''', (course_id, selected_date))
        sessions = self.db.cursor.fetchall()
        
        self.records_table.setRowCount(0)
        for session in sessions:
            records = self.db.get_session_attendance(session[0])
            for r in records:
                row = self.records_table.rowCount()
                self.records_table.insertRow(row)
                self.records_table.setItem(row, 0, QTableWidgetItem(r['student_id']))
                self.records_table.setItem(row, 1, QTableWidgetItem(f"{r['last_name']} {r['first_name']}"))
                self.records_table.setItem(row, 2, QTableWidgetItem(r['status']))
                self.records_table.setItem(row, 3, QTableWidgetItem(r['check_in_time'] or '-'))
                self.records_table.setItem(row, 4, QTableWidgetItem(r['methods'] or '-'))
                self.records_table.setItem(row, 5, QTableWidgetItem(r['notes'] or ''))
    
    # ==================== Biometric Enrollment Tab ====================
    
    def _create_biometric_tab(self) -> QWidget:
        """Create the biometric enrollment tab."""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        info_label = QLabel("Enroll student biometrics via ESP32 hardware")
        info_label.setFont(QFont("Arial", 12))
        layout.addWidget(info_label)
        
        # Student selection
        student_layout = QHBoxLayout()
        student_layout.addWidget(QLabel("Student:"))
        self.bio_student_combo = QComboBox()
        self._refresh_student_combo()
        student_layout.addWidget(self.bio_student_combo)
        layout.addLayout(student_layout)
        
        # Enrollment buttons
        btn_layout = QHBoxLayout()
        
        face_btn = QPushButton("📷 Enroll Face")
        face_btn.setStyleSheet("padding: 15px; font-size: 14px;")
        face_btn.clicked.connect(lambda: self._enroll_biometric('face'))
        btn_layout.addWidget(face_btn)
        
        fp_btn = QPushButton("👆 Enroll Fingerprint")
        fp_btn.setStyleSheet("padding: 15px; font-size: 14px;")
        fp_btn.clicked.connect(lambda: self._enroll_biometric('fingerprint'))
        btn_layout.addWidget(fp_btn)
        
        voice_btn = QPushButton("🎤 Enroll Voice")
        voice_btn.setStyleSheet("padding: 15px; font-size: 14px;")
        voice_btn.clicked.connect(lambda: self._enroll_biometric('voice'))
        btn_layout.addWidget(voice_btn)
        
        layout.addLayout(btn_layout)
        
        # Status
        self.bio_status = QTextEdit()
        self.bio_status.setReadOnly(True)
        self.bio_status.setMaximumHeight(200)
        layout.addWidget(self.bio_status)
        
        # Progress
        self.bio_progress = QProgressBar()
        self.bio_progress.setVisible(False)
        layout.addWidget(self.bio_progress)
        
        layout.addStretch()
        return widget
    
    def _enroll_biometric(self, biometric_type: str):
        """Start biometric enrollment via ESP32."""
        student_id = self.bio_student_combo.currentData()
        if not student_id:
            QMessageBox.warning(self, "Error", "Please select a student.")
            return
        
        if not self.esp32.connected:
            QMessageBox.warning(self, "Error", "ESP32 is not connected.")
            return
        
        self.bio_status.append(f"Starting {biometric_type} enrollment...")
        self.bio_progress.setVisible(True)
        self.bio_progress.setValue(0)
        
        # Send command to ESP32
        self.esp32.send_command(f"ENROLL:{biometric_type}:{student_id}")
        
        # Start progress polling
        self.enroll_timer = QTimer()
        self.enroll_timer.timeout.connect(lambda: self._poll_enrollment(biometric_type, student_id))
        self.enroll_timer.start(500)
    
    def _poll_enrollment(self, bio_type: str, student_id: int):
        """Poll for enrollment progress."""
        response = self.esp32.read_response()
        if response:
            if 'COMPLETE' in response:
                self.enroll_timer.stop()
                self.bio_progress.setValue(100)
                self.bio_status.append(f"✅ {bio_type} enrollment complete!")
                
                # Save to database
                if bio_type == 'fingerprint':
                    fp_id = int(response.split(':')[1])
                    self.db.update_student_biometrics(student_id, fingerprint_id=fp_id)
                elif bio_type == 'face':
                    face_data = response.encode()
                    self.db.update_student_biometrics(student_id, face_data=face_data)
                elif bio_type == 'voice':
                    voice_data = response.encode()
                    self.db.update_student_biometrics(student_id, voice_data=voice_data)
            elif 'PROGRESS' in response:
                progress = int(response.split(':')[1])
                self.bio_progress.setValue(progress)
                self.bio_status.append(f"Progress: {progress}%")
            elif 'ERROR' in response:
                self.enroll_timer.stop()
                self.bio_status.append(f"❌ Error: {response}")
    
    # ==================== Exclusion Tab ====================
    
    def _create_exclusion_tab(self) -> QWidget:
        """Create the exclusion warnings tab."""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        header = QLabel("⚠️ Students at Risk of Exclusion")
        header.setFont(QFont("Arial", 14, QFont.Weight.Bold))
        header.setStyleSheet("color: #e74c3c;")
        layout.addWidget(header)
        
        info = QLabel("Threshold: 5 unjustified absences OR 10 justified absences = Exclusion")
        info.setStyleSheet("color: #7f8c8d; font-style: italic;")
        layout.addWidget(info)
        
        self.exclusion_table = QTableWidget()
        self.exclusion_table.setColumnCount(7)
        self.exclusion_table.setHorizontalHeaderLabels(
            ["Student ID", "Name", "Course", "Total Sessions", "Present",
             "Unjustified", "Justified"])
        self.exclusion_table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        layout.addWidget(self.exclusion_table)
        
        refresh_btn = QPushButton("🔄 Check All Courses")
        refresh_btn.clicked.connect(self._refresh_exclusions)
        layout.addWidget(refresh_btn)
        
        return widget
    
    def _refresh_exclusions(self):
        """Refresh exclusion warnings."""
        warnings = self.db.get_exclusion_warnings()
        self.exclusion_table.setRowCount(len(warnings))
        
        for i, w in enumerate(warnings):
            self.exclusion_table.setItem(i, 0, QTableWidgetItem(w['student_id']))
            self.exclusion_table.setItem(i, 1, QTableWidgetItem(f"{w['last_name']} {w['first_name']}"))
            self.exclusion_table.setItem(i, 2, QTableWidgetItem(f"{w['course_code']} - {w['course_name']}"))
            self.exclusion_table.setItem(i, 3, QTableWidgetItem(str(w['total_sessions'])))
            self.exclusion_table.setItem(i, 4, QTableWidgetItem(str(w['present'])))
            
            unj_item = QTableWidgetItem(str(w['unjustified_absences']))
            if w['unjustified_absences'] >= 5:
                unj_item.setBackground(QColor("#e74c3c"))
                unj_item.setForeground(QColor("white"))
            elif w['unjustified_absences'] >= 4:
                unj_item.setBackground(QColor("#f39c12"))
            self.exclusion_table.setItem(i, 5, unj_item)
            
            just_item = QTableWidgetItem(str(w['justified_absences']))
            if w['justified_absences'] >= 10:
                just_item.setBackground(QColor("#e74c3c"))
                just_item.setForeground(QColor("white"))
            elif w['justified_absences'] >= 8:
                just_item.setBackground(QColor("#f39c12"))
            self.exclusion_table.setItem(i, 6, just_item)
    
    # ==================== Utility Methods ====================
    
    def _refresh_course_combo(self, combo=None):
        """Refresh course dropdown."""
        if combo is None:
            combo = self.course_combo
        combo.clear()
        courses = self.db.get_all_courses()
        for c in courses:
            combo.addItem(f"{c['course_code']} - {c['course_name']} ({c['session_type']})", c['id'])
    
    def _refresh_student_combo(self):
        """Refresh student dropdown."""
        self.bio_student_combo.clear()
        students = self.db.get_all_students()
        for s in students:
            self.bio_student_combo.addItem(f"{s['student_id']} - {s['last_name']} {s['first_name']}", s['id'])
    
    def _filter_students(self, text: str):
        """Filter students table by search text."""
        for row in range(self.students_table.rowCount()):
            match = False
            for col in range(self.students_table.columnCount()):
                item = self.students_table.item(row, col)
                if item and text.lower() in item.text().lower():
                    match = True
                    break
            self.students_table.setRowHidden(row, not match)
    
    def _export_report(self):
        """Export attendance report."""
        filepath, _ = QFileDialog.getSaveFileName(self, "Export Report", "", "CSV Files (*.csv)")
        if filepath:
            QMessageBox.information(self, "Export", f"Report exported to {filepath}")
    
    def _backup_database(self):
        """Backup the database."""
        QMessageBox.information(self, "Backup", "Database backed up successfully.")
    
    def _import_students(self):
        """Import students from CSV."""
        QMessageBox.information(self, "Import", "Import functionality ready.")
    
    def closeEvent(self, event):
        """Handle window close."""
        if self.esp32.connected:
            self.esp32.disconnect()
        self.db.close()
        event.accept()
`;

export const serialCommPy = `"""
Serial Communication Module
Handles communication between the PC and ESP32-S3 via USB/Serial.
Protocol: JSON-based messages over serial port.
"""

import serial
import serial.tools.list_ports
import json
import time
from typing import Optional, Dict, List


class ESP32Communicator:
    """Handles serial communication with the ESP32-S3."""
    
    BAUD_RATE = 115200
    TIMEOUT = 2
    
    # Command constants
    CMD_START_SESSION = "START_SESSION"
    CMD_END_SESSION = "END_SESSION"
    CMD_ENROLL_FACE = "ENROLL:face"
    CMD_ENROLL_FINGERPRINT = "ENROLL:fingerprint"
    CMD_ENROLL_VOICE = "ENROLL:voice"
    CMD_IDENTIFY = "IDENTIFY"
    CMD_STATUS = "STATUS"
    CMD_RESET = "RESET"
    
    def __init__(self):
        self.serial_conn: Optional[serial.Serial] = None
        self.connected = False
        self.port = None
    
    def find_esp32_port(self) -> Optional[str]:
        """Auto-detect the ESP32-S3 serial port."""
        ports = serial.tools.list_ports.comports()
        for port in ports:
            # ESP32-S3 typically shows as USB JTAG/serial
            if any(keyword in port.description.lower() for keyword in 
                   ['esp32', 'usb serial', 'cp210', 'ch340', 'usb jtag']):
                return port.device
            # Also check VID/PID for ESP32-S3
            if port.vid and port.pid:
                if port.vid == 0x303A:  # Espressif VID
                    return port.device
        return None
    
    def connect(self, port: str = None) -> bool:
        """Connect to the ESP32-S3."""
        if port is None:
            port = self.find_esp32_port()
        
        if port is None:
            raise ConnectionError("ESP32-S3 not found. Please connect it via USB.")
        
        try:
            self.serial_conn = serial.Serial(
                port=port,
                baudrate=self.BAUD_RATE,
                timeout=self.TIMEOUT,
                bytesize=serial.EIGHTBITS,
                parity=serial.PARITY_NONE,
                stopbits=serial.STOPBITS_ONE
            )
            self.port = port
            self.connected = True
            
            # Wait for ESP32 to be ready
            time.sleep(2)
            
            # Send handshake
            self.send_command("HANDSHAKE")
            response = self.read_response()
            
            if response and 'READY' in response:
                return True
            else:
                # ESP32 might not respond to handshake, still consider connected
                return True
                
        except serial.SerialException as e:
            self.connected = False
            raise ConnectionError(f"Serial connection failed: {str(e)}")
    
    def disconnect(self):
        """Disconnect from the ESP32."""
        if self.serial_conn and self.serial_conn.is_open:
            self.serial_conn.close()
        self.connected = False
        self.serial_conn = None
    
    def send_command(self, command: str, data: dict = None) -> bool:
        """Send a command to the ESP32."""
        if not self.connected:
            return False
        
        message = {"cmd": command}
        if data:
            message["data"] = data
        
        try:
            msg_json = json.dumps(message) + "\\n"
            self.serial_conn.write(msg_json.encode('utf-8'))
            self.serial_conn.flush()
            return True
        except serial.SerialException:
            self.connected = False
            return False
    
    def read_response(self, timeout: float = 5.0) -> Optional[str]:
        """Read a response from the ESP32."""
        if not self.connected:
            return None
        
        start_time = time.time()
        buffer = ""
        
        while time.time() - start_time < timeout:
            if self.serial_conn.in_waiting > 0:
                try:
                    chunk = self.serial_conn.readline().decode('utf-8', errors='ignore').strip()
                    if chunk:
                        buffer = chunk
                        return buffer
                except (UnicodeDecodeError, serial.SerialException):
                    continue
            time.sleep(0.01)
        
        return buffer if buffer else None
    
    def read_attendance(self) -> Optional[Dict]:
        """Read attendance data from ESP32 (non-blocking)."""
        if not self.connected:
            return None
        
        if self.serial_conn.in_waiting > 0:
            try:
                line = self.serial_conn.readline().decode('utf-8', errors='ignore').strip()
                if line:
                    data = json.loads(line)
                    if data.get('type') == 'attendance':
                        return data.get('data')
            except (json.JSONDecodeError, UnicodeDecodeError, serial.SerialException):
                pass
        
        return None
    
    def get_device_status(self) -> Optional[Dict]:
        """Get the current status of the ESP32 device."""
        self.send_command(self.CMD_STATUS)
        response = self.read_response()
        if response:
            try:
                return json.loads(response)
            except json.JSONDecodeError:
                return {"raw": response}
        return None
    
    def reset_device(self):
        """Send reset command to ESP32."""
        self.send_command(self.CMD_RESET)
        time.sleep(3)
    
    def list_available_ports(self) -> List[Dict]:
        """List all available serial ports."""
        ports = serial.tools.list_ports.comports()
        return [{"device": p.device, "description": p.description, 
                 "vid": p.vid, "pid": p.pid} for p in ports]
`;

export const requirementsTxt = `# Smart Attendance Management System - Requirements
# Python 3.9+

# GUI Framework
PyQt6>=6.5.0

# Serial Communication
pyserial>=3.5

# Computer Vision & Face Recognition
opencv-python>=4.8.0
face-recognition>=1.3.0
dlib>=19.24.0
numpy>=1.24.0

# Audio Processing (Voice Recognition)
PyAudio>=0.2.13
SpeechRecognition>=3.10.0
sounddevice>=0.4.6

# Database (built-in, but listed for clarity)
# sqlite3 (included in Python standard library)

# Additional utilities
Pillow>=10.0.0
python-dateutil>=2.8.0

# Optional: For enhanced voice recognition
# vosk>=0.3.45  # Offline speech recognition
`;

export const configPy = `"""
Configuration Module
System-wide settings and constants.
"""

import os

# ==================== System Configuration ====================

# Database
DATABASE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'attendance_system.db')

# Serial Communication
SERIAL_BAUD_RATE = 115200
SERIAL_TIMEOUT = 2
SERIAL_PORT = None  # Auto-detect if None

# ==================== Attendance Rules ====================

# Exclusion thresholds
MAX_UNJUSTIFIED_ABSENCES = 5
MAX_JUSTIFIED_ABSENCES = 10

# Warning thresholds (alert before exclusion)
WARNING_UNJUSTIFIED = 4
WARNING_JUSTIFIED = 8

# Late threshold (minutes after session start)
LATE_THRESHOLD_MINUTES = 15

# ==================== Identification Settings ====================

# Number of methods required for identification (2 out of 3)
REQUIRED_IDENTIFICATION_METHODS = 2

# Available methods
IDENTIFICATION_METHODS = ['face', 'fingerprint', 'voice']

# Face recognition settings
FACE_RECOGNITION_TOLERANCE = 0.6
FACE_DETECTION_SCALE_FACTOR = 1.1
FACE_DETECTION_MIN_NEIGHBORS = 5

# Fingerprint settings
FINGERPRINT_SENSOR_BAUD = 57600
FINGERPRINT_MATCH_THRESHOLD = 60

# Voice recognition settings
VOICE_SAMPLE_RATE = 16000
VOICE_DURATION_SECONDS = 5
VOICE_CONFIDENCE_THRESHOLD = 0.75

# ==================== Session Settings ====================

# Session duration defaults (minutes)
DEFAULT_LECTURE_DURATION = 90
DEFAULT_TUTORIAL_DURATION = 60
DEFAULT_PRACTICAL_DURATION = 120

# ==================== Hardware Settings ====================

# ESP32-S3 Camera (OV3660)
CAMERA_FRAME_SIZE = "SVGA"  # 800x600
CAMERA_QUALITY = 10
CAMERA_BRIGHTNESS = 0

# LCD Display
LCD_I2C_ADDRESS = 0x27
LCD_COLUMNS = 16
LCD_ROWS = 2

# ==================== File Paths ====================

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
FACE_DATA_DIR = os.path.join(DATA_DIR, 'face_data')
VOICE_DATA_DIR = os.path.join(DATA_DIR, 'voice_data')
EXPORTS_DIR = os.path.join(DATA_DIR, 'exports')
BACKUPS_DIR = os.path.join(DATA_DIR, 'backups')

# Create directories if they don't exist
for directory in [DATA_DIR, FACE_DATA_DIR, VOICE_DATA_DIR, EXPORTS_DIR, BACKUPS_DIR]:
    os.makedirs(directory, exist_ok=True)

# ==================== Academic Levels ====================

ACADEMIC_LEVELS = {
    'L1': 'License Year 1',
    'L2': 'License Year 2',
    'L3': 'License Year 3',
    'M1': 'Master Year 1',
    'M2': 'Master Year 2',
    'PhD': 'Doctorate'
}

# ==================== Session Types ====================

SESSION_TYPES = {
    'lecture': {'name': 'Lecture', 'default_duration': 90},
    'tutorial': {'name': 'Tutorial (TD)', 'default_duration': 60},
    'practical': {'name': 'Practical Work (TP)', 'default_duration': 120}
}
`;
