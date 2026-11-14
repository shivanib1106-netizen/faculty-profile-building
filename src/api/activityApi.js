import apiClient from './apiClient';

const buildQuery = (filters = {}) => {
  const params = new URLSearchParams();
  ['category', 'academicYear', 'status', 'search'].forEach((key) => {
    const value = filters[key];
    if (value && value !== 'all') params.append(key, value);
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
};

export const activityApi = {
  getActivities: (filters = {}) => apiClient.get(`/activities${buildQuery(filters)}`),

  getActivityById: (id) => apiClient.get(`/activities/${id}`),

  createActivity: (activityData) => apiClient.post('/activities', activityData),

  updateActivity: (id, activityData) => apiClient.put(`/activities/${id}`, activityData),

  deleteActivity: (id) => apiClient.delete(`/activities/${id}`),

  submitActivity: (id) => apiClient.post(`/activities/${id}/submit`, {}),
};

export default activityApi;
