import { useState } from 'react';
import { ChevronDown, ChevronRight, Terminal, Package, Cpu, Usb } from 'lucide-react';

export function SetupGuide() {
  const [expandedSection, setExpandedSection] = useState<string | null>('prerequisites');

  const toggleSection = (id: string) => {
    setExpandedSection(expandedSection === id ? null : id);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-2">🔧 Setup & Installation Guide</h1>
      <p className="text-gray-400 mb-8">Complete guide to setting up both the hardware and software components.</p>

      {/* Prerequisites */}
      <SetupSection
        id="prerequisites"
        title="Prerequisites"
        icon={<Package size={20} className="text-yellow-400" />}
        expanded={expandedSection === 'prerequisites'}
        onToggle={() => toggleSection('prerequisites')}
      >
        <div className="space-y-4">
          <div>
            <h4 className="text-white font-bold mb-2">Hardware Required:</h4>
            <ul className="list-disc list-inside text-gray-300 space-y-1 text-sm">
              <li>ESP32-S3 N16R8 Development Board (16MB Flash, 8MB PSRAM)</li>
              <li>OV3660 Camera Module</li>
              <li>AS608 Optical Fingerprint Sensor (UART version)</li>
              <li>LCD 1602 with I2C backpack (address 0x27)</li>
              <li>High Quality Sound Sensor Module (analog + digital output)</li>
              <li>USB-C cable (for programming & serial communication)</li>
              <li>Breadboard and jumper wires</li>
              <li>3.3V power supply (or USB power)</li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-2">Software Required:</h4>
            <ul className="list-disc list-inside text-gray-300 space-y-1 text-sm">
              <li>Python 3.9 or higher</li>
              <li>PlatformIO (for ESP32 firmware) OR Arduino IDE 2.x</li>
              <li>pip (Python package manager)</li>
              <li>Git (optional, for cloning)</li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-2">Operating System:</h4>
            <p className="text-gray-300 text-sm">
              Windows 10/11, macOS 11+, or Ubuntu 20.04+. The Python GUI uses PyQt6 which is cross-platform.
              USB serial drivers may be needed on Windows (CP210x or CH340 depending on your ESP32 board).
            </p>
          </div>
        </div>
      </SetupSection>

      {/* Hardware Assembly */}
      <SetupSection
        id="hardware"
        title="Hardware Assembly & Wiring"
        icon={<Cpu size={20} className="text-emerald-400" />}
        expanded={expandedSection === 'hardware'}
        onToggle={() => toggleSection('hardware')}
      >
        <div className="space-y-6">
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-600">
            <h4 className="text-emerald-400 font-bold mb-3">⚡ Important Notes Before Wiring:</h4>
            <ul className="list-disc list-inside text-gray-300 space-y-1 text-sm">
              <li>The ESP32-S3 N16R8 uses <strong>3.3V logic</strong> — do NOT connect 5V devices directly to GPIO pins</li>
              <li>The AS608 fingerprint sensor operates at <strong>3.3V</strong> (some versions are 5V — check yours)</li>
              <li>The LCD I2C backpack typically needs <strong>5V</strong> for backlight but works with 3.3V logic</li>
              <li>Ensure all components share a common <strong>GND</strong></li>
            </ul>
          </div>

          <WiringTable
            title="📷 OV3660 Camera → ESP32-S3"
            connections={[
              ['D0 (Y2)', 'GPIO 15'],
              ['D1 (Y3)', 'GPIO 17'],
              ['D2 (Y4)', 'GPIO 18'],
              ['D3 (Y5)', 'GPIO 16'],
              ['D4 (Y6)', 'GPIO 14'],
              ['D5 (Y7)', 'GPIO 12'],
              ['D6 (Y8)', 'GPIO 11'],
              ['D7 (Y9)', 'GPIO 48'],
              ['XCLK', 'GPIO 10'],
              ['PCLK', 'GPIO 46'],
              ['VSYNC', 'GPIO 38'],
              ['HREF', 'GPIO 5'],
              ['SDA (SIOD)', 'GPIO 40'],
              ['SCL (SIOC)', 'GPIO 39'],
              ['3.3V', '3.3V'],
              ['GND', 'GND'],
            ]}
          />

          <WiringTable
            title="👆 AS608 Fingerprint → ESP32-S3 (UART2)"
            connections={[
              ['TX (White)', 'GPIO 44 (RX2)'],
              ['RX (Green)', 'GPIO 43 (TX2)'],
              ['3.3V (Red)', '3.3V'],
              ['GND (Black)', 'GND'],
            ]}
          />

          <WiringTable
            title="📺 LCD 1602 I2C → ESP32-S3"
            connections={[
              ['SDA', 'GPIO 8'],
              ['SCL', 'GPIO 9'],
              ['VCC', '5V'],
              ['GND', 'GND'],
            ]}
          />

          <WiringTable
            title="🎤 Sound Sensor → ESP32-S3"
            connections={[
              ['AO (Analog Out)', 'GPIO 1 (ADC1_CH0)'],
              ['DO (Digital Out)', 'GPIO 2'],
              ['VCC', '3.3V'],
              ['GND', 'GND'],
            ]}
          />
        </div>
      </SetupSection>

      {/* ESP32 Firmware */}
      <SetupSection
        id="firmware"
        title="ESP32-S3 Firmware Installation"
        icon={<Cpu size={20} className="text-blue-400" />}
        expanded={expandedSection === 'firmware'}
        onToggle={() => toggleSection('firmware')}
      >
        <div className="space-y-4">
          <h4 className="text-white font-bold">Option A: PlatformIO (Recommended)</h4>
          <ol className="list-decimal list-inside text-gray-300 space-y-2 text-sm">
            <li>Install VS Code and the PlatformIO extension</li>
            <li>Create a new project with board "ESP32-S3-DevKitC-1"</li>
            <li>Copy the <code className="bg-gray-700 px-1 rounded text-emerald-300">main.cpp</code> to <code className="bg-gray-700 px-1 rounded">src/</code></li>
            <li>Copy the <code className="bg-gray-700 px-1 rounded text-emerald-300">platformio.ini</code> to project root</li>
            <li>Update <code className="bg-gray-700 px-1 rounded">upload_port</code> to match your serial port</li>
            <li>Click "Upload" in PlatformIO toolbar</li>
          </ol>

          <h4 className="text-white font-bold mt-6">Option B: Arduino IDE</h4>
          <ol className="list-decimal list-inside text-gray-300 space-y-2 text-sm">
            <li>Install Arduino IDE 2.x</li>
            <li>Add ESP32 board URL: <code className="bg-gray-700 px-1 rounded text-xs">https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json</code></li>
            <li>Install "esp32" board package (v2.0.11+)</li>
            <li>Install libraries: ArduinoJson, LiquidCrystal_I2C, Adafruit Fingerprint Sensor, esp32-camera</li>
            <li>Select board: "ESP32S3 Dev Module"</li>
            <li>Configure: Flash Size 16MB, PSRAM "OPI PSRAM", Partition "Default 16MB"</li>
            <li>Upload the <code className="bg-gray-700 px-1 rounded text-emerald-300">main.cpp</code></li>
          </ol>

          <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 mt-4">
            <p className="text-yellow-300 text-sm font-bold">⚠️ Camera Pin Configuration</p>
            <p className="text-yellow-200/70 text-xs mt-1">
              The pin assignments in the firmware are for a specific ESP32-S3 CAM board layout. 
              If your board has different camera pins, update the #define values at the top of main.cpp 
              to match your board's schematic.
            </p>
          </div>
        </div>
      </SetupSection>

      {/* Python Software */}
      <SetupSection
        id="python"
        title="Python Software Installation"
        icon={<Terminal size={20} className="text-purple-400" />}
        expanded={expandedSection === 'python'}
        onToggle={() => toggleSection('python')}
      >
        <div className="space-y-4">
          <h4 className="text-white font-bold">Step 1: Create Virtual Environment</h4>
          <CodeBlock code={`# Create project directory
mkdir smart-attendance && cd smart-attendance

# Create virtual environment
python -m venv venv

# Activate it
# On Windows:
venv\\Scripts\\activate
# On macOS/Linux:
source venv/bin/activate`} />

          <h4 className="text-white font-bold mt-6">Step 2: Install Dependencies</h4>
          <CodeBlock code={`# Install all required packages
pip install PyQt6 pyserial opencv-python face-recognition numpy
pip install PyAudio SpeechRecognition sounddevice Pillow python-dateutil

# Or use requirements.txt
pip install -r requirements.txt`} />

          <h4 className="text-white font-bold mt-6">Step 3: Project Structure</h4>
          <CodeBlock code={`smart-attendance/
├── main.py              # Entry point
├── database.py          # SQLite database manager
├── gui.py               # PyQt6 GUI interface
├── serial_comm.py       # ESP32 serial communication
├── config.py            # System configuration
├── requirements.txt     # Dependencies
└── data/                # Auto-created directories
    ├── face_data/
    ├── voice_data/
    ├── exports/
    └── backups/`} />

          <h4 className="text-white font-bold mt-6">Step 4: Run the Application</h4>
          <CodeBlock code={`# Make sure ESP32 is connected via USB
python main.py`} />

          <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mt-4">
            <p className="text-blue-300 text-sm font-bold">💡 Note on face_recognition</p>
            <p className="text-blue-200/70 text-xs mt-1">
              The <code>face_recognition</code> library requires <code>dlib</code> which needs CMake and a C++ compiler.
              On Windows, install Visual Studio Build Tools. On macOS, install Xcode command line tools.
              On Linux: <code>sudo apt install cmake build-essential</code>
            </p>
          </div>
        </div>
      </SetupSection>

      {/* Serial Connection */}
      <SetupSection
        id="serial"
        title="Serial Connection & Testing"
        icon={<Usb size={20} className="text-cyan-400" />}
        expanded={expandedSection === 'serial'}
        onToggle={() => toggleSection('serial')}
      >
        <div className="space-y-4">
          <h4 className="text-white font-bold">Finding Your ESP32 Port</h4>
          <CodeBlock code={`# On Linux/macOS:
ls /dev/tty* | grep -i usb
# or
ls /dev/cu.*

# On Windows (PowerShell):
[System.IO.Ports.SerialPort]::GetPortNames()

# Common port names:
# Linux: /dev/ttyACM0 or /dev/ttyUSB0
# macOS: /dev/cu.usbmodem* or /dev/cu.SLAB_USBtoUART
# Windows: COM3, COM4, etc.`} />

          <h4 className="text-white font-bold mt-6">Testing Serial Communication</h4>
          <CodeBlock code={`# Use Python to test connection
import serial
import json

# Connect
ser = serial.Serial('/dev/ttyACM0', 115200, timeout=2)

# Send handshake
ser.write(b'{"cmd": "HANDSHAKE"}\\n')

# Read response
response = ser.readline().decode().strip()
print(f"Response: {response}")

# Expected: {"type": "system", "status": "READY"}

ser.close()`} />

          <h4 className="text-white font-bold mt-6">Troubleshooting</h4>
          <div className="space-y-2 text-sm text-gray-300">
            <p>• <strong>No serial port found:</strong> Install USB drivers (CP210x for Silicon Labs, CH340 for CH340 chips)</p>
            <p>• <strong>Permission denied (Linux):</strong> Add user to dialout group: <code className="bg-gray-700 px-1 rounded">sudo usermod -aG dialout $USER</code></p>
            <p>• <strong>Garbage output:</strong> Check baud rate matches (115200)</p>
            <p>• <strong>Camera not initializing:</strong> Check all camera ribbon cable connections</p>
            <p>• <strong>LCD blank:</strong> Adjust contrast with the potentiometer on the I2C backpack</p>
          </div>
        </div>
      </SetupSection>

      {/* Usage */}
      <SetupSection
        id="usage"
        title="Using the System"
        icon={<Terminal size={20} className="text-emerald-400" />}
        expanded={expandedSection === 'usage'}
        onToggle={() => toggleSection('usage')}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-600">
              <h4 className="text-emerald-400 font-bold mb-2">1. Add Students</h4>
              <p className="text-gray-300 text-sm">Go to "Students" tab → Add student with ID, name, email, and academic level</p>
            </div>
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-600">
              <h4 className="text-emerald-400 font-bold mb-2">2. Create Courses</h4>
              <p className="text-gray-300 text-sm">Go to "Courses" tab → Add course with code, name, session type (lecture/tutorial/practical)</p>
            </div>
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-600">
              <h4 className="text-emerald-400 font-bold mb-2">3. Enroll Biometrics</h4>
              <p className="text-gray-300 text-sm">Go to "Biometric Enrollment" → Select student → Enroll face, fingerprint, and voice</p>
            </div>
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-600">
              <h4 className="text-emerald-400 font-bold mb-2">4. Take Attendance</h4>
              <p className="text-gray-300 text-sm">Go to "Take Attendance" → Select course → Start session → Students scan at ESP32</p>
            </div>
          </div>

          <div className="bg-gray-900 rounded-lg p-4 border border-gray-600 mt-4">
            <h4 className="text-white font-bold mb-2">Enrollment Process (at ESP32 hardware):</h4>
            <ol className="list-decimal list-inside text-gray-300 space-y-1 text-sm">
              <li>PC sends enrollment command to ESP32</li>
              <li>For face: ESP32 captures 5 images from different angles</li>
              <li>For fingerprint: Place finger twice on AS608 sensor</li>
              <li>For voice: Speak for 5 seconds into the sound sensor</li>
              <li>Data is stored on PC (face/voice) or ESP32 flash (fingerprint templates)</li>
            </ol>
          </div>
        </div>
      </SetupSection>
    </div>
  );
}

function SetupSection({ id, title, icon, expanded, onToggle, children }: {
  id: string; title: string; icon: React.ReactNode; expanded: boolean;
  onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="mb-4 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-gray-750 transition-colors"
      >
        {icon}
        <span className="text-lg font-bold text-white flex-1">{title}</span>
        {expanded ? <ChevronDown size={20} className="text-gray-400" /> : <ChevronRight size={20} className="text-gray-400" />}
      </button>
      {expanded && (
        <div className="px-6 pb-6 border-t border-gray-700 pt-4">
          {children}
        </div>
      )}
    </div>
  );
}

function WiringTable({ title, connections }: { title: string; connections: string[][] }) {
  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden border border-gray-600">
      <div className="bg-gray-700 px-4 py-2">
        <span className="text-sm font-bold text-white">{title}</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="text-left px-4 py-2 text-gray-400 font-medium">Sensor Pin</th>
            <th className="text-left px-4 py-2 text-gray-400 font-medium">ESP32-S3 Pin</th>
          </tr>
        </thead>
        <tbody>
          {connections.map(([sensor, esp], i) => (
            <tr key={i} className="border-b border-gray-800">
              <td className="px-4 py-1.5 text-gray-300 font-mono text-xs">{sensor}</td>
              <td className="px-4 py-1.5 text-emerald-300 font-mono text-xs">{esp}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="bg-gray-900 rounded-lg p-4 border border-gray-600 overflow-x-auto">
      <code className="text-sm text-gray-300 font-mono whitespace-pre">{code}</code>
    </pre>
  );
}
