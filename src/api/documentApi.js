import apiClient from './apiClient';

export const documentApi = {
  getDocuments: () => apiClient.get('/documents'),

  uploadDocument: (formData) => apiClient.post('/documents/upload', formData),

  deleteDocument: (id) => apiClient.delete(`/documents/${id}`),

  downloadDocument: (id) =>
    apiClient.download(`/documents/${id}/download`),
};

export default documentApi;
