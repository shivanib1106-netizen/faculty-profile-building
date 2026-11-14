import React, { useCallback, useEffect, useState } from 'react';
import Layout from './Layout';
import Loading from './Loading';
import ErrorMessage from './ErrorMessage';
import StatusBadge from './StatusBadge';
import EmptyState from './EmptyState';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import Icon from './Icon';
import { hodApi } from '../api/hodApi';
import { documentApi } from '../api/documentApi';
import { triggerDownload } from '../api/apiClient';
import { useAcademicYears } from '../hooks/useReferenceData';

const MODE_CONFIG = {
  all: { status: '', title: 'Activity Verification', description: 'All activities submitted within your department.' },
  pending: { status: 'Pending', title: 'Pending Verifications', description: 'Activities awaiting a verification decision.' },
  approved: { status: 'Approved', title: 'Approved Activities', description: 'Activities you or another HOD has approved.' },
  rejected: { status: 'Rejected', title: 'Rejected Activities', description: 'Activities returned to faculty with remarks.' },
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

export const HodActivityQueue = ({ mode = 'pending' }) => {
  const config = MODE_CONFIG[mode] || MODE_CONFIG.pending;
  const { years } = useAcademicYears();

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filters, setFilters] = useState({ category: 'all', academicYear: 'all', search: '' });

  const [viewing, setViewing] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [decision, setDecision] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await hodApi.getActivitiesForVerification({
        status: config.status,
        category: filters.category,
        academicYear: filters.academicYear,
        search: filters.search,
      });
      setActivities(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Unable to load activities for verification.');
    } finally {
      setLoading(false);
    }
  }, [config.status, filters.category, filters.academicYear, filters.search]);

  useEffect(() => {
    load();
  }, [load]);

  const openActivity = (activity) => {
    setViewing(activity);
    setRemarks('');
    setDetailError('');
    setSuccess('');
  };

  const canVerify = (activity) => ['Pending', 'Submitted'].includes(activity?.status);

  const requestDecision = (status) => {
    if (status === 'Rejected' && !remarks.trim()) {
      setDetailError('Remarks are required when rejecting an activity.');
      return;
    }
    setDetailError('');
    setDecision(status);
    setConfirmOpen(true);
  };

  const submitDecision = async () => {
    if (!viewing || !decision) return;
    setSaving(true);
    setDetailError('');
    try {
      const result = await hodApi.verifyActivity(viewing.id, { status: decision, remarks: remarks.trim() });
      const updated = { ...viewing, status: decision, remarks: remarks.trim() };
      setViewing(updated);
      setActivities((previous) =>
        previous.map((item) => (item.id === viewing.id ? updated : item))
      );
      setSuccess(result?.message || `Activity marked ${decision.toLowerCase()}.`);
      setConfirmOpen(false);
      setDecision(null);
      setViewing(null);
    } catch (err) {
      setDetailError(err.message || 'The verification decision could not be saved.');
      setConfirmOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!viewing?.documentId) return;
    setDownloading(true);
    setDetailError('');
    try {
      const blob = await documentApi.downloadDocument(viewing.documentId);
      triggerDownload(blob, viewing.documentName || `document-${viewing.documentId}`);
    } catch (err) {
      setDetailError(err.message || 'The supporting document could not be downloaded.');
    } finally {
      setDownloading(false);
    }
  };

  const resetFilters = () => {
    setFilters({ category: 'all', academicYear: 'all', search: '' });
  };

  return (
    <Layout title={config.title}>
      <div className="page-header">
        <div className="page-header-title-group">
          <h1>{config.title}</h1>
          <p className="page-header-subtitle">{config.description}</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
            <Icon name="refresh" size={15} /> Refresh
          </button>
        </div>
      </div>

      <ErrorMessage message={error} onRetry={load} />

      {success && (
        <div className="alert-box alert-box-success" role="status">
          <Icon name="checkCircle" size={16} /> {success}
        </div>
      )}

      <div className="table-filter-bar">
        <form
          className="filter-inputs-group"
          onSubmit={(event) => {
            event.preventDefault();
            load();
          }}
        >
          <div className="search-input-wrapper">
            <span className="search-icon"><Icon name="search" size={15} /></span>
            <input
              type="search"
              className="form-control"
              placeholder="Search faculty or activity title"
              value={filters.search}
              onChange={(event) => setFilters((previous) => ({ ...previous, search: event.target.value }))}
            />
          </div>

          <select
            className="filter-select"
            value={filters.category}
            onChange={(event) => setFilters((previous) => ({ ...previous, category: event.target.value }))}
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            <option value="Category I">Category I</option>
            <option value="Category II">Category II</option>
            <option value="Category III">Category III</option>
          </select>

          <select
            className="filter-select"
            value={filters.academicYear}
            onChange={(event) => setFilters((previous) => ({ ...previous, academicYear: event.target.value }))}
            aria-label="Filter by academic year"
          >
            <option value="all">All academic years</option>
            {years.map((year) => (
              <option key={year.id || year.year} value={year.year}>
                {year.year}{year.status === 'Active' ? ' (Active)' : ''}
              </option>
            ))}
          </select>

          <button type="button" className="btn btn-sm btn-secondary" onClick={resetFilters}>
            Reset
          </button>
        </form>
      </div>

      {loading ? (
        <Loading message="Loading activities..." />
      ) : activities.length === 0 ? (
        <EmptyState
          icon="checkCircle"
          title="Nothing in this queue"
          description="Activities will appear here once faculty submit them for verification."
        />
      ) : (
        <div className="academic-card">
          <div className="table-responsive">
            <table className="academic-table">
              <thead>
                <tr>
                  <th>Faculty</th>
                  <th>Activity</th>
                  <th>Category</th>
                  <th>Submitted</th>
                  <th>Document</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((activity) => (
                  <tr key={activity.id}>
                    <td>
                      <div className="table-cell-title">{activity.facultyName}</div>
                      <div className="table-cell-subtext">{activity.employeeId}</div>
                    </td>
                    <td>
                      <div className="table-cell-title">{activity.title}</div>
                      <div className="table-cell-subtext">{activity.activityType}</div>
                    </td>
                    <td>{activity.category}</td>
                    <td>{formatDate(activity.submissionDate)}</td>
                    <td>
                      {activity.documentName || activity.documentId ? (
                        <span className="text-success">Attached</span>
                      ) : (
                        <span className="text-muted">Not attached</span>
                      )}
                    </td>
                    <td><StatusBadge status={activity.status} /></td>
                    <td>
                      <button type="button" className="table-btn" onClick={() => openActivity(activity)}>
                        <Icon name="eye" size={14} /> Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewing && (
        <Modal
          isOpen={Boolean(viewing)}
          onClose={() => setViewing(null)}
          title="Activity Verification"
          size="lg"
        >
          <div className="detail-stack">
            {detailError && <ErrorMessage message={detailError} />}

            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Faculty</span>
                <span className="detail-value">{viewing.facultyName || '—'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Employee ID</span>
                <span className="detail-value">{viewing.employeeId || '—'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Department</span>
                <span className="detail-value">{viewing.department || '—'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Academic year</span>
                <span className="detail-value">{viewing.academicYear || '—'}</span>
              </div>
              <div className="detail-item detail-item-full">
                <span className="detail-label">Activity title</span>
                <span className="detail-value">{viewing.title}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Category</span>
                <span className="detail-value">{viewing.category}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Activity type</span>
                <span className="detail-value">{viewing.activityType || '—'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Activity date</span>
                <span className="detail-value">{formatDate(viewing.activityDate)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Submission date</span>
                <span className="detail-value">{formatDate(viewing.submissionDate)}</span>
              </div>
              <div className="detail-item detail-item-full">
                <span className="detail-label">Description</span>
                <span className="detail-value">{viewing.details || 'No description provided.'}</span>
              </div>
              <div className="detail-item detail-item-full">
                <span className="detail-label">Supporting document</span>
                {viewing.documentId ? (
                  <button
                    type="button"
                    className="table-btn"
                    onClick={handleDownload}
                    disabled={downloading}
                  >
                    <Icon name="download" size={14} />{' '}
                    {downloading ? 'Downloading...' : viewing.documentName || 'Download document'}
                  </button>
                ) : (
                  <span className="detail-value">
                    {viewing.documentName || 'No supporting document attached.'}
                  </span>
                )}
              </div>
            </div>

            <div className="detail-section">
              <h4 className="detail-section-title">Verification decision</h4>
              <div className="form-group">
                <label className="form-label" htmlFor="verification-remarks">
                  Remarks {decision === 'Rejected' && <span className="required-mark">*</span>}
                </label>
                <textarea
                  id="verification-remarks"
                  className="form-control"
                  rows="3"
                  placeholder="Add a note for the faculty member. Required when rejecting."
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  disabled={!canVerify(viewing) || saving}
                ></textarea>
                <span className="form-hint">
                  Remarks are shared with the faculty member and stored in the audit trail.
                </span>
              </div>

              {canVerify(viewing) ? (
                <div className="modal-inline-actions">
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={() => requestDecision('Approved')}
                    disabled={saving}
                  >
                    <Icon name="check" size={15} /> Approve activity
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => requestDecision('Rejected')}
                    disabled={saving}
                  >
                    <Icon name="close" size={15} /> Reject activity
                  </button>
                </div>
              ) : (
                <div className="alert-box alert-box-info">
                  This activity is already <strong>{viewing.status}</strong>. Decisions cannot be changed
                  from this screen.
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          setDecision(null);
        }}
        onConfirm={submitDecision}
        title={decision === 'Rejected' ? 'Reject this activity?' : 'Approve this activity?'}
        message={
          decision === 'Rejected'
            ? 'The faculty member will be notified and asked to revise the submission. Your remarks will be attached.'
            : 'The activity will be marked approved and included in the verified API score calculation.'
        }
        confirmText={decision === 'Rejected' ? 'Confirm rejection' : 'Confirm approval'}
        confirmVariant={decision === 'Rejected' ? 'danger' : 'success'}
        isLoading={saving}
      />
    </Layout>
  );
};

export default HodActivityQueue;
