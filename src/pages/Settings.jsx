import React, { useCallback, useEffect, useState } from 'react';
import Layout from '../components/Layout';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import Icon from '../components/Icon';
import { adminApi } from '../api/adminApi';

const SETTING_FIELDS = {
  institutionName: '',
  supportEmail: '',
  allowSelfRegistration: false,
  requireHodRemarksOnRejection: true,
  maxUploadSizeMb: 10,
  allowedFileTypesText: '',
  scoringRuleVersion: '',
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const Settings = () => {
  const [form, setForm] = useState(SETTING_FIELDS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.getSettings();
      setForm({
        institutionName: data?.institutionName || '',
        supportEmail: data?.supportEmail || '',
        allowSelfRegistration: Boolean(data?.allowSelfRegistration),
        requireHodRemarksOnRejection: data?.requireHodRemarksOnRejection !== false,
        maxUploadSizeMb: data?.maxUploadSizeMb ?? 10,
        allowedFileTypesText: (data?.allowedFileTypes || []).join(', '),
        scoringRuleVersion: data?.scoringRuleVersion || '',
      });
    } catch (err) {
      setError(err.message || 'Unable to load system settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: '' }));
    setSuccess('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validation = {};
    if (!form.institutionName.trim()) validation.institutionName = 'Institution name is required.';
    if (!form.supportEmail.trim()) validation.supportEmail = 'A support email is required.';
    else if (!emailPattern.test(form.supportEmail.trim())) validation.supportEmail = 'Enter a valid email address.';
    if (!form.maxUploadSizeMb || Number(form.maxUploadSizeMb) <= 0) {
      validation.maxUploadSizeMb = 'Enter a positive upload size in MB.';
    }
    const fileTypes = form.allowedFileTypesText
      .split(',')
      .map((item) => item.trim().replace(/^\./, '').toLowerCase())
      .filter(Boolean);
    if (fileTypes.length === 0) validation.allowedFileTypesText = 'List at least one allowed file extension.';
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setSaving(true);
    try {
      const payload = {
        institutionName: form.institutionName.trim(),
        supportEmail: form.supportEmail.trim(),
        allowSelfRegistration: form.allowSelfRegistration,
        requireHodRemarksOnRejection: form.requireHodRemarksOnRejection,
        maxUploadSizeMb: Number(form.maxUploadSizeMb),
        allowedFileTypes: fileTypes,
      };
      const result = await adminApi.updateSettings(payload);
      if (result?.data) {
        setForm((previous) => ({
          ...previous,
          scoringRuleVersion: result.data.scoringRuleVersion || previous.scoringRuleVersion,
        }));
      }
      setSuccess('System settings saved.');
    } catch (err) {
      setError(err.message || 'The settings could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout title="Settings">
      <div className="page-header">
        <div className="page-header-title-group">
          <h1>System Settings</h1>
          <p className="page-header-subtitle">
            Institution details, registration policy and upload constraints served to the frontend.
          </p>
        </div>
      </div>

      <ErrorMessage message={error} onRetry={load} />
      {success && (
        <div className="alert-box alert-box-success" role="status">
          <Icon name="checkCircle" size={16} /> {success}
        </div>
      )}

      {loading ? (
        <Loading message="Loading system settings..." />
      ) : (
        <div className="settings-layout">
          <form className="academic-card settings-card" onSubmit={handleSubmit} noValidate>
            <div className="academic-card-header">
              <h2>Institution profile</h2>
            </div>
            <div className="academic-card-body">
              <div className="form-group">
                <label className="form-label required" htmlFor="settings-institution">Institution name</label>
                <input
                  id="settings-institution"
                  className={`form-control ${errors.institutionName ? 'is-invalid' : ''}`}
                  value={form.institutionName}
                  onChange={(event) => updateField('institutionName', event.target.value)}
                  disabled={saving}
                />
                {errors.institutionName && <span className="form-error">{errors.institutionName}</span>}
              </div>

              <div className="form-group">
                <label className="form-label required" htmlFor="settings-email">API cell support email</label>
                <input
                  id="settings-email"
                  type="email"
                  className={`form-control ${errors.supportEmail ? 'is-invalid' : ''}`}
                  value={form.supportEmail}
                  onChange={(event) => updateField('supportEmail', event.target.value)}
                  disabled={saving}
                />
                {errors.supportEmail && <span className="form-error">{errors.supportEmail}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="settings-version">Active scoring rule version</label>
                <input
                  id="settings-version"
                  className="form-control"
                  value={form.scoringRuleVersion}
                  readOnly
                  disabled
                />
                <span className="form-hint">Managed in API Scoring Rules on the server.</span>
              </div>
            </div>

            <div className="academic-card-header">
              <h2>Account and workflow policy</h2>
            </div>
            <div className="academic-card-body">
              <label className="form-checkbox-label form-checkbox-row">
                <input
                  type="checkbox"
                  className="form-checkbox"
                  checked={form.allowSelfRegistration}
                  onChange={(event) => updateField('allowSelfRegistration', event.target.checked)}
                  disabled={saving}
                />
                <span>
                  Allow faculty self-registration
                  <span className="form-hint">When disabled, the registration form reports that access is closed.</span>
                </span>
              </label>

              <label className="form-checkbox-label form-checkbox-row">
                <input
                  type="checkbox"
                  className="form-checkbox"
                  checked={form.requireHodRemarksOnRejection}
                  onChange={(event) => updateField('requireHodRemarksOnRejection', event.target.checked)}
                  disabled={saving}
                />
                <span>
                  Require remarks when an HOD rejects an activity
                  <span className="form-hint">The backend enforces this rule; the frontend mirrors it.</span>
                </span>
              </label>
            </div>

            <div className="academic-card-header">
              <h2>Document upload constraints</h2>
            </div>
            <div className="academic-card-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label required" htmlFor="settings-upload">Maximum file size (MB)</label>
                  <input
                    id="settings-upload"
                    type="number"
                    min="1"
                    className={`form-control ${errors.maxUploadSizeMb ? 'is-invalid' : ''}`}
                    value={form.maxUploadSizeMb}
                    onChange={(event) => updateField('maxUploadSizeMb', event.target.value)}
                    disabled={saving}
                  />
                  {errors.maxUploadSizeMb && <span className="form-error">{errors.maxUploadSizeMb}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label required" htmlFor="settings-types">Allowed extensions</label>
                  <input
                    id="settings-types"
                    className={`form-control ${errors.allowedFileTypesText ? 'is-invalid' : ''}`}
                    value={form.allowedFileTypesText}
                    onChange={(event) => updateField('allowedFileTypesText', event.target.value)}
                    placeholder="pdf, jpg, png"
                    disabled={saving}
                  />
                  {errors.allowedFileTypesText && <span className="form-error">{errors.allowedFileTypesText}</span>}
                  <span className="form-hint">Comma-separated, without dots.</span>
                </div>
              </div>
            </div>

            <div className="settings-actions">
              <button type="button" className="btn btn-secondary" onClick={load} disabled={saving}>
                Reset
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save settings'}
              </button>
            </div>
          </form>

          <aside className="settings-side">
            <div className="academic-card">
              <div className="academic-card-header">
                <h2>Score calculation</h2>
              </div>
              <div className="academic-card-body">
                <p className="settings-note">
                  API scores are always calculated by the Flask scoring service using the active rule
                  version. This interface only displays returned values and rule configuration.
                </p>
              </div>
            </div>
            <div className="academic-card">
              <div className="academic-card-header">
                <h2>Session security</h2>
              </div>
              <div className="academic-card-body">
                <p className="settings-note">
                  Authentication uses short-lived bearer tokens. Expired or invalid tokens are
                  rejected by the server and the user is returned to the sign-in page automatically.
                </p>
              </div>
            </div>
          </aside>
        </div>
      )}
    </Layout>
  );
};

export default Settings;
