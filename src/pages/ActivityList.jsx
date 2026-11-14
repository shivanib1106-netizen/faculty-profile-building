import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { activityApi } from '../api/activityApi';
import { useAcademicYears } from '../hooks/useReferenceData';

export const ActivityList = () => {
  const { years } = useAcademicYears();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters state
  const [filters, setFilters] = useState({
    category: 'all',
    academicYear: 'all',
    status: 'all',
    search: '',
  });

  // Modals state
  const [viewingActivity, setViewingActivity] = useState(null);
  const [remarksActivity, setRemarksActivity] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchActivities = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await activityApi.getActivities(filters);
      setActivities(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load activity list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [filters.category, filters.academicYear, filters.status]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchActivities();
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const resetFilters = () => {
    setFilters({
      category: 'all',
      academicYear: 'all',
      status: 'all',
      search: '',
    });
  };

  const handleSubmitDraft = async (id) => {
    try {
      await activityApi.submitActivity(id);
      setActivities((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'Pending' } : a))
      );
      setSuccess('Activity submitted for verification.');
    } catch (err) {
      setError(err.message || 'Error submitting activity.');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await activityApi.deleteActivity(deleteId);
      setActivities((prev) => prev.filter((a) => a.id !== deleteId));
      setSuccess('Activity removed successfully.');
      setDeleteId(null);
    } catch (err) {
      setError(err.message || 'Failed to delete activity.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Layout title="Academic Activities Management">
      <div className="page-header">
        <div className="page-header-title-group">
          <h1>Activity Submissions &amp; Verification Tracker</h1>
          <p className="page-header-subtitle">
            Manage, filter, track status, and view reviewer remarks for all academic entries
          </p>
        </div>
        <div className="page-header-actions">
          <Link to="/faculty/category-1" className="btn btn-secondary">
            + Category I
          </Link>
          <Link to="/faculty/category-2" className="btn btn-secondary">
            + Category II
          </Link>
          <Link to="/faculty/category-3" className="btn btn-primary">
            + Category III
          </Link>
        </div>
      </div>

      <ErrorMessage message={error} onRetry={fetchActivities} />

      {success && (
        <div className="alert-box alert-box-success" role="alert">
          {success}
        </div>
      )}

      {/* Filter and Search Toolbar */}
      <div className="table-filter-bar">
        <form className="filter-inputs-group" onSubmit={handleSearchSubmit}>
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="form-control"
              placeholder="Search by title, keyword, course..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
            />
          </div>

          <select
            className="filter-select"
            value={filters.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
          >
            <option value="all">All Categories</option>
            <option value="Category I">Category I – Teaching</option>
            <option value="Category II">Category II – Co-curricular</option>
            <option value="Category III">Category III – Research</option>
          </select>

          <select
            className="filter-select"
            value={filters.academicYear}
            onChange={(e) => handleFilterChange('academicYear', e.target.value)}
          >
            <option value="all">All Academic Years</option>
            {years.map((year) => (
              <option key={year.id || year.year} value={year.year}>
                {year.year}
                {year.status === 'Active' ? ' (Active)' : ''}
              </option>
            ))}
          </select>

          <select
            className="filter-select"
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          <button type="submit" className="btn btn-sm btn-primary">
            Apply Filters
          </button>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={resetFilters}
          >
            Reset
          </button>
        </form>
      </div>

      {/* Activities Table */}
      {loading ? (
        <Loading message="Fetching activities..." />
      ) : activities.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <h3 className="empty-state-title">No Activities Match Filter Criteria</h3>
          <p className="empty-state-description">
            Try adjusting your search filters or add a new academic activity in Categories I, II, or III.
          </p>
        </div>
      ) : (
        <div className="academic-card">
          <div className="table-responsive">
            <table className="academic-table">
              <thead>
                <tr>
                  <th>Activity Title</th>
                  <th>Category</th>
                  <th>Activity Date</th>
                  <th>Academic Year</th>
                  <th>Submission Date</th>
                  <th>Verification Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((item) => {
                  const isEditable = item.status === 'Draft' || item.status === 'Rejected';
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="table-cell-title">{item.title}</div>
                        <div className="table-cell-subtext">{item.activityType}</div>
                      </td>
                      <td>{item.category}</td>
                      <td>{item.activityDate || 'N/A'}</td>
                      <td>{item.academicYear}</td>
                      <td>{item.submissionDate || 'Draft'}</td>
                      <td>
                        <StatusBadge status={item.status} />
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="table-btn"
                            onClick={() => setViewingActivity(item)}
                            title="View complete activity details"
                          >
                            👁 View
                          </button>

                          {item.remarks && (
                            <button
                              type="button"
                              className="table-btn"
                              onClick={() => setRemarksActivity(item)}
                              title="Read reviewer remarks"
                            >
                              💬 Remarks
                            </button>
                          )}

                          {isEditable && (
                            <button
                              type="button"
                              className="table-btn table-btn-primary"
                              onClick={() => handleSubmitDraft(item.id)}
                              title="Submit for HOD Verification"
                            >
                              Submit
                            </button>
                          )}

                          {isEditable && (
                            <button
                              type="button"
                              className="table-btn table-btn-danger"
                              onClick={() => setDeleteId(item.id)}
                              title="Delete activity record"
                            >
                              🗑 Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View Activity Details Modal */}
      {viewingActivity && (
        <Modal
          isOpen={Boolean(viewingActivity)}
          onClose={() => setViewingActivity(null)}
          title="Activity Details Overview"
          size="lg"
        >
          <div className="detail-grid">
            <div className="detail-item detail-item-full">
              <span className="detail-label">Activity Title</span>
              <span className="detail-value">{viewingActivity.title}</span>
            </div>

            <div className="detail-item">
              <span className="detail-label">Category</span>
              <span className="detail-value">{viewingActivity.category}</span>
            </div>

            <div className="detail-item">
              <span className="detail-label">Activity Type</span>
              <span className="detail-value">{viewingActivity.activityType}</span>
            </div>

            <div className="detail-item">
              <span className="detail-label">Academic Year</span>
              <span className="detail-value">{viewingActivity.academicYear}</span>
            </div>

            <div className="detail-item">
              <span className="detail-label">Current Status</span>
              <div>
                <StatusBadge status={viewingActivity.status} />
              </div>
            </div>

            <div className="detail-item">
              <span className="detail-label">Activity Date</span>
              <span className="detail-value">{viewingActivity.activityDate || 'N/A'}</span>
            </div>

            <div className="detail-item">
              <span className="detail-label">Submission Date</span>
              <span className="detail-value">{viewingActivity.submissionDate || 'Not Submitted'}</span>
            </div>

            {viewingActivity.documentName && (
              <div className="detail-item detail-item-full">
                <span className="detail-label">Supporting Document</span>
                <span className="detail-value">📎 {viewingActivity.documentName}</span>
              </div>
            )}

            <div className="detail-item detail-item-full">
              <span className="detail-label">Description &amp; Relevant Scope</span>
              <span className="detail-value">{viewingActivity.details || 'None provided.'}</span>
            </div>

            {viewingActivity.remarks && (
              <div className="detail-item detail-item-full">
                <span className="detail-label">Reviewer / HOD Remarks</span>
                <div className="alert-box alert-box-warning">
                  {viewingActivity.remarks}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Remarks View Modal */}
      {remarksActivity && (
        <Modal
          isOpen={Boolean(remarksActivity)}
          onClose={() => setRemarksActivity(null)}
          title="Reviewer & Verification Remarks"
        >
          <p><strong>Activity:</strong> {remarksActivity.title}</p>
          <div className="alert-box alert-box-warning mt-3">
            <span>💬</span>
            <div>{remarksActivity.remarks || 'No remarks provided.'}</div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Activity Record"
        message="Are you sure you want to delete this activity? This action cannot be reversed."
        confirmText="Confirm Delete"
        confirmVariant="danger"
        isLoading={isDeleting}
      />
    </Layout>
  );
};

export default ActivityList;
