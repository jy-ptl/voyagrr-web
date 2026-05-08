import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { User } from '@/types/auth';

interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  loading: boolean;
}

const savedToken = localStorage.getItem('voyagrr_token');
const savedRefreshToken = localStorage.getItem('voyagrr_refresh_token');
const savedUser = localStorage.getItem('voyagrr_user');

const initialState: AuthState = {
  isAuthenticated: !!savedToken,
  token: savedToken,
  refreshToken: savedRefreshToken,
  user: savedUser ? JSON.parse(savedUser) : null,
  loading: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuth: (state, action: PayloadAction<{ token: string; refreshToken?: string; user: AuthState['user'] }>) => {
      state.isAuthenticated = true;
      state.token = action.payload.token;
      if (action.payload.refreshToken) {
        state.refreshToken = action.payload.refreshToken;
        localStorage.setItem('voyagrr_refresh_token', action.payload.refreshToken);
      }
      state.user = action.payload.user;
      localStorage.setItem('voyagrr_token', action.payload.token);
      localStorage.setItem('voyagrr_user', JSON.stringify(action.payload.user));
    },
    clearAuth: (state) => {
      state.isAuthenticated = false;
      state.token = null;
      state.refreshToken = null;
      state.user = null;
      localStorage.removeItem('voyagrr_token');
      localStorage.removeItem('voyagrr_refresh_token');
      localStorage.removeItem('voyagrr_user');
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
  },
});

export const { setAuth, clearAuth, setLoading } = authSlice.actions;
export default authSlice.reducer;
