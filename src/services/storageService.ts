import axiosInstance from "@/api/axiosInstance";

export const storageService = {
  /**
   * Uploads a file to a specified directory
   */
  async uploadFile(file: File, directoryId: string | number | null, onProgress?: (progress: number) => void): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    
    const url = `/api/storage/upload?name=${encodeURIComponent(file.name)}&directoryId=${directoryId || ''}`;
    const response = await axiosInstance.post<string>(url, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      }
    });
    return response.data;
  },

  /**
   * Uploads multiple files to a specified directory
   */
  async uploadFilesBatch(files: FileList | File[], directoryId: string | number | null, onProgress?: (progress: number) => void): Promise<string> {
    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append("files", file);
    });
    
    const url = `/api/storage/upload/batch?directoryId=${directoryId || ''}`;
    const response = await axiosInstance.post<string>(url, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      }
    });
    return response.data;
  },

  /**
   * Deletes a file
   */
  async deleteFile(fileId: string | number): Promise<void> {
    await axiosInstance.delete(`/api/storage/${fileId}`);
  },

  /**
   * Downloads a file
   */
  async downloadFile(fileId: string | number): Promise<Blob> {
    const response = await axiosInstance.get(`/api/storage/${fileId}`, {
      responseType: 'blob'
    });
    return response.data;
  },

  /**
   * Fetches a thumbnail for a file
   */
  async getThumbnail(fileId: string | number): Promise<Blob> {
    const response = await axiosInstance.get(`/api/storage/${fileId}/thumbnail`, {
      responseType: 'blob'
    });
    return response.data;
  }
};
