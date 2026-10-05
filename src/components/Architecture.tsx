export function Architecture() {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-8">🏗️ System Architecture</h1>

      {/* High-Level Architecture */}
      <div className="bg-gray-800 rounded-xl p-8 mb-8 border border-gray-700">
        <h2 className="text-xl font-bold text-emerald-400 mb-6">High-Level System Architecture</h2>
        
        <div className="relative">
          {/* Architecture Diagram */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* ESP32 Hardware */}
            <div className="bg-gray-900 rounded-lg p-5 border-2 border-emerald-600">
              <h3 className="text-emerald-400 font-bold text-center mb-4 text-lg">
                🔌 ESP32-S3 N16R8
              </h3>
              <div className="space-y-3">
                <div className="bg-gray-800 rounded p-3 border border-gray-600">
                  <p className="text-xs text-gray-400 mb-1">📷 Camera Module</p>
                  <p className="text-sm text-white">OV3660 (800x600 JPEG)</p>
                  <p className="text-xs text-gray-500">Face capture → sends to PC</p>
                </div>
                <div className="bg-gray-800 rounded p-3 border border-gray-600">
                  <p className="text-xs text-gray-400 mb-1">👆 Fingerprint</p>
                  <p className="text-sm text-white">AS608 (UART @ 57600)</p>
                  <p className="text-xs text-gray-500">Local matching on device</p>
                </div>
                <div className="bg-gray-800 rounded p-3 border border-gray-600">
                  <p className="text-xs text-gray-400 mb-1">🎤 Sound Sensor</p>
                  <p className="text-sm text-white">Analog + Digital output</p>
                  <p className="text-xs text-gray-500">Voice energy detection</p>
                </div>
                <div className="bg-gray-800 rounded p-3 border border-gray-600">
                  <p className="text-xs text-gray-400 mb-1">📺 LCD Display</p>
                  <p className="text-sm text-white">1602 I2C (0x27)</p>
                  <p className="text-xs text-gray-500">Status & feedback</p>
                </div>
              </div>
            </div>

            {/* Communication */}
            <div className="flex flex-col items-center justify-center">
              <div className="bg-gradient-to-b from-blue-900/50 to-purple-900/50 rounded-lg p-6 border border-blue-600 w-full">
                <h3 className="text-blue-400 font-bold text-center mb-4">
                  📡 Communication Layer
                </h3>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="bg-blue-900/30 rounded p-3 border border-blue-700">
                      <p className="text-sm text-blue-300 font-mono">USB Serial</p>
                      <p className="text-xs text-gray-400">115200 baud</p>
                    </div>
                  </div>
                  <div className="text-center text-gray-500">↕</div>
                  <div className="text-center">
                    <div className="bg-purple-900/30 rounded p-3 border border-purple-700">
                      <p className="text-sm text-purple-300 font-mono">JSON Protocol</p>
                      <p className="text-xs text-gray-400">Command/Response</p>
                    </div>
                  </div>
                  <div className="text-center text-gray-500 text-xs mt-4">
                    <p>Commands: START_SESSION, END_SESSION,</p>
                    <p>ENROLL, IDENTIFY, STATUS</p>
                  </div>
                </div>
              </div>
            </div>

            {/* PC Software */}
            <div className="bg-gray-900 rounded-lg p-5 border-2 border-blue-600">
              <h3 className="text-blue-400 font-bold text-center mb-4 text-lg">
                💻 Python Software
              </h3>
              <div className="space-y-3">
                <div className="bg-gray-800 rounded p-3 border border-gray-600">
                  <p className="text-xs text-gray-400 mb-1">🖥️ GUI Layer</p>
                  <p className="text-sm text-white">PyQt6 Interface</p>
                  <p className="text-xs text-gray-500">Attendance, Students, Courses</p>
                </div>
                <div className="bg-gray-800 rounded p-3 border border-gray-600">
                  <p className="text-xs text-gray-400 mb-1">🧠 Recognition Engine</p>
                  <p className="text-sm text-white">Face + Voice Processing</p>
                  <p className="text-xs text-gray-500">face_recognition, SpeechRecognition</p>
                </div>
                <div className="bg-gray-800 rounded p-3 border border-gray-600">
                  <p className="text-xs text-gray-400 mb-1">📊 Business Logic</p>
                  <p className="text-sm text-white">Attendance Rules</p>
                  <p className="text-xs text-gray-500">2/3 match, exclusion tracking</p>
                </div>
                <div className="bg-gray-800 rounded p-3 border border-gray-600">
                  <p className="text-xs text-gray-400 mb-1">🗄️ Database</p>
                  <p className="text-sm text-white">SQLite3</p>
                  <p className="text-xs text-gray-500">Students, Courses, Attendance</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Data Flow */}
      <div className="bg-gray-800 rounded-xl p-8 mb-8 border border-gray-700">
        <h2 className="text-xl font-bold text-blue-400 mb-6">Data Flow — Attendance Session</h2>
        
        <div className="space-y-4">
          <FlowStep
            step={1}
            title="Session Start"
            description="PC sends START_SESSION command with session ID to ESP32"
            from="PC"
            to="ESP32"
            color="blue"
          />
          <FlowStep
            step={2}
            title="Student Approaches"
            description="ESP32 activates all sensors. LCD shows 'Scanning...'"
            from="ESP32"
            to="Sensors"
            color="emerald"
          />
          <FlowStep
            step={3}
            title="Face Capture"
            description="OV3660 captures image. ESP32 sends to PC for face recognition processing"
            from="ESP32"
            to="PC"
            color="blue"
          />
          <FlowStep
            step={4}
            title="Fingerprint Scan"
            description="AS608 captures fingerprint. ESP32 performs local matching against enrolled templates"
            from="ESP32"
            to="ESP32"
            color="orange"
          />
          <FlowStep
            step={5}
            title="Voice Detection"
            description="Sound sensor detects voice energy pattern. Audio data sent to PC for voice recognition"
            from="ESP32"
            to="PC"
            color="pink"
          />
          <FlowStep
            step={6}
            title="Multi-Method Verification"
            description="PC checks if at least 2 out of 3 methods matched the same student"
            from="PC"
            to="PC"
            color="purple"
          />
          <FlowStep
            step={7}
            title="Attendance Confirmed"
            description="If 2/3 methods match: attendance recorded in database. LCD shows confirmation."
            from="PC"
            to="Database"
            color="emerald"
          />
        </div>
      </div>

      {/* Database Schema */}
      <div className="bg-gray-800 rounded-xl p-8 border border-gray-700">
        <h2 className="text-xl font-bold text-purple-400 mb-6">Database Schema</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SchemaTable
            name="students"
            fields={['id (PK)', 'student_id (UNIQUE)', 'first_name', 'last_name', 'email', 'phone', 'academic_level', 'face_data (BLOB)', 'fingerprint_id', 'voice_print_data (BLOB)', 'is_active']}
          />
          <SchemaTable
            name="courses"
            fields={['id (PK)', 'course_code (UNIQUE)', 'course_name', 'session_type', 'academic_level', 'semester', 'max_students']}
          />
          <SchemaTable
            name="course_enrollments"
            fields={['id (PK)', 'student_id (FK)', 'course_id (FK)', 'enrolled_date', 'UNIQUE(student, course)']}
          />
          <SchemaTable
            name="sessions"
            fields={['id (PK)', 'course_id (FK)', 'session_date', 'start_time', 'end_time', 'session_number']}
          />
          <SchemaTable
            name="attendance"
            fields={['id (PK)', 'session_id (FK)', 'student_id (FK)', 'status', 'check_in_time', 'identification_methods', 'notes']}
          />
          <SchemaTable
            name="justifications"
            fields={['id (PK)', 'student_id (FK)', 'session_id (FK)', 'reason', 'document_path', 'approved', 'approved_by']}
          />
        </div>
      </div>
    </div>
  );
}

function FlowStep({ step, title, description, from, to, color }: {
  step: number; title: string; description: string; from: string; to: string; color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: 'border-blue-500 bg-blue-900/20',
    emerald: 'border-emerald-500 bg-emerald-900/20',
    orange: 'border-orange-500 bg-orange-900/20',
    pink: 'border-pink-500 bg-pink-900/20',
    purple: 'border-purple-500 bg-purple-900/20',
  };

  return (
    <div className={`flex items-start gap-4 p-4 rounded-lg border ${colorMap[color]}`}>
      <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-white shrink-0">
        {step}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-bold text-white">{title}</span>
          <span className="text-xs text-gray-500 font-mono">{from} → {to}</span>
        </div>
        <p className="text-sm text-gray-400">{description}</p>
      </div>
    </div>
  );
}

function SchemaTable({ name, fields }: { name: string; fields: string[] }) {
  return (
    <div className="bg-gray-900 rounded-lg border border-gray-600 overflow-hidden">
      <div className="bg-gray-700 px-3 py-2">
        <span className="text-sm font-bold text-yellow-400 font-mono">{name}</span>
      </div>
      <div className="p-3 space-y-1">
        {fields.map((field, i) => (
          <div key={i} className="text-xs text-gray-400 font-mono flex items-center gap-1">
            {field.includes('PK') && <span className="text-yellow-400">🔑</span>}
            {field.includes('FK') && <span className="text-blue-400">🔗</span>}
            {field.includes('UNIQUE') && !field.includes('PK') && <span className="text-emerald-400">✦</span>}
            <span>{field}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
