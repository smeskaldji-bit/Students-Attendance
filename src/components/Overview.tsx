import { Shield, Cpu, Camera, Fingerprint, Mic, Database, Monitor, Wifi } from 'lucide-react';

export function Overview() {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-white mb-4">
          🎓 Smart Attendance Management System
        </h1>
        <p className="text-xl text-gray-400 max-w-3xl mx-auto">
          A comprehensive biometric attendance system using ESP32-S3 hardware with multi-modal
          identification (Face + Fingerprint + Voice) and a Python desktop application for management.
        </p>
      </div>

      {/* Key Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <FeatureCard
          icon={<Shield className="text-emerald-400" size={32} />}
          title="Multi-Modal Authentication"
          description="Requires 2 out of 3 identification methods (face, fingerprint, voice) for attendance confirmation, ensuring high accuracy."
        />
        <FeatureCard
          icon={<Cpu className="text-blue-400" size={32} />}
          title="ESP32-S3 Powered"
          description="Leverages the ESP32-S3 N16R8 with 16MB flash, 8MB PSRAM, OV3660 camera, AS608 fingerprint sensor, and sound sensor."
        />
        <FeatureCard
          icon={<Database className="text-purple-400" size={32} />}
          title="Complete Management"
          description="Full Python GUI for managing courses, students, sessions, attendance records, and exclusion tracking."
        />
      </div>

      {/* System Components */}
      <div className="bg-gray-800 rounded-xl p-8 mb-12 border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-6">System Components</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Hardware */}
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-600">
            <h3 className="text-lg font-bold text-emerald-400 mb-4 flex items-center gap-2">
              <Cpu size={20} /> Hardware (ESP32-S3)
            </h3>
            <ul className="space-y-3 text-gray-300">
              <li className="flex items-start gap-2">
                <Camera size={16} className="text-blue-400 mt-0.5 shrink-0" />
                <span><strong>OV3660 Camera</strong> — Face detection & capture</span>
              </li>
              <li className="flex items-start gap-2">
                <Fingerprint size={16} className="text-orange-400 mt-0.5 shrink-0" />
                <span><strong>AS608 Fingerprint</strong> — Biometric fingerprint scanning</span>
              </li>
              <li className="flex items-start gap-2">
                <Mic size={16} className="text-pink-400 mt-0.5 shrink-0" />
                <span><strong>Sound Sensor</strong> — Voice detection (analog + digital)</span>
              </li>
              <li className="flex items-start gap-2">
                <Monitor size={16} className="text-yellow-400 mt-0.5 shrink-0" />
                <span><strong>LCD 1602 I2C</strong> — Status display</span>
              </li>
              <li className="flex items-start gap-2">
                <Wifi size={16} className="text-cyan-400 mt-0.5 shrink-0" />
                <span><strong>USB Serial</strong> — Communication with PC</span>
              </li>
            </ul>
          </div>

          {/* Software */}
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-600">
            <h3 className="text-lg font-bold text-blue-400 mb-4 flex items-center gap-2">
              <Monitor size={20} /> Software (Python)
            </h3>
            <ul className="space-y-3 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400">●</span>
                <span><strong>PyQt6 GUI</strong> — Full desktop interface</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400">●</span>
                <span><strong>SQLite Database</strong> — Local data storage</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400">●</span>
                <span><strong>Face Recognition</strong> — OpenCV + face_recognition</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400">●</span>
                <span><strong>Voice Recognition</strong> — SpeechRecognition library</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400">●</span>
                <span><strong>Serial Protocol</strong> — JSON-based ESP32 communication</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Exclusion Rules */}
      <div className="bg-red-900/20 border border-red-800 rounded-xl p-6 mb-12">
        <h2 className="text-xl font-bold text-red-400 mb-4">⚠️ Exclusion Rules</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-red-900/30 rounded-lg p-4">
            <p className="text-red-300 font-bold text-lg">5 Unjustified Absences</p>
            <p className="text-red-200/70 text-sm mt-1">
              Student is flagged for exclusion after 5 absences without valid justification.
              Warning at 4 absences.
            </p>
          </div>
          <div className="bg-orange-900/30 rounded-lg p-4">
            <p className="text-orange-300 font-bold text-lg">10 Justified Absences</p>
            <p className="text-orange-200/70 text-sm mt-1">
              Student is flagged for exclusion after 10 justified absences (with documentation).
              Warning at 8 absences.
            </p>
          </div>
        </div>
      </div>

      {/* Identification Flow */}
      <div className="bg-gray-800 rounded-xl p-8 border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-6">Identification Process</h2>
        <div className="flex flex-col md:flex-row items-center justify-center gap-4">
          <StepBadge number={1} text="Face Scan" color="blue" />
          <Arrow />
          <StepBadge number={2} text="Fingerprint" color="orange" />
          <Arrow />
          <StepBadge number={3} text="Voice" color="pink" />
          <Arrow />
          <StepBadge number="✓" text="2/3 Match = ✓" color="emerald" />
        </div>
        <p className="text-center text-gray-400 mt-6 text-sm">
          The system requires successful identification via at least <strong className="text-white">2 out of 3</strong> methods
          before confirming attendance. This multi-factor approach prevents fraud and ensures accuracy.
        </p>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-colors">
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </div>
  );
}

function StepBadge({ number, text, color }: { number: string | number; text: string; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-900/50 border-blue-500 text-blue-300',
    orange: 'bg-orange-900/50 border-orange-500 text-orange-300',
    pink: 'bg-pink-900/50 border-pink-500 text-pink-300',
    emerald: 'bg-emerald-900/50 border-emerald-500 text-emerald-300',
  };

  return (
    <div className={`flex flex-col items-center px-4 py-3 rounded-lg border ${colorClasses[color]}`}>
      <span className="text-2xl font-bold">{number}</span>
      <span className="text-xs mt-1">{text}</span>
    </div>
  );
}

function Arrow() {
  return <span className="text-gray-600 text-2xl hidden md:block">→</span>;
}
