import axiosInstance from "@/api/axiosInstance";
import type { MetadataResponse } from "@/types/drive";

export const metadataService = {
  /**
   * Get metadata for a specific file or directory
   */
  async getMetadata(id: string | number, type: 'file' | 'directory'): Promise<MetadataResponse[]> {
    const payload = type === 'directory' 
      ? { directoryId: id } 
      : { fileId: id };
    
    const response = await axiosInstance.post<MetadataResponse[]>("/api/metadata", payload);
    return response.data;
  },

  /**
   * Get all metadata for items in a directory
   */
  async getDirectoryMetadata(directoryId: string | number): Promise<MetadataResponse[]> {
    const response = await axiosInstance.post<MetadataResponse[]>("/api/metadata", {
      directoryId
    });
    return response.data;
  }
};
