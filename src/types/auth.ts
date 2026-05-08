export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  id_token?: string;
  expires_in: number;
  refresh_expires_in: number;
  token_type: string;
  session_state: string;
  scope: string;
}

export interface User {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
}
