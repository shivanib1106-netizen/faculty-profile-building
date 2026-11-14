import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { activityApi } from '../api/activityApi';
import { useAcademicYears } from '../hooks/useReferenceData';

export const CategoryI = () => {
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
    activityType: 'Teaching Workload',
    title: '',
    academicYear: '',
    courseCode: '',
    semester: 'Odd Semester',
    contactHoursPerWeek: '',
    activityDate: new Date().toISOString().split('T')[0],
    endDate: '',
    details: '',
    documentName: '',
  };

  const [formData, setFormData] = useState(initialForm);
  const [formErrors, setFormErrors] = useState({});

  const activityTypes = [
    'Teaching Workload',
    'Teaching Materials Preparation',
    'Innovative Teaching Methods',
    'Curriculum Development / BOS',
    'Examination Duties (Invigilation/Squad)',
    'Evaluation & Paper Assessment',
    'Student Mentoring & Advising',
    'Other Approved Teaching Activities',
  ];

  const loadActivities = async () => {
    setLoading(true);
    setError('');
    try {
      const all = await activityApi.getActivities({ category: 'Category I' });
      setActivities(all || []);
    } catch (err) {
      setError(err.message || 'Failed to load Category I activities.');
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
      activityType: item.activityType || 'Teaching Workload',
      title: item.title || '',
      academicYear: item.academicYear || activeYear,
      courseCode: item.courseCode || '',
      semester: item.semester || 'Odd Semester',
      contactHoursPerWeek: item.contactHoursPerWeek || '',
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
    if (!formData.title.trim()) errs.title = 'Activity title or course name is required.';
    if (!formData.academicYear) errs.academicYear = 'Academic year is required.';
    if (!formData.activityDate) errs.activityDate = 'Start date is required.';
    if (!formData.details.trim()) errs.details = 'Relevant details are required.';
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
        category: 'Category I',
        categoryKey: 'cat1',
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
      setError(err.message || 'Failed to save Category I activity.');
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
    <Layout title="Category I – Teaching, Learning and Evaluation">
      <div className="page-header">
        <div className="page-header-title-group">
          <h1>Category I: Teaching, Learning and Evaluation</h1>
          <p className="page-header-subtitle">
            Document classroom teaching, laboratory instruction, curriculum design, examination duties, and mentoring
          </p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-primary" onClick={openAddModal}>
            + Add Teaching Activity
          </button>
        </div>
      </div>

      <ErrorMessage message={error} onRetry={loadActivities} />

      {success && (
        <div className="alert-box alert-box-success" role="alert">
          {success}
        </div>
      )}

      {/* Category Criteria Alert Box */}
      <div className="alert-box alert-box-info">
        <span>ℹ️</span>
        <div>
          <strong>UGC-PBAS Guidelines for Category I:</strong> Direct teaching workload covers 16 hours/week for Assistant Professors and 14 hours/week for Associate Professors. Supporting timetable copies, syllabus coverage logs, or BoS appointment letters are required.
        </div>
      </div>

      {loading ? (
        <Loading message="Loading Category I records..." />
      ) : activities.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📖</div>
          <h3 className="empty-state-title">No Category I Activities Found</h3>
          <p className="empty-state-description">
            Start by logging your courses taught, evaluation duties, or mentoring assignments for the academic year.
          </p>
          <button type="button" className="btn btn-primary" onClick={openAddModal}>
            + Add First Teaching Activity
          </button>
        </div>
      ) : (
        <div className="academic-card">
          <div className="table-responsive">
            <table className="academic-table">
              <thead>
                <tr>
                  <th>Title &amp; Sub-Category</th>
                  <th>Academic Year</th>
                  <th>Activity Date / Term</th>
                  <th>Document Proof</th>
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
                    <td>{item.academicYear}</td>
                    <td>{item.activityDate}</td>
                    <td>
                      {item.documentName ? (
                        <span className="file-meta-name">📎 {item.documentName}</span>
                      ) : (
                        <span className="text-muted">None attached</span>
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

      {/* Add / Edit Category I Activity Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Edit Category I Activity' : 'Record Category I Teaching Activity'}
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
              Activity Title / Course Name
            </label>
            <input
              id="title"
              type="text"
              className={`form-control ${formErrors.title ? 'is-invalid' : ''}`}
              placeholder="e.g. CS701: Advanced Machine Learning & Deep Learning"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              disabled={isSubmitting}
            />
            {formErrors.title && <span className="form-error">{formErrors.title}</span>}
          </div>

          {/* Conditional specialized inputs for Teaching vs Examination */}
          {formData.activityType === 'Teaching Workload' && (
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="courseCode">
                  Course Code
                </label>
                <input
                  id="courseCode"
                  type="text"
                  className="form-control"
                  placeholder="e.g. CS701 / ME402"
                  value={formData.courseCode}
                  onChange={(e) => setFormData({ ...formData, courseCode: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="semester">
                  Semester Term
                </label>
                <select
                  id="semester"
                  className="form-control"
                  value={formData.semester}
                  onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                  disabled={isSubmitting}
                >
                  <option value="Odd Semester">Odd Semester (July - Dec)</option>
                  <option value="Even Semester">Even Semester (Jan - May)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="contactHoursPerWeek">
                  Contact Hours / Week
                </label>
                <input
                  id="contactHoursPerWeek"
                  type="number"
                  min="1"
                  max="40"
                  className="form-control"
                  placeholder="e.g. 4"
                  value={formData.contactHoursPerWeek}
                  onChange={(e) =>
                    setFormData({ ...formData, contactHoursPerWeek: e.target.value })
                  }
                  disabled={isSubmitting}
                />
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label className="form-label required" htmlFor="activityDate">
                Start Date / Activity Date
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
              Relevant Details / Pedagogical Method / Scope
            </label>
            <textarea
              id="details"
              className={`form-control ${formErrors.details ? 'is-invalid' : ''}`}
              placeholder="Describe hours covered, student feedback, syllabus percentage, or evaluation duties performed..."
              value={formData.details}
              onChange={(e) => setFormData({ ...formData, details: e.target.value })}
              disabled={isSubmitting}
            />
            {formErrors.details && <span className="form-error">{formErrors.details}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="documentName">
              Supporting Proof Attachment (PDF or Doc)
            </label>
            <input
              id="documentName"
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
        message="Are you sure you want to delete this Category I record? This action cannot be undone."
        confirmText="Delete Activity"
        confirmVariant="danger"
        isLoading={isSubmitting}
      />
    </Layout>
  );
};

export default CategoryI;
