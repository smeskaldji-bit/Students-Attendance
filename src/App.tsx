import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { CodeViewer } from './components/CodeViewer';
import { Overview } from './components/Overview';
import { Architecture } from './components/Architecture';
import { SetupGuide } from './components/SetupGuide';
import { FileTreeItem } from './types';

const fileTree: FileTreeItem[] = [
  {
    id: 'overview',
    name: '📋 Project Overview',
    type: 'page',
  },
  {
    id: 'architecture',
    name: '🏗️ System Architecture',
    type: 'page',
  },
  {
    id: 'setup',
    name: '🔧 Setup Guide',
    type: 'page',
  },
  {
    id: 'python-header',
    name: '🐍 Python Software',
    type: 'folder',
    children: [
      { id: 'main.py', name: 'main.py', type: 'file', language: 'python', description: 'Application entry point' },
      { id: 'database.py', name: 'database.py', type: 'file', language: 'python', description: 'Database management (SQLite)' },
      { id: 'gui.py', name: 'gui.py', type: 'file', language: 'python', description: 'PyQt6 GUI interface' },
      { id: 'serial_comm.py', name: 'serial_comm.py', type: 'file', language: 'python', description: 'ESP32 serial communication' },
      { id: 'config.py', name: 'config.py', type: 'file', language: 'python', description: 'System configuration' },
      { id: 'requirements.txt', name: 'requirements.txt', type: 'file', language: 'text', description: 'Python dependencies' },
    ],
  },
  {
    id: 'esp32-header',
    name: '🔌 ESP32-S3 Firmware',
    type: 'folder',
    children: [
      { id: 'main.cpp', name: 'main.cpp', type: 'file', language: 'cpp', description: 'Main firmware code' },
      { id: 'platformio.ini', name: 'platformio.ini', type: 'file', language: 'ini', description: 'PlatformIO configuration' },
      { id: 'esp32-readme', name: 'README.md', type: 'file', language: 'markdown', description: 'Hardware setup & wiring' },
    ],
  },
];

function App() {
  const [activeFile, setActiveFile] = useState<string>('overview');

  const renderContent = () => {
    switch (activeFile) {
      case 'overview':
        return <Overview />;
      case 'architecture':
        return <Architecture />;
      case 'setup':
        return <SetupGuide />;
      default:
        return <CodeViewer fileId={activeFile} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      <Sidebar
        fileTree={fileTree}
        activeFile={activeFile}
        onFileSelect={setActiveFile}
      />
      <main className="flex-1 overflow-auto">
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
