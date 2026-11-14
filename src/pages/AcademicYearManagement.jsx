import React, { useCallback, useEffect, useState } from 'react';
import Layout from '../components/Layout';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Icon from '../components/Icon';
import { adminApi } from '../api/adminApi';
import { formatDate } from '../utils/helpers';

const EMPTY_YEAR = {
  year: '',
  startDate: '',
  endDate: '',
  submissionDeadline: '',
  status: 'Upcoming',
};

export const AcademicYearManagement = () => {
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_YEAR);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [activeTarget, setActiveTarget] = useState(null);
  const [activating, setActivating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.getAcademicYears();
      setYears(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Unable to load academic years.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    if (formErrors[field]) setFormErrors((previous) => ({ ...previous, [field]: '' }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const errors = {};
    if (!/^\d{4}-\d{4}$/.test(form.year.trim())) {
      errors.year = 'Use the format YYYY-YYYY, for example 2027-2028.';
    }
    if (!form.startDate) errors.startDate = 'Start date is required.';
    if (!form.endDate) errors.endDate = 'End date is required.';
    if (form.startDate && form.endDate && form.startDate >= form.endDate) {
      errors.endDate = 'The end date must be after the start date.';
    }
    if (form.submissionDeadline && form.startDate && form.submissionDeadline < form.startDate) {
      errors.submissionDeadline = 'The deadline cannot be before the start date.';
    }
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const result = await adminApi.createAcademicYear({
        year: form.year.trim(),
        startDate: form.startDate,
        endDate: form.endDate,
        submissionDeadline: form.submissionDeadline || null,
        status: form.status,
      });
      if (result?.data) {
        setYears((previous) => [result.data, ...previous]);
      } else {
        await load();
      }
      setSuccess('Academic year added.');
      setFormOpen(false);
      setForm(EMPTY_YEAR);
    } catch (err) {
      setFormErrors({ form: err.message || 'The academic year could not be saved.' });
    } finally {
      setSaving(false);
    }
  };

  const makeActive = async () => {
    if (!activeTarget) return;
    setActivating(true);
    try {
      await adminApi.setActiveAcademicYear(activeTarget.id);
      setYears((previous) =>
        previous.map((year) => ({
          ...year,
          status: year.id === activeTarget.id ? 'Active' : year.status === 'Active' ? 'Archived' : year.status,
        }))
      );
      setSuccess(`${activeTarget.year} is now the active academic year.`);
      setActiveTarget(null);
    } catch (err) {
      setError(err.message || 'The active academic year could not be changed.');
    } finally {
      setActivating(false);
    }
  };

  return (
    <Layout title="Academic Years">
      <div className="page-header">
        <div className="page-header-title-group">
          <h1>Academic Year Management</h1>
          <p className="page-header-subtitle">
            Define submission periods and choose the single active academic year.
          </p>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setForm(EMPTY_YEAR);
              setFormErrors({});
              setSuccess('');
              setFormOpen(true);
            }}
          >
            <Icon name="plus" size={15} /> Add academic year
          </button>
        </div>
      </div>

      <ErrorMessage message={error} onRetry={load} />
      {success && (
        <div className="alert-box alert-box-success" role="status">
          <Icon name="checkCircle" size={16} /> {success}
        </div>
      )}

      {loading ? (
        <Loading message="Loading academic years..." />
      ) : years.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No academic years configured"
          description="Add an academic year so faculty can submit activities."
        />
      ) : (
        <div className="academic-card">
          <div className="table-responsive">
            <table className="academic-table">
              <thead>
                <tr>
                  <th>Academic year</th>
                  <th>Starts</th>
                  <th>Ends</th>
                  <th>Submission deadline</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {years.map((year) => (
                  <tr key={year.id}>
                    <td><div className="table-cell-title">{year.year}</div></td>
                    <td>{formatDate(year.startDate)}</td>
                    <td>{formatDate(year.endDate)}</td>
                    <td>{year.submissionDeadline ? formatDate(year.submissionDeadline) : '—'}</td>
                    <td><StatusBadge status={year.status || 'Upcoming'} /></td>
                    <td>
                      {year.status === 'Active' ? (
                        <span className="text-muted">Active year</span>
                      ) : (
                        <button type="button" className="table-btn" onClick={() => setActiveTarget(year)}>
                          <Icon name="checkCircle" size={14} /> Set active
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        isOpen={formOpen}
        onClose={() => (saving ? null : setFormOpen(false))}
        title="Add academic year"
      >
        <form onSubmit={handleSave} noValidate>
          {formErrors.form && <ErrorMessage message={formErrors.form} />}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label required" htmlFor="year-name">Academic year</label>
              <input
                id="year-name"
                className={`form-control ${formErrors.year ? 'is-invalid' : ''}`}
                value={form.year}
                onChange={(event) => updateField('year', event.target.value)}
                placeholder="2027-2028"
                disabled={saving}
              />
              {formErrors.year && <span className="form-error">{formErrors.year}</span>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="year-status">Status</label>
              <select
                id="year-status"
                className="form-control"
                value={form.status}
                onChange={(event) => updateField('status', event.target.value)}
                disabled={saving}
              >
                <option value="Upcoming">Upcoming</option>
                <option value="Archived">Archived</option>
              </select>
              <span className="form-hint">Set the year active from the table after creating it.</span>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label required" htmlFor="year-start">Start date</label>
              <input
                id="year-start"
                type="date"
                className={`form-control ${formErrors.startDate ? 'is-invalid' : ''}`}
                value={form.startDate}
                onChange={(event) => updateField('startDate', event.target.value)}
                disabled={saving}
              />
              {formErrors.startDate && <span className="form-error">{formErrors.startDate}</span>}
            </div>
            <div className="form-group">
              <label className="form-label required" htmlFor="year-end">End date</label>
              <input
                id="year-end"
                type="date"
                className={`form-control ${formErrors.endDate ? 'is-invalid' : ''}`}
                value={form.endDate}
                onChange={(event) => updateField('endDate', event.target.value)}
                disabled={saving}
              />
              {formErrors.endDate && <span className="form-error">{formErrors.endDate}</span>}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="year-deadline">Submission deadline</label>
            <input
              id="year-deadline"
              type="date"
              className={`form-control ${formErrors.submissionDeadline ? 'is-invalid' : ''}`}
              value={form.submissionDeadline}
              onChange={(event) => updateField('submissionDeadline', event.target.value)}
              disabled={saving}
            />
            {formErrors.submissionDeadline && <span className="form-error">{formErrors.submissionDeadline}</span>}
          </div>
          <div className="modal-inline-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Add academic year'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(activeTarget)}
        onClose={() => setActiveTarget(null)}
        onConfirm={makeActive}
        title="Change the active academic year?"
        message={`${activeTarget?.year} will become the active year for all submissions and score calculations. The current active year will be archived.`}
        confirmText="Set active year"
        confirmVariant="primary"
        isLoading={activating}
      />
    </Layout>
  );
};

export default AcademicYearManagement;
