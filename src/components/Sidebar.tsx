import { useState } from 'react';
import { FileTreeItem } from '../types';
import { ChevronRight, ChevronDown, FileCode, Folder } from 'lucide-react';

interface SidebarProps {
  fileTree: FileTreeItem[];
  activeFile: string;
  onFileSelect: (id: string) => void;
}

export function Sidebar({ fileTree, activeFile, onFileSelect }: SidebarProps) {
  return (
    <aside className="w-72 bg-gray-800 border-r border-gray-700 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
          <span className="text-2xl">🎓</span>
          Smart Attendance
        </h1>
        <p className="text-xs text-gray-400 mt-1">ESP32-S3 + Python System</p>
      </div>

      {/* File Tree */}
      <nav className="flex-1 overflow-y-auto p-2">
        {fileTree.map((item) => (
          <TreeItem
            key={item.id}
            item={item}
            activeFile={activeFile}
            onFileSelect={onFileSelect}
            depth={0}
          />
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-gray-700 text-xs text-gray-500">
        <p>Version 1.0.0</p>
        <p className="mt-1">ESP32-S3 N16R8 + OV3660</p>
      </div>
    </aside>
  );
}

interface TreeItemProps {
  item: FileTreeItem;
  activeFile: string;
  onFileSelect: (id: string) => void;
  depth: number;
}

function TreeItem({ item, activeFile, onFileSelect, depth }: TreeItemProps) {
  const [expanded, setExpanded] = useState(true);

  if (item.type === 'folder') {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 w-full px-2 py-1.5 text-sm text-gray-300 hover:bg-gray-700 rounded transition-colors"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Folder size={14} className="text-yellow-400" />
          <span className="font-medium">{item.name}</span>
        </button>
        {expanded && item.children && (
          <div>
            {item.children.map((child) => (
              <TreeItem
                key={child.id}
                item={child}
                activeFile={activeFile}
                onFileSelect={onFileSelect}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isActive = activeFile === item.id;

  return (
    <button
      onClick={() => onFileSelect(item.id)}
      className={`flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded transition-colors ${
        isActive
          ? 'bg-emerald-900/50 text-emerald-300 border-l-2 border-emerald-400'
          : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
      }`}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <FileCode size={14} className={isActive ? 'text-emerald-400' : 'text-gray-500'} />
      <div className="text-left flex-1 min-w-0">
        <div className="truncate">{item.name}</div>
        {item.description && (
          <div className="text-xs text-gray-500 truncate">{item.description}</div>
        )}
      </div>
    </button>
  );
}
