import apiClient from './apiClient';

export const adminApi = {
  getSystemMetrics: () => apiClient.get('/admin/metrics'),

  getUsers: () => apiClient.get('/admin/users'),
  createUser: (userData) => apiClient.post('/admin/users', userData),
  updateUser: (id, userData) => apiClient.put(`/admin/users/${id}`, userData),
  toggleUserStatus: (id) => apiClient.patch(`/admin/users/${id}/status`, {}),

  getFacultyManagementList: () => apiClient.get('/admin/faculty'),

  getDepartments: () => apiClient.get('/admin/departments'),
  createDepartment: (deptData) => apiClient.post('/admin/departments', deptData),
  updateDepartment: (id, deptData) => apiClient.put(`/admin/departments/${id}`, deptData),

  getAcademicYears: () => apiClient.get('/admin/academic-years'),
  createAcademicYear: (yearData) => apiClient.post('/admin/academic-years', yearData),
  setActiveAcademicYear: (id) => apiClient.patch(`/admin/academic-years/${id}/set-active`, {}),

  getScoringRules: () => apiClient.get('/admin/scoring-rules'),
  updateScoringRule: (id, ruleData) => apiClient.put(`/admin/scoring-rules/${id}`, ruleData),

  getActivityCategories: () => apiClient.get('/admin/activity-categories'),
  createActivityCategory: (data) => apiClient.post('/admin/activity-categories', data),
  updateActivityCategory: (id, data) => apiClient.put(`/admin/activity-categories/${id}`, data),

  getAuditLogs: () => apiClient.get('/admin/audit-logs'),

  getSettings: () => apiClient.get('/admin/settings'),
  updateSettings: (settings) => apiClient.put('/admin/settings', settings),
};

export default adminApi;
