import apiClient from './apiClient';

const buildQuery = (filters = {}) => {
  const params = new URLSearchParams();
  ['status', 'category', 'academicYear', 'search'].forEach((key) => {
    if (filters[key] && filters[key] !== 'all') params.append(key, filters[key]);
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
};

export const hodApi = {
  getDepartmentSummary: () => apiClient.get('/hod/summary'),

  getDepartmentFaculty: () => apiClient.get('/hod/faculty'),

  getFacultyDetail: (id) => apiClient.get(`/hod/faculty/${id}`),

  getFacultyScore: (id) => apiClient.get(`/hod/faculty/${id}/scores`),

  getActivitiesForVerification: (filters = {}) =>
    apiClient.get(`/hod/verifications${buildQuery(filters)}`),

  verifyActivity: (activityId, { status, remarks }) =>
    apiClient.post(`/hod/activities/${activityId}/verify`, { status, remarks }),

  getDepartmentReports: (type, academicYear) =>
    apiClient.get(
      `/hod/reports?type=${encodeURIComponent(type)}&academicYear=${encodeURIComponent(academicYear)}`
    ),

  downloadDepartmentReport: (type, academicYear) =>
    apiClient.download(
      `/hod/reports/download?type=${encodeURIComponent(type)}&academicYear=${encodeURIComponent(academicYear)}`
    ),
};

export default hodApi;
