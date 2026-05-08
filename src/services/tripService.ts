import axiosInstance from "@/api/axiosInstance";
import type { Trip, TripCreateRequest } from "@/types/trips";

export const tripService = {
  /**
   * Retrieves all trips for the authenticated user
   */
  async fetchTrips(): Promise<Trip[]> {
    // Current mock behavior or actual API if ready
    const response = await axiosInstance.get<Trip[]>("/api/trip");
    return response.data;
  },

  /**
   * Creates a new trip
   */
  async createTrip(trip: TripCreateRequest): Promise<Trip> {
    const response = await axiosInstance.post<Trip>("/api/trip", trip);
    return response.data;
  }
};
