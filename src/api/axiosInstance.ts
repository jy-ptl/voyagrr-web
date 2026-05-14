import axios from 'axios';
import { store } from '../store';
import { setAuth, clearAuth } from '../store/slices/authSlice';

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

axiosInstance.interceptors.request.use(
  (config) => {
    const state = store.getState();
    const token = state.auth.token;
    
    // Only add Authorization header if it's not already present
    // This allows retries in the response interceptor to provide their own token
    if (token && !config.headers.Authorization) {
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

    // If the error is 401 OR if it's a "Network Error" without a response 
    // (the browser often masks 401s as CORS/Network errors when headers are missing)
    const is401 = error.response?.status === 401;
    const isPotentialCORS401 = !error.response && error.message === 'Network Error';

    if ((is401 || isPotentialCORS401) && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const state = store.getState();
        const currentRefreshToken = state.auth.refreshToken;
        
        if (!currentRefreshToken) {
          throw new Error('No refresh token available');
        }

        const refreshUrl = `${import.meta.env.VITE_API_BASE_URL || ''}/api/auth/refresh`;

        // Attempt to refresh the token using api
        const response = await axios.post(refreshUrl, {
          refreshToken: currentRefreshToken
        });
        
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        const newToken = data.access_token;
        const newRefreshToken = data.refresh_token;

        if (newToken) {
          // Update Redux store with the new tokens
          store.dispatch(setAuth({
            token: newToken,
            refreshToken: newRefreshToken,
            user: store.getState().auth.user,
          }));

          // Update the original request's header and retry
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return axiosInstance(originalRequest);
        }
      } catch (refreshError: unknown) {
        // If refresh fails (e.g., refresh token expired), log out the user
        store.dispatch(clearAuth());
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
