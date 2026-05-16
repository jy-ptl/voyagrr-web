export interface DirectoryItem {
  id: number | string;
  name: string;
  type: "directory" | "file";
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

export interface FileMetadata {
  file?: {
    size?: number;
    width?: number;
    height?: number;
    mime?: string;
    device?: string;
    location?: string;
    createdOn?: string;
    updatedOn?: string;
    duration?: number | null;
  };
  analysis?: {
    scene?: string;
    tags?: Array<{ tag: string; confidence?: number }>;
    objects?: Array<{ label: string; confidence: number }>;
    emotions?: Array<{ emotion: string; confidence: number }>;
  };
  recognition?: {
    faces?: Array<{
      bbox: { x1: number; x2: number; y1: number; y2: number };
      userId?: string | null;
      confidence?: number | null;
      user?: {
        firstName: string;
        lastName: string;
        email: string;
        username: string;
        avatarUrl?: string;
      } | null;
    }>;
    tripId?: number;
  };
}

export interface MetadataResponse {
  fileId: number | string;
  metadata: FileMetadata;
}
