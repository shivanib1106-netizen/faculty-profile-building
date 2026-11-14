import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { facultyApi } from '../api/facultyApi';

export const Qualifications = () => {
  const [qualifications, setQualifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    degree: '',
    specialization: '',
    university: '',
    yearOfPassing: '',
    percentageOrCgpa: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Confirm State
  const [deleteId, setDeleteId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await facultyApi.getQualifications();
      setQualifications(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load educational qualifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      degree: '',
      specialization: '',
      university: '',
      yearOfPassing: new Date().getFullYear().toString(),
      percentageOrCgpa: '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      degree: item.degree || '',
      specialization: item.specialization || '',
      university: item.university || '',
      yearOfPassing: item.yearOfPassing || '',
      percentageOrCgpa: item.percentageOrCgpa || '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const validate = () => {
    const errs = {};
    if (!formData.degree.trim()) errs.degree = 'Degree title is required (e.g., Ph.D., M.Tech).';
    if (!formData.specialization.trim()) errs.specialization = 'Specialization field is required.';
    if (!formData.university.trim()) errs.university = 'University or Board name is required.';
    if (!formData.yearOfPassing.trim()) errs.yearOfPassing = 'Year of passing is required.';
    if (!formData.percentageOrCgpa.trim()) errs.percentageOrCgpa = 'Marks or CGPA is required.';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      if (editingItem) {
        await facultyApi.updateQualification(editingItem.id, formData);
        setQualifications((prev) =>
          prev.map((q) => (q.id === editingItem.id ? { ...q, ...formData } : q))
        );
        setSuccess('Qualification updated successfully.');
      } else {
        const res = await facultyApi.addQualification(formData);
        if (res?.data) {
          setQualifications((prev) => [...prev, res.data]);
        } else {
          await loadData();
        }
        setSuccess('New qualification record added.');
      }
      setIsModalOpen(false);
    } catch (err) {
      setError(err.message || 'Failed to save qualification record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsSubmitting(true);
    try {
      await facultyApi.deleteQualification(deleteId);
      setQualifications((prev) => prev.filter((q) => q.id !== deleteId));
      setSuccess('Qualification deleted.');
      setDeleteId(null);
    } catch (err) {
      setError(err.message || 'Failed to delete record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout title="Educational Qualifications">
      <div className="page-header">
        <div className="page-header-title-group">
          <h1>Educational Qualifications</h1>
          <p className="page-header-subtitle">
            Degrees, certificates, and academic honors supporting your faculty profile
          </p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-primary" onClick={openAddModal}>
            + Add Qualification
          </button>
        </div>
      </div>

      <ErrorMessage message={error} onRetry={loadData} />

      {success && (
        <div className="alert-box alert-box-success" role="alert">
          {success}
        </div>
      )}

      {loading ? (
        <Loading message="Loading qualifications..." />
      ) : qualifications.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎓</div>
          <h3 className="empty-state-title">No Qualifications Listed</h3>
          <p className="empty-state-description">
            Add your Bachelor's, Master's, Doctoral degrees or postgraduate diplomas.
          </p>
          <button type="button" className="btn btn-primary" onClick={openAddModal}>
            + Add Your First Qualification
          </button>
        </div>
      ) : (
        <div className="academic-card">
          <div className="table-responsive">
            <table className="academic-table">
              <thead>
                <tr>
                  <th>Degree / Diploma</th>
                  <th>Specialization</th>
                  <th>University / Institute</th>
                  <th>Year of Passing</th>
                  <th>CGPA / Percentage</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {qualifications.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="table-cell-title">{item.degree}</div>
                    </td>
                    <td>{item.specialization}</td>
                    <td>{item.university}</td>
                    <td>{item.yearOfPassing}</td>
                    <td>
                      <span className="status-pill status-submitted">
                        {item.percentageOrCgpa}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="table-btn"
                          onClick={() => openEditModal(item)}
                        >
                          ✎ Edit
                        </button>
                        <button
                          type="button"
                          className="table-btn table-btn-danger"
                          onClick={() => setDeleteId(item.id)}
                        >
                          🗑 Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Edit Educational Qualification' : 'Add New Educational Qualification'}
      >
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label required" htmlFor="degree">
              Degree / Award Name
            </label>
            <input
              id="degree"
              type="text"
              className={`form-control ${formErrors.degree ? 'is-invalid' : ''}`}
              placeholder="e.g. Ph.D., M.Tech, M.S., B.E., B.Tech"
              value={formData.degree}
              onChange={(e) => setFormData({ ...formData, degree: e.target.value })}
              disabled={isSubmitting}
            />
            {formErrors.degree && <span className="form-error">{formErrors.degree}</span>}
          </div>

          <div className="form-group">
            <label className="form-label required" htmlFor="specialization">
              Branch / Specialization
            </label>
            <input
              id="specialization"
              type="text"
              className={`form-control ${formErrors.specialization ? 'is-invalid' : ''}`}
              placeholder="e.g. Computer Science, VLSI, Artificial Intelligence"
              value={formData.specialization}
              onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
              disabled={isSubmitting}
            />
            {formErrors.specialization && (
              <span className="form-error">{formErrors.specialization}</span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label required" htmlFor="university">
              Awarding University / Institute
            </label>
            <input
              id="university"
              type="text"
              className={`form-control ${formErrors.university ? 'is-invalid' : ''}`}
              placeholder="e.g. Indian Institute of Technology, Bombay"
              value={formData.university}
              onChange={(e) => setFormData({ ...formData, university: e.target.value })}
              disabled={isSubmitting}
            />
            {formErrors.university && <span className="form-error">{formErrors.university}</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label required" htmlFor="yearOfPassing">
                Year of Passing
              </label>
              <input
                id="yearOfPassing"
                type="number"
                min="1950"
                max="2035"
                className={`form-control ${formErrors.yearOfPassing ? 'is-invalid' : ''}`}
                value={formData.yearOfPassing}
                onChange={(e) => setFormData({ ...formData, yearOfPassing: e.target.value })}
                disabled={isSubmitting}
              />
              {formErrors.yearOfPassing && (
                <span className="form-error">{formErrors.yearOfPassing}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label required" htmlFor="percentageOrCgpa">
                Percentage or CGPA
              </label>
              <input
                id="percentageOrCgpa"
                type="text"
                className={`form-control ${formErrors.percentageOrCgpa ? 'is-invalid' : ''}`}
                placeholder="e.g. 9.4 CGPA or 78.5%"
                value={formData.percentageOrCgpa}
                onChange={(e) =>
                  setFormData({ ...formData, percentageOrCgpa: e.target.value })
                }
                disabled={isSubmitting}
              />
              {formErrors.percentageOrCgpa && (
                <span className="form-error">{formErrors.percentageOrCgpa}</span>
              )}
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : editingItem ? 'Update Qualification' : 'Add Record'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Remove Qualification"
        message="Are you sure you want to delete this qualification record? This action cannot be undone."
        confirmText="Yes, Delete"
        confirmVariant="danger"
        isLoading={isSubmitting}
      />
    </Layout>
  );
};

export default Qualifications;
