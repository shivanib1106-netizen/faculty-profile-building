import apiClient from './apiClient';

export const notificationApi = {
  getNotifications: () => apiClient.get('/notifications'),

  markAsRead: (id) => apiClient.patch(`/notifications/${id}/read`, {}),

  markAllAsRead: () => apiClient.post('/notifications/read-all', {}),
};

export default notificationApi;
