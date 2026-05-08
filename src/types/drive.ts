export interface DirectoryItem {
  id: number | string;
  name: string;
  type: 'directory' | 'file';
  permissions?: string[];
  mineType?: string; // Matching OpenAPI 'mineType'
}

export interface DirectoryContentResponse {
  permission: string[];
  files: FileItem[];
  children: DirectoryItem[];
}

export interface FileItem {
  id: number | string;
  name: string;
  mineType?: string;
  permissions?: string[];
}

export interface DirectoryTreeResponse {
  id: number | string;
  name: string;
}

export interface MetadataResponse {
  fileId: number | string;
  metadata: Record<string, unknown>;
}
