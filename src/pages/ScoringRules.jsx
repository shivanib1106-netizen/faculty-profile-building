import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import Icon from '../components/Icon';
import { adminApi } from '../api/adminApi';

export const ScoringRules = () => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ maxScore: '', scorePerUnit: '', ruleVersion: '' });
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.getScoringRules();
      setRules(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Unable to load scoring rules.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map();
    rules.forEach((rule) => {
      const key = rule.category || 'Uncategorised';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(rule);
    });
    return [...map.entries()];
  }, [rules]);

  const versions = useMemo(
    () => [...new Set(rules.map((rule) => rule.ruleVersion).filter(Boolean))],
    [rules]
  );

  const openEdit = (rule) => {
    setEditing(rule);
    setForm({
      maxScore: String(rule.maxScore ?? ''),
      scorePerUnit: rule.scorePerUnit || '',
      ruleVersion: rule.ruleVersion || '',
    });
    setFormErrors({});
    setSuccess('');
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const errors = {};
    if (form.maxScore === '' || Number.isNaN(Number(form.maxScore)) || Number(form.maxScore) < 0) {
      errors.maxScore = 'Enter a non-negative maximum score.';
    }
    if (!form.scorePerUnit.trim()) errors.scorePerUnit = 'Describe how the score is earned.';
    if (!form.ruleVersion.trim()) errors.ruleVersion = 'A rule version is required.';
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const payload = {
        maxScore: Number(form.maxScore),
        scorePerUnit: form.scorePerUnit.trim(),
        ruleVersion: form.ruleVersion.trim(),
      };
      const result = await adminApi.updateScoringRule(editing.id, payload);
      const updated = result?.data || { ...editing, ...payload };
      setRules((previous) => previous.map((rule) => (rule.id === editing.id ? { ...rule, ...updated } : rule)));
      setSuccess('Scoring rule updated. The backend applies this rule to all new calculations.');
      setEditing(null);
    } catch (err) {
      setFormErrors({ form: err.message || 'The scoring rule could not be updated.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout title="API Scoring Rules">
      <div className="page-header">
        <div className="page-header-title-group">
          <h1>API Scoring Rules</h1>
          <p className="page-header-subtitle">
            Configuration reference only. Scores are computed by the backend, never by this interface.
          </p>
        </div>
      </div>

      <ErrorMessage message={error} onRetry={load} />
      {success && (
        <div className="alert-box alert-box-success" role="status">
          <Icon name="checkCircle" size={16} /> {success}
        </div>
      )}

      <div className="info-strip">
        <div>
          <span className="info-strip-label">Configured rules</span>
          <span>{rules.length}</span>
        </div>
        <div>
          <span className="info-strip-label">Rule versions</span>
          <span>{versions.length ? versions.join(', ') : 'Not provided'}</span>
        </div>
        <div>
          <span className="info-strip-label">Calculation</span>
          <span>Performed exclusively by the backend scoring service</span>
        </div>
      </div>

      {loading ? (
        <Loading message="Loading scoring rules..." />
      ) : grouped.length === 0 ? (
        <EmptyState
          icon="edit"
          title="No scoring rules configured"
          description="Scoring rules must be configured on the server before API scores can be calculated."
        />
      ) : (
        grouped.map(([category, categoryRules]) => (
          <section key={category} className="rule-section">
            <div className="section-heading section-heading-tight">
              <h2>{category}</h2>
              <span className="section-count">{categoryRules.length} rule(s)</span>
            </div>
            <div className="academic-card">
              <div className="table-responsive">
                <table className="academic-table">
                  <thead>
                    <tr>
                      <th>Sub-category</th>
                      <th>Maximum score</th>
                      <th>Score basis</th>
                      <th>Rule version</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryRules.map((rule) => (
                      <tr key={rule.id}>
                        <td><div className="table-cell-title">{rule.subCategory}</div></td>
                        <td><strong>{rule.maxScore}</strong></td>
                        <td>{rule.scorePerUnit || '—'}</td>
                        <td><span className="code-pill">{rule.ruleVersion || '—'}</span></td>
                        <td>
                          <button type="button" className="table-btn" onClick={() => openEdit(rule)}>
                            <Icon name="edit" size={14} /> Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ))
      )}

      <div className="alert-box alert-box-info">
        <Icon name="info" size={16} />
        <div>
          Updating a rule does not rewrite previously calculated scores unless the backend
          recalculates them. Confirm with the API cell before changing an active rule version.
        </div>
      </div>

      <Modal isOpen={Boolean(editing)} onClose={() => (saving ? null : setEditing(null))} title="Edit scoring rule">
        {editing && (
          <form onSubmit={handleSave} noValidate>
            {formErrors.form && <ErrorMessage message={formErrors.form} />}
            <div className="form-group">
              <span className="form-label">Rule</span>
              <p className="form-static-value">
                {editing.category} &bull; {editing.subCategory}
              </p>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label required" htmlFor="rule-max">Maximum score</label>
                <input
                  id="rule-max"
                  type="number"
                  min="0"
                  step="0.01"
                  className={`form-control ${formErrors.maxScore ? 'is-invalid' : ''}`}
                  value={form.maxScore}
                  onChange={(event) => setForm((previous) => ({ ...previous, maxScore: event.target.value }))}
                  disabled={saving}
                />
                {formErrors.maxScore && <span className="form-error">{formErrors.maxScore}</span>}
              </div>
              <div className="form-group">
                <label className="form-label required" htmlFor="rule-version">Rule version</label>
                <input
                  id="rule-version"
                  className={`form-control ${formErrors.ruleVersion ? 'is-invalid' : ''}`}
                  value={form.ruleVersion}
                  onChange={(event) => setForm((previous) => ({ ...previous, ruleVersion: event.target.value }))}
                  disabled={saving}
                />
                {formErrors.ruleVersion && <span className="form-error">{formErrors.ruleVersion}</span>}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label required" htmlFor="rule-basis">Score basis</label>
              <input
                id="rule-basis"
                className={`form-control ${formErrors.scorePerUnit ? 'is-invalid' : ''}`}
                value={form.scorePerUnit}
                onChange={(event) => setForm((previous) => ({ ...previous, scorePerUnit: event.target.value }))}
                disabled={saving}
              />
              {formErrors.scorePerUnit && <span className="form-error">{formErrors.scorePerUnit}</span>}
            </div>
            <div className="modal-inline-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save rule'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </Layout>
  );
};

export default ScoringRules;
