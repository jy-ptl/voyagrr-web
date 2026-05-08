import axios from 'axios';
import { store } from '../store';
import { setAuth, clearAuth } from '../store/slices/authSlice';
import keycloak from '../auth/keycloak';

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

axiosInstance.interceptors.request.use(
  (config) => {
    const state = store.getState();
    const token = state.auth.token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling 401 errors
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If the error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Attempt to refresh the token using Keycloak
        // Passing -1 to force refresh if the token is already expired
        await keycloak.updateToken(-1);
        
        const newToken = keycloak.token;
        if (newToken) {
          // Update Redux store with the new tokens
          store.dispatch(setAuth({
            token: newToken,
            refreshToken: keycloak.refreshToken,
            user: store.getState().auth.user,
          }));

          // Update the original request's header and retry
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return axiosInstance(originalRequest);
        }
      } catch (refreshError) {
        // If refresh fails (e.g., refresh token expired), log out the user
        console.error('Session expired, logging out...', refreshError);
        store.dispatch(clearAuth());
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
