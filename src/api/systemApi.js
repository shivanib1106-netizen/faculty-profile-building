import apiClient from './apiClient';

/**
 * Reference data shared by every role.
 * If the backend exposes these under different routes, change them here only.
 */
export const systemApi = {
  getAcademicYears: (options = {}) => apiClient.get('/academic-years', options),
  getActivityCategories: (options = {}) => apiClient.get('/activity-categories', options),
  getUploadConfig: (options = {}) => apiClient.get('/config/upload', options),
};

export default systemApi;
