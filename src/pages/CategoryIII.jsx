import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { activityApi } from '../api/activityApi';
import { useAcademicYears } from '../hooks/useReferenceData';

export const CategoryIII = () => {
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
    activityType: 'Research Publications',
    title: '',
    academicYear: '',
    journalOrPublisher: '',
    issnOrIsbn: '',
    indexing: 'SCI / SCIE Indexed',
    impactFactor: '',
    grantAmount: '',
    authorshipRole: 'First Author',
    activityDate: new Date().toISOString().split('T')[0],
    details: '',
    documentName: '',
  };

  const [formData, setFormData] = useState(initialForm);
  const [formErrors, setFormErrors] = useState({});

  const activityTypes = [
    'Research Publications',
    'Books and Book Chapters',
    'Patents',
    'Research Projects',
    'Research Guidance',
    'Conference Presentations',
    'Research Awards & Fellowships',
    'Consultancy Projects',
    'Other Approved Research Contributions',
  ];

  const indexingOptions = [
    'SCI / SCIE Indexed',
    'Scopus Indexed',
    'Web of Science',
    'UGC CARE Listed',
    'Peer-Reviewed Refereed',
  ];

  const authorshipOptions = [
    'First Author',
    'Corresponding Author',
    'Co-Author',
    'Principal Investigator (PI)',
    'Co-Principal Investigator (Co-PI)',
    'Sole Author',
  ];

  const loadActivities = async () => {
    setLoading(true);
    setError('');
    try {
      const all = await activityApi.getActivities({ category: 'Category III' });
      setActivities(all || []);
    } catch (err) {
      setError(err.message || 'Failed to load Category III activities.');
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
      alert('Approved research activities cannot be modified.');
      return;
    }
    setEditingItem(item);
    setFormData({
      activityType: item.activityType || 'Research Publications',
      title: item.title || '',
      academicYear: item.academicYear || activeYear,
      journalOrPublisher: item.journalOrPublisher || '',
      issnOrIsbn: item.issnOrIsbn || '',
      indexing: item.indexing || 'SCI / SCIE Indexed',
      impactFactor: item.impactFactor || '',
      grantAmount: item.grantAmount || '',
      authorshipRole: item.authorshipRole || 'First Author',
      activityDate: item.activityDate || '',
      details: item.details || '',
      documentName: item.documentName || '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const validate = () => {
    const errs = {};
    if (!formData.title.trim()) errs.title = 'Title of research paper/project/patent is required.';
    if (!formData.academicYear) errs.academicYear = 'Academic year is required.';
    if (!formData.activityDate) errs.activityDate = 'Date is required.';
    if (!formData.details.trim()) errs.details = 'Details, abstract, or registration number are required.';
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
        category: 'Category III',
        categoryKey: 'cat3',
        status: submitStatus,
      };

      if (editingItem) {
        await activityApi.updateActivity(editingItem.id, payload);
        setActivities((prev) =>
          prev.map((a) => (a.id === editingItem.id ? { ...a, ...payload } : a))
        );
        setSuccess(`Research entry updated and saved as ${submitStatus}.`);
      } else {
        const res = await activityApi.createActivity(payload);
        if (res?.data) {
          setActivities((prev) => [res.data, ...prev]);
        } else {
          await loadActivities();
        }
        setSuccess(`Research entry created and saved as ${submitStatus}.`);
      }
      setIsModalOpen(false);
    } catch (err) {
      setError(err.message || 'Failed to save Category III activity.');
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
      setSuccess('Research record deleted.');
      setDeleteId(null);
    } catch (err) {
      setError(err.message || 'Failed to delete record.');
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
      setSuccess('Research entry submitted for HOD review.');
    } catch (err) {
      setError(err.message || 'Failed to submit entry.');
    }
  };

  return (
    <Layout title="Category III – Research and Academic Contributions">
      <div className="page-header">
        <div className="page-header-title-group">
          <h1>Category III: Research &amp; Academic Contributions</h1>
          <p className="page-header-subtitle">
            Log peer-reviewed journal papers, books, patents, funded grants, PhD supervision, and consultancy
          </p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-primary" onClick={openAddModal}>
            + Add Research Contribution
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
          <strong>PBAS Guidelines for Category III:</strong> Research score claims require proof such as the published paper PDF with clear ISSN / DOI / Volume number, Patent Office publication extract, or funded project sanction order from funding agency.
        </div>
      </div>

      {loading ? (
        <Loading message="Loading Category III research records..." />
      ) : activities.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔬</div>
          <h3 className="empty-state-title">No Research Contributions Recorded</h3>
          <p className="empty-state-description">
            Add your journal articles, authored books, funded grants, or conference presentations.
          </p>
          <button type="button" className="btn btn-primary" onClick={openAddModal}>
            + Add First Research Entry
          </button>
        </div>
      ) : (
        <div className="academic-card">
          <div className="table-responsive">
            <table className="academic-table">
              <thead>
                <tr>
                  <th>Title &amp; Type</th>
                  <th>Journal / Agency</th>
                  <th>Academic Year</th>
                  <th>Date</th>
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
                    <td>
                      {item.journalOrPublisher || 'N/A'}
                      {item.issnOrIsbn && <div className="table-cell-subtext">ID: {item.issnOrIsbn}</div>}
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

      {/* Add / Edit Category III Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Edit Research Contribution' : 'Add Research Contribution'}
        size="lg"
      >
        <form onSubmit={(e) => e.preventDefault()}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label required" htmlFor="activityType">
                Research Contribution Type
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
            </div>
          </div>

          <div className="form-group">
            <label className="form-label required" htmlFor="title">
              Paper / Patent / Project / Book Title
            </label>
            <input
              id="title"
              type="text"
              className={`form-control ${formErrors.title ? 'is-invalid' : ''}`}
              placeholder="e.g. Edge AI Framework for Real-Time Plant Disease Detection"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              disabled={isSubmitting}
            />
            {formErrors.title && <span className="form-error">{formErrors.title}</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="journalOrPublisher">
                Journal / Publisher / Funding Agency
              </label>
              <input
                id="journalOrPublisher"
                type="text"
                className="form-control"
                placeholder="e.g. IEEE Transactions / Springer / DST SERB"
                value={formData.journalOrPublisher}
                onChange={(e) =>
                  setFormData({ ...formData, journalOrPublisher: e.target.value })
                }
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="issnOrIsbn">
                ISSN / ISBN / Patent App No. / Grant Sanction No.
              </label>
              <input
                id="issnOrIsbn"
                type="text"
                className="form-control"
                placeholder="e.g. ISSN 2833-2148 / Patent No. 202321078912"
                value={formData.issnOrIsbn}
                onChange={(e) => setFormData({ ...formData, issnOrIsbn: e.target.value })}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="form-row-3">
            <div className="form-group">
              <label className="form-label" htmlFor="indexing">
                Indexing Status
              </label>
              <select
                id="indexing"
                className="form-control"
                value={formData.indexing}
                onChange={(e) => setFormData({ ...formData, indexing: e.target.value })}
                disabled={isSubmitting}
              >
                {indexingOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="authorshipRole">
                Authorship / Role
              </label>
              <select
                id="authorshipRole"
                className="form-control"
                value={formData.authorshipRole}
                onChange={(e) => setFormData({ ...formData, authorshipRole: e.target.value })}
                disabled={isSubmitting}
              >
                {authorshipOptions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="impactFactor">
                Impact Factor / Grant Amount (INR)
              </label>
              <input
                id="impactFactor"
                type="text"
                className="form-control"
                placeholder="e.g. 4.8 IF or ₹ 18.5 Lakhs"
                value={formData.impactFactor}
                onChange={(e) => setFormData({ ...formData, impactFactor: e.target.value })}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label required" htmlFor="activityDate">
              Publication / Filing / Award Date
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
            <label className="form-label required" htmlFor="details">
              Abstract / Description / Scope of Contribution
            </label>
            <textarea
              id="details"
              className={`form-control ${formErrors.details ? 'is-invalid' : ''}`}
              placeholder="Provide a concise abstract, volume & page numbers, DOI link, or patent publication gazette details..."
              value={formData.details}
              onChange={(e) => setFormData({ ...formData, details: e.target.value })}
              disabled={isSubmitting}
            />
            {formErrors.details && <span className="form-error">{formErrors.details}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="cat3Doc">
              Supporting Proof Attachment (PDF of First Page / Sanction Order)
            </label>
            <input
              id="cat3Doc"
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
        title="Delete Research Entry"
        message="Are you sure you want to delete this Category III entry? This action cannot be undone."
        confirmText="Delete Entry"
        confirmVariant="danger"
        isLoading={isSubmitting}
      />
    </Layout>
  );
};

export default CategoryIII;
