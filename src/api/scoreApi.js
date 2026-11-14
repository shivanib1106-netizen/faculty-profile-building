import apiClient from './apiClient';

export const scoreApi = {
  /**
   * Official scores are calculated by the Flask backend only.
   * The frontend never derives or adjusts these values.
   */
  getApiScore: (academicYear) => {
    const qs = academicYear ? `?academicYear=${encodeURIComponent(academicYear)}` : '';
    return apiClient.get(`/scores${qs}`);
  },

  getCategoryScore: (categoryKey, academicYear) => {
    const qs = academicYear ? `?academicYear=${encodeURIComponent(academicYear)}` : '';
    return apiClient.get(`/scores/category/${categoryKey}${qs}`);
  },
};

export default scoreApi;
