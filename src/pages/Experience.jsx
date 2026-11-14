import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { facultyApi } from '../api/facultyApi';

export const Experience = () => {
  const [experiences, setExperiences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    institution: '',
    designation: '',
    employmentType: 'Full-Time Regular',
    startDate: '',
    endDate: '',
    isCurrent: false,
    totalExperience: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Confirm State
  const [deleteId, setDeleteId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await facultyApi.getExperience();
      setExperiences(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load experience records.');
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
      institution: '',
      designation: '',
      employmentType: 'Full-Time Regular',
      startDate: '',
      endDate: '',
      isCurrent: false,
      totalExperience: '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      institution: item.institution || '',
      designation: item.designation || '',
      employmentType: item.employmentType || 'Full-Time Regular',
      startDate: item.startDate || '',
      endDate: item.endDate || '',
      isCurrent: Boolean(item.isCurrent),
      totalExperience: item.totalExperience || '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const validate = () => {
    const errs = {};
    if (!formData.institution.trim()) errs.institution = 'Institution or organization name is required.';
    if (!formData.designation.trim()) errs.designation = 'Designation/Rank is required.';
    if (!formData.startDate) errs.startDate = 'Start date is required.';
    if (!formData.isCurrent && !formData.endDate) {
      errs.endDate = 'End date is required unless currently employed here.';
    }
    if (formData.startDate && formData.endDate && formData.startDate > formData.endDate) {
      errs.endDate = 'End date cannot be prior to start date.';
    }
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
        await facultyApi.updateExperience(editingItem.id, formData);
        setExperiences((prev) =>
          prev.map((exp) => (exp.id === editingItem.id ? { ...exp, ...formData } : exp))
        );
        setSuccess('Experience record updated successfully.');
      } else {
        const res = await facultyApi.addExperience(formData);
        if (res?.data) {
          setExperiences((prev) => [...prev, res.data]);
        } else {
          await loadData();
        }
        setSuccess('New work experience record added.');
      }
      setIsModalOpen(false);
    } catch (err) {
      setError(err.message || 'Failed to save experience details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsSubmitting(true);
    try {
      await facultyApi.deleteExperience(deleteId);
      setExperiences((prev) => prev.filter((exp) => exp.id !== deleteId));
      setSuccess('Experience record deleted.');
      setDeleteId(null);
    } catch (err) {
      setError(err.message || 'Failed to delete record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout title="Work Experience">
      <div className="page-header">
        <div className="page-header-title-group">
          <h1>Work &amp; Teaching Experience</h1>
          <p className="page-header-subtitle">
            Document your chronological academic appointments, industry roles, and total service duration
          </p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-primary" onClick={openAddModal}>
            + Add Experience Record
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
        <Loading message="Loading work experience..." />
      ) : experiences.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">💼</div>
          <h3 className="empty-state-title">No Experience Recorded</h3>
          <p className="empty-state-description">
            Add current and previous teaching, research, or industry appointments.
          </p>
          <button type="button" className="btn btn-primary" onClick={openAddModal}>
            + Add First Appointment
          </button>
        </div>
      ) : (
        <div className="academic-card">
          <div className="table-responsive">
            <table className="academic-table">
              <thead>
                <tr>
                  <th>Institution / Employer</th>
                  <th>Designation</th>
                  <th>Employment Type</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Total Duration</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {experiences.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="table-cell-title">{item.institution}</div>
                    </td>
                    <td>{item.designation}</td>
                    <td>{item.employmentType}</td>
                    <td>{item.startDate}</td>
                    <td>
                      {item.isCurrent ? (
                        <span className="status-pill status-approved">Present (Current)</span>
                      ) : (
                        item.endDate || 'N/A'
                      )}
                    </td>
                    <td>{item.totalExperience || 'Calculated in PBAS'}</td>
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

      {/* Add / Edit Experience Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Edit Work Experience' : 'Add Work Experience Record'}
      >
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label required" htmlFor="institution">
              Institution / Organization Name
            </label>
            <input
              id="institution"
              type="text"
              className={`form-control ${formErrors.institution ? 'is-invalid' : ''}`}
              placeholder="e.g. City College of Engineering, Pune"
              value={formData.institution}
              onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
              disabled={isSubmitting}
            />
            {formErrors.institution && (
              <span className="form-error">{formErrors.institution}</span>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label required" htmlFor="designation">
                Designation / Position
              </label>
              <input
                id="designation"
                type="text"
                className={`form-control ${formErrors.designation ? 'is-invalid' : ''}`}
                placeholder="e.g. Associate Professor / Senior Lecturer"
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                disabled={isSubmitting}
              />
              {formErrors.designation && (
                <span className="form-error">{formErrors.designation}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label required" htmlFor="employmentType">
                Nature of Appointment
              </label>
              <select
                id="employmentType"
                className="form-control"
                value={formData.employmentType}
                onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })}
                disabled={isSubmitting}
              >
                <option value="Full-Time Regular">Full-Time Regular</option>
                <option value="Full-Time Permanent">Full-Time Permanent</option>
                <option value="Contractual / Tenure">Contractual / Tenure</option>
                <option value="Adjunct / Visiting">Adjunct / Visiting</option>
                <option value="Postdoctoral Fellow">Postdoctoral Fellow</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label required" htmlFor="startDate">
                Start Date
              </label>
              <input
                id="startDate"
                type="date"
                className={`form-control ${formErrors.startDate ? 'is-invalid' : ''}`}
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                disabled={isSubmitting}
              />
              {formErrors.startDate && <span className="form-error">{formErrors.startDate}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="endDate">
                End Date
              </label>
              <input
                id="endDate"
                type="date"
                className={`form-control ${formErrors.endDate ? 'is-invalid' : ''}`}
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                disabled={formData.isCurrent || isSubmitting}
              />
              {formErrors.endDate && <span className="form-error">{formErrors.endDate}</span>}
            </div>
          </div>

          <div className="form-group">
            <label className="form-checkbox-label">
              <input
                type="checkbox"
                className="form-checkbox"
                checked={formData.isCurrent}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setFormData({
                    ...formData,
                    isCurrent: checked,
                    endDate: checked ? '' : formData.endDate,
                  });
                }}
                disabled={isSubmitting}
              />
              I am currently working in this role / institution
            </label>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="totalExperience">
              Approximate Total Experience (Optional)
            </label>
            <input
              id="totalExperience"
              type="text"
              className="form-control"
              placeholder="e.g. 4 years 6 months"
              value={formData.totalExperience}
              onChange={(e) => setFormData({ ...formData, totalExperience: e.target.value })}
              disabled={isSubmitting}
            />
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
              {isSubmitting ? 'Saving...' : editingItem ? 'Update Experience' : 'Add Record'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Remove Experience"
        message="Are you sure you want to delete this experience record? This action cannot be undone."
        confirmText="Yes, Delete"
        confirmVariant="danger"
        isLoading={isSubmitting}
      />
    </Layout>
  );
};

export default Experience;
