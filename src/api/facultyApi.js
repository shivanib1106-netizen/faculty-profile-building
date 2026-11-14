import apiClient from './apiClient';

export const facultyApi = {
  getProfile: () => apiClient.get('/faculty/profile'),

  updatePersonalInfo: (personalData) =>
    apiClient.put('/faculty/profile/personal', personalData),

  getQualifications: () => apiClient.get('/faculty/qualifications'),

  addQualification: (record) => apiClient.post('/faculty/qualifications', record),

  updateQualification: (id, record) =>
    apiClient.put(`/faculty/qualifications/${id}`, record),

  deleteQualification: (id) => apiClient.delete(`/faculty/qualifications/${id}`),

  getExperience: () => apiClient.get('/faculty/experience'),

  addExperience: (record) => apiClient.post('/faculty/experience', record),

  updateExperience: (id, record) =>
    apiClient.put(`/faculty/experience/${id}`, record),

  deleteExperience: (id) => apiClient.delete(`/faculty/experience/${id}`),

  getDashboardSummary: () => apiClient.get('/faculty/dashboard/summary'),
};

export default facultyApi;
