import axiosInstance from "@/api/axiosInstance";

export interface UserSearchResponse {
  keycloakUserId: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
}

export const userService = {
  /**
   * Searches for users by username or email
   */
  async searchUsers(query: string): Promise<UserSearchResponse[]> {
    if (!query) return [];
    const response = await axiosInstance.get<UserSearchResponse[]>(`/api/user/search?query=${encodeURIComponent(query)}`);
    return response.data;
  },

  /**
   * Gets a user by their Keycloak ID
   */
  async getUserById(userId: string): Promise<UserSearchResponse> {
    const response = await axiosInstance.get<UserSearchResponse>(`/api/user/${userId}`);
    return response.data;
  },

  /**
   * Gets multiple users by their Keycloak IDs
   */
  async getUsersInfoBatch(userIds: string[]): Promise<UserSearchResponse[]> {
    if (!userIds || userIds.length === 0) return [];
    const response = await axiosInstance.post<UserSearchResponse[]>(`/api/user/info/batch`, userIds);
    return response.data;
  }
};

