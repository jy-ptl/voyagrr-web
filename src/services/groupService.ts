import axiosInstance from "@/api/axiosInstance";

export interface Group {
  groupId: number;
  name: string;
  ownerId: string;
  members: string[];
}

export interface GroupCreateRequest {
  name: string;
  members: string[];
}

export const groupService = {
  /**
   * Fetches all groups the user belongs to
   */
  async fetchGroups(): Promise<Group[]> {
    const response = await axiosInstance.get<Group[]>("/api/group");
    return response.data;
  },

  /**
   * Creates a new group
   */
  async createGroup(group: GroupCreateRequest): Promise<number> {
    const response = await axiosInstance.post<number>("/api/group/create", group);
    return response.data;
  },

  /**
   * Deletes a group
   */
  async deleteGroup(groupId: number): Promise<void> {
    await axiosInstance.delete(`/api/group/${groupId}`);
  },

  /**
   * Search groups by query
   */
  async searchGroups(query: string): Promise<Group[]> {
    if (!query) return [];
    const response = await axiosInstance.get<Group[]>(`/api/group/search?query=${encodeURIComponent(query)}`);
    return response.data;
  }
};
