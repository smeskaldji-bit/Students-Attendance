import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, Download } from 'lucide-react';
import {
  mainPy,
  databasePy,
  guiPy,
  serialCommPy,
  configPy,
  requirementsTxt,
} from '../data/pythonCode';
import {
  esp32MainCpp,
  esp32PlatformioIni,
  esp32Readme,
} from '../data/esp32Code';

interface CodeViewerProps {
  fileId: string;
}

const codeMap: Record<string, { code: string; language: string; filename: string }> = {
  'main.py': { code: mainPy, language: 'python', filename: 'main.py' },
  'database.py': { code: databasePy, language: 'python', filename: 'database.py' },
  'gui.py': { code: guiPy, language: 'python', filename: 'gui.py' },
  'serial_comm.py': { code: serialCommPy, language: 'python', filename: 'serial_comm.py' },
  'config.py': { code: configPy, language: 'python', filename: 'config.py' },
  'requirements.txt': { code: requirementsTxt, language: 'text', filename: 'requirements.txt' },
  'main.cpp': { code: esp32MainCpp, language: 'cpp', filename: 'main.cpp' },
  'platformio.ini': { code: esp32PlatformioIni, language: 'ini', filename: 'platformio.ini' },
  'esp32-readme': { code: esp32Readme, language: 'markdown', filename: 'README.md' },
};

export function CodeViewer({ fileId }: CodeViewerProps) {
  const [copied, setCopied] = useState(false);
  const file = codeMap[fileId];

  if (!file) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>Select a file to view its contents</p>
      </div>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(file.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([file.code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const lineCount = file.code.split('\n').length;

  return (
    <div className="h-full flex flex-col">
      {/* File header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <span className="text-emerald-400 font-mono text-sm font-bold">{file.filename}</span>
          <span className="text-xs text-gray-500 bg-gray-700 px-2 py-0.5 rounded">{file.language}</span>
          <span className="text-xs text-gray-500">{lineCount} lines</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
          >
            <Download size={12} />
            Download
          </button>
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded transition-colors ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Code content */}
      <div className="flex-1 overflow-auto">
        <SyntaxHighlighter
          language={file.language === 'text' ? 'plaintext' : file.language}
          style={vscDarkPlus}
          showLineNumbers
          wrapLines
          customStyle={{
            margin: 0,
            padding: '1rem',
            background: '#1a1b26',
            fontSize: '13px',
            lineHeight: '1.5',
            minHeight: '100%',
          }}
          lineNumberStyle={{
            minWidth: '3em',
            paddingRight: '1em',
            color: '#4a5568',
          }}
        >
          {file.code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
