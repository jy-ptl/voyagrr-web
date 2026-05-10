import axiosInstance from "@/api/axiosInstance";
import type { AuthResponse } from "@/types/auth";

export const authService = {
  /**
   * Logs in a user
   */
  async login(credentials: Record<string, unknown>): Promise<AuthResponse> {
    const response = await axiosInstance.post<AuthResponse>("/api/auth/login", credentials);
    return typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
  },

  /**
   * Registers a new user
   */
  async signup(userData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response = await axiosInstance.post<Record<string, unknown>>("/api/auth/register", userData);
    return response.data;
  }
};
