import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { activityApi } from '../api/activityApi';
import { useAcademicYears } from '../hooks/useReferenceData';

export const CategoryII = () => {
  const { years, activeYear } = useAcademicYears();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal and Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const initialForm = {
    activityType: 'Workshops & FDPs',
    title: '',
    academicYear: '',
    role: 'Participant',
    organizingBody: '',
    durationDays: '5',
    activityDate: new Date().toISOString().split('T')[0],
    endDate: '',
    details: '',
    documentName: '',
  };

  const [formData, setFormData] = useState(initialForm);
  const [formErrors, setFormErrors] = useState({});

  const activityTypes = [
    'Workshops & FDPs',
    'Extension Activities',
    'Community Engagement',
    'NSS and NCC Activities',
    'Seminars & Symposia',
    'National / International Conferences',
    'Professional Development Programmes',
    'Institutional Responsibilities (Dean, HOD, Coordinator)',
  ];

  const roles = [
    'Participant',
    'Convenor / Coordinator',
    'Resource Person / Speaker',
    'Organizing Committee Member',
    'Session Chair',
  ];

  const loadActivities = async () => {
    setLoading(true);
    setError('');
    try {
      const all = await activityApi.getActivities({ category: 'Category II' });
      setActivities(all || []);
    } catch (err) {
      setError(err.message || 'Failed to load Category II activities.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, []);

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({ ...initialForm, academicYear: activeYear });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    if (item.status === 'Approved') {
      alert('Approved activities cannot be modified.');
      return;
    }
    setEditingItem(item);
    setFormData({
      activityType: item.activityType || 'Workshops & FDPs',
      title: item.title || '',
      academicYear: item.academicYear || activeYear,
      role: item.role || 'Participant',
      organizingBody: item.organizingBody || '',
      durationDays: item.durationDays || '5',
      activityDate: item.activityDate || '',
      endDate: item.endDate || '',
      details: item.details || '',
      documentName: item.documentName || '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const validate = () => {
    const errs = {};
    if (!formData.title.trim()) errs.title = 'Activity or Programme title is required.';
    if (!formData.academicYear) errs.academicYear = 'Academic year is required.';
    if (!formData.activityDate) errs.activityDate = 'Start date is required.';
    if (!formData.details.trim()) errs.details = 'Relevant description is required.';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async (submitStatus = 'Draft') => {
    setError('');
    setSuccess('');

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        category: 'Category II',
        categoryKey: 'cat2',
        status: submitStatus,
      };

      if (editingItem) {
        await activityApi.updateActivity(editingItem.id, payload);
        setActivities((prev) =>
          prev.map((a) => (a.id === editingItem.id ? { ...a, ...payload } : a))
        );
        setSuccess(`Activity updated and saved as ${submitStatus}.`);
      } else {
        const res = await activityApi.createActivity(payload);
        if (res?.data) {
          setActivities((prev) => [res.data, ...prev]);
        } else {
          await loadActivities();
        }
        setSuccess(`Activity created and saved as ${submitStatus}.`);
      }
      setIsModalOpen(false);
    } catch (err) {
      setError(err.message || 'Failed to save Category II activity.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsSubmitting(true);
    try {
      await activityApi.deleteActivity(deleteId);
      setActivities((prev) => prev.filter((a) => a.id !== deleteId));
      setSuccess('Activity deleted.');
      setDeleteId(null);
    } catch (err) {
      setError(err.message || 'Failed to delete activity.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitForVerification = async (id) => {
    try {
      await activityApi.submitActivity(id);
      setActivities((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'Pending' } : a))
      );
      setSuccess('Activity submitted for HOD verification.');
    } catch (err) {
      setError(err.message || 'Failed to submit activity.');
    }
  };

  return (
    <Layout title="Category II – Co-curricular, Extension & Professional Development">
      <div className="page-header">
        <div className="page-header-title-group">
          <h1>Category II: Co-curricular, Extension &amp; Professional Development</h1>
          <p className="page-header-subtitle">
            Record FDPs, workshops, seminars, student club guidance, institutional committees, and community outreach
          </p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-primary" onClick={openAddModal}>
            + Add Category II Activity
          </button>
        </div>
      </div>

      <ErrorMessage message={error} onRetry={loadActivities} />

      {success && (
        <div className="alert-box alert-box-success" role="alert">
          {success}
        </div>
      )}

      <div className="alert-box alert-box-info">
        <span>ℹ️</span>
        <div>
          <strong>PBAS Guidelines for Category II:</strong> Includes co-curricular duties, student cultural/sports leadership, membership in institutional committees, and attending or organizing FDPs (&gt;1 week / 5 days duration recommended for full credits).
        </div>
      </div>

      {loading ? (
        <Loading message="Loading Category II records..." />
      ) : activities.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🤝</div>
          <h3 className="empty-state-title">No Category II Activities Logged</h3>
          <p className="empty-state-description">
            Submit your completed FDP certificates, workshop participation, or committee appointment orders.
          </p>
          <button type="button" className="btn btn-primary" onClick={openAddModal}>
            + Add First Activity
          </button>
        </div>
      ) : (
        <div className="academic-card">
          <div className="table-responsive">
            <table className="academic-table">
              <thead>
                <tr>
                  <th>Title &amp; Type</th>
                  <th>Role</th>
                  <th>Academic Year</th>
                  <th>Date &amp; Duration</th>
                  <th>Proof Document</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="table-cell-title">{item.title}</div>
                      <div className="table-cell-subtext">{item.activityType}</div>
                      {item.remarks && (
                        <div className="form-hint">
                          <strong>Remarks:</strong> {item.remarks}
                        </div>
                      )}
                    </td>
                    <td>{item.role || 'Participant'}</td>
                    <td>{item.academicYear}</td>
                    <td>{item.activityDate}</td>
                    <td>
                      {item.documentName ? (
                        <span className="file-meta-name">📎 {item.documentName}</span>
                      ) : (
                        <span className="text-muted">No proof</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>
                      <div className="table-actions">
                        {(item.status === 'Draft' || item.status === 'Rejected') && (
                          <button
                            type="button"
                            className="table-btn table-btn-primary"
                            onClick={() => handleSubmitForVerification(item.id)}
                            title="Submit for HOD Verification"
                          >
                            Submit
                          </button>
                        )}
                        {(item.status === 'Draft' || item.status === 'Rejected') && (
                          <button
                            type="button"
                            className="table-btn"
                            onClick={() => openEditModal(item)}
                          >
                            ✎ Edit
                          </button>
                        )}
                        {(item.status === 'Draft' || item.status === 'Rejected') && (
                          <button
                            type="button"
                            className="table-btn table-btn-danger"
                            onClick={() => setDeleteId(item.id)}
                          >
                            🗑 Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Category II Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Edit Category II Activity' : 'Record Category II Activity'}
        size="lg"
      >
        <form onSubmit={(e) => e.preventDefault()}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label required" htmlFor="activityType">
                Activity Type
              </label>
              <select
                id="activityType"
                className="form-control"
                value={formData.activityType}
                onChange={(e) => setFormData({ ...formData, activityType: e.target.value })}
                disabled={isSubmitting}
              >
                {activityTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label required" htmlFor="academicYear">
                Academic Year
              </label>
              <select
                id="academicYear"
                className="form-control"
                value={formData.academicYear}
                onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                disabled={isSubmitting}
              >
                <option value="">Select academic year</option>
                {years.map((year) => (
                  <option key={year.id || year.year} value={year.year}>
                    {year.year}
                    {year.status === 'Active' ? ' (Active)' : ''}
                  </option>
                ))}
              </select>
              {formErrors.academicYear && (
                <span className="form-error">{formErrors.academicYear}</span>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label required" htmlFor="title">
              Programme / Committee / Activity Title
            </label>
            <input
              id="title"
              type="text"
              className={`form-control ${formErrors.title ? 'is-invalid' : ''}`}
              placeholder="e.g. 1-Week National FDP on Generative AI & Cloud Architecture"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              disabled={isSubmitting}
            />
            {formErrors.title && <span className="form-error">{formErrors.title}</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="role">
                Role / Capacity
              </label>
              <select
                id="role"
                className="form-control"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                disabled={isSubmitting}
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="organizingBody">
                Organizing Institution / Agency
              </label>
              <input
                id="organizingBody"
                type="text"
                className="form-control"
                placeholder="e.g. AICTE ATAL / IEEE Bombay Section / NIT Surat"
                value={formData.organizingBody}
                onChange={(e) => setFormData({ ...formData, organizingBody: e.target.value })}
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="durationDays">
                Duration (Days / Hours)
              </label>
              <input
                id="durationDays"
                type="text"
                className="form-control"
                placeholder="e.g. 5 Days (40 Hours)"
                value={formData.durationDays}
                onChange={(e) => setFormData({ ...formData, durationDays: e.target.value })}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label required" htmlFor="activityDate">
                Start Date
              </label>
              <input
                id="activityDate"
                type="date"
                className={`form-control ${formErrors.activityDate ? 'is-invalid' : ''}`}
                value={formData.activityDate}
                onChange={(e) => setFormData({ ...formData, activityDate: e.target.value })}
                disabled={isSubmitting}
              />
              {formErrors.activityDate && (
                <span className="form-error">{formErrors.activityDate}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="endDate">
                End Date (Optional)
              </label>
              <input
                id="endDate"
                type="date"
                className="form-control"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label required" htmlFor="details">
              Detailed Description &amp; Contribution
            </label>
            <textarea
              id="details"
              className={`form-control ${formErrors.details ? 'is-invalid' : ''}`}
              placeholder="Outline specific responsibilities, committee mandate, outcomes achieved, or modules completed..."
              value={formData.details}
              onChange={(e) => setFormData({ ...formData, details: e.target.value })}
              disabled={isSubmitting}
            />
            {formErrors.details && <span className="form-error">{formErrors.details}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="cat2Doc">
              Supporting Proof Attachment (Certificate / Appointment Order)
            </label>
            <input
              id="cat2Doc"
              type="file"
              className="form-control"
              accept=".pdf,.doc,.docx,.png,.jpg"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  setFormData({ ...formData, documentName: file.name });
                }
              }}
              disabled={isSubmitting}
            />
            {formData.documentName && (
              <span className="form-hint">Selected: {formData.documentName}</span>
            )}
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
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleSave('Draft')}
              disabled={isSubmitting}
            >
              Save as Draft
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleSave('Pending')}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit for Verification'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Activity"
        message="Are you sure you want to delete this Category II entry? This action cannot be undone."
        confirmText="Delete Activity"
        confirmVariant="danger"
        isLoading={isSubmitting}
      />
    </Layout>
  );
};

export default CategoryII;
