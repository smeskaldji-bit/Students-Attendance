export interface FileTreeItem {
  id: string;
  name: string;
  type: 'file' | 'folder' | 'page';
  language?: string;
  description?: string;
  children?: FileTreeItem[];
}
