import axiosInstance from "@/api/axiosInstance";
import type { DirectoryItem, DirectoryContentResponse, DirectoryTreeResponse } from "@/types/drive";

export const directoryService = {
  /**
   * Retrieves all directories belonging to the authenticated user (Root)
   */
  async fetchRoot(): Promise<DirectoryItem[]> {
    const response = await axiosInstance.get<DirectoryTreeResponse[]>("/api/directory");
    return response.data.map(item => ({
      ...item,
      type: 'directory' as const
    }));
  },

  /**
   * Retrieves the contents of a directory
   */
  async fetchContents(directoryId: string | number): Promise<DirectoryContentResponse> {
    const response = await axiosInstance.get<DirectoryContentResponse>(`/api/directory/${directoryId}`);
    return response.data;
  },

  /**
   * Creates a directory
   */
  async createDirectory(name: string, parentDirectoryId: string | number | null): Promise<number | string> {
    const response = await axiosInstance.post<number | string>("/api/directory", {
      name,
      parentDirectoryId
    });
    return response.data;
  },

  /**
   * Retrieves the sample directory belonging to the authenticated user
   */
  async fetchSampleDirectory(): Promise<DirectoryItem> {
    const response = await axiosInstance.get<DirectoryItem>("/api/directory/sample");
    return {
      ...response.data,
      type: 'directory' as const
    };
  },

  /**
   * Deletes a directory
   */
  async deleteDirectory(directoryId: string | number): Promise<void> {
    await axiosInstance.delete(`/api/directory/${directoryId}`);
  }
};
