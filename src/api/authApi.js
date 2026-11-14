import apiClient, { removeToken } from './apiClient';

export const authApi = {
  login: ({ identifier, password }) =>
    apiClient.post('/auth/login', { identifier, password }),

  register: (userData) => apiClient.post('/auth/register', userData),

  forgotPassword: (email) => apiClient.post('/auth/forgot-password', { email }),

  resetPassword: (token, newPassword) =>
    apiClient.post('/auth/reset-password', { token, newPassword }),

  changePassword: (oldPassword, newPassword) =>
    apiClient.post('/auth/change-password', { oldPassword, newPassword }),

  getCurrentUser: () => apiClient.get('/auth/me'),

  logout: async () => {
    try {
      await apiClient.post('/auth/logout', {});
    } catch {
      // A failed logout call must never keep the local session alive.
    } finally {
      removeToken();
    }
  },
};

export default authApi;
