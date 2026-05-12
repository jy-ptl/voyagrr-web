export interface Trip {
  id: number;
  title: string;
  description?: string;
  visibility: 'PRIVATE' | 'SHARED';
  status: 'PLANNED' | 'ONGOING' | 'COMPLETED';
  directoryId?: number;
}

export interface TripCreateRequest {
  title: string;
  description?: string;
  visibility: string;
  status: string;
  groupId?: number;
  keycloakUserIds: string[];
}
