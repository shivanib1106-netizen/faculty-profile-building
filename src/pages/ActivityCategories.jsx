import React, { useCallback, useEffect, useState } from 'react';
import Layout from '../components/Layout';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import Icon from '../components/Icon';
import { adminApi } from '../api/adminApi';

const EMPTY_CATEGORY = {
  key: '',
  name: '',
  shortName: '',
  status: 'Active',
  activityTypesText: '',
};

export const ActivityCategories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_CATEGORY);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.getActivityCategories();
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Unable to load activity categories.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_CATEGORY);
    setFormErrors({});
    setSuccess('');
    setFormOpen(true);
  };

  const openEdit = (category) => {
    setEditing(category);
    setForm({
      key: category.key || '',
      name: category.name || '',
      shortName: category.shortName || '',
      status: category.status || 'Active',
      activityTypesText: (category.activityTypes || []).join('\n'),
    });
    setFormErrors({});
    setSuccess('');
    setFormOpen(true);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const errors = {};
    if (!editing && !form.key.trim()) errors.key = 'A category key is required (for example cat4).';
    if (!form.name.trim()) errors.name = 'A category name is required.';
    const activityTypes = form.activityTypesText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (activityTypes.length === 0) errors.activityTypes = 'Add at least one activity type.';
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const payload = {
        key: form.key.trim(),
        name: form.name.trim(),
        shortName: form.shortName.trim() || form.name.trim(),
        status: form.status,
        activityTypes,
      };
      if (editing) {
        const result = await adminApi.updateActivityCategory(editing.id, payload);
        const updated = result?.data || { ...editing, ...payload };
        setCategories((previous) =>
          previous.map((category) => (category.id === editing.id ? { ...category, ...updated } : category))
        );
        setSuccess('Activity category updated.');
      } else {
        const result = await adminApi.createActivityCategory(payload);
        if (result?.data) {
          setCategories((previous) => [...previous, result.data]);
        } else {
          await load();
        }
        setSuccess('Activity category created.');
      }
      setFormOpen(false);
    } catch (err) {
      setFormErrors({ form: err.message || 'The activity category could not be saved.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout title="Activity Categories">
      <div className="page-header">
        <div className="page-header-title-group">
          <h1>Activity Categories</h1>
          <p className="page-header-subtitle">
            Reference data used by Category I, II and III forms. Scoring limits remain under API Scoring Rules.
          </p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-primary" onClick={openAdd}>
            <Icon name="plus" size={15} /> Add category
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
        <Loading message="Loading activity categories..." />
      ) : categories.length === 0 ? (
        <EmptyState
          icon="list"
          title="No activity categories"
          description="Add the categories used by your institution's API framework."
        />
      ) : (
        <div className="category-admin-grid">
          {categories.map((category) => (
            <article key={category.id} className="category-admin-card">
              <div className="category-admin-head">
                <div>
                  <span className="code-pill">{category.key}</span>
                  <h3>{category.name}</h3>
                </div>
                <StatusBadge status={category.status || 'Active'} />
              </div>
              <p className="category-admin-count">
                {(category.activityTypes || []).length} activity type(s)
              </p>
              <ul className="tag-list">
                {(category.activityTypes || []).map((type) => (
                  <li key={type} className="tag-item">{type}</li>
                ))}
              </ul>
              <button type="button" className="btn btn-sm btn-secondary btn-block" onClick={() => openEdit(category)}>
                <Icon name="edit" size={14} /> Edit category
              </button>
            </article>
          ))}
        </div>
      )}

      <Modal
        isOpen={formOpen}
        onClose={() => (saving ? null : setFormOpen(false))}
        title={editing ? 'Edit activity category' : 'Add activity category'}
        size="lg"
      >
        <form onSubmit={handleSave} noValidate>
          {formErrors.form && <ErrorMessage message={formErrors.form} />}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label required" htmlFor="category-key">Key</label>
              <input
                id="category-key"
                className={`form-control ${formErrors.key ? 'is-invalid' : ''}`}
                value={form.key}
                onChange={(event) => setForm((previous) => ({ ...previous, key: event.target.value }))}
                disabled={saving || Boolean(editing)}
                placeholder="cat1"
              />
              {formErrors.key && <span className="form-error">{formErrors.key}</span>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="category-status">Status</label>
              <select
                id="category-status"
                className="form-control"
                value={form.status}
                onChange={(event) => setForm((previous) => ({ ...previous, status: event.target.value }))}
                disabled={saving}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label required" htmlFor="category-name">Category name</label>
            <input
              id="category-name"
              className={`form-control ${formErrors.name ? 'is-invalid' : ''}`}
              value={form.name}
              onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
              disabled={saving}
            />
            {formErrors.name && <span className="form-error">{formErrors.name}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="category-short">Short label</label>
            <input
              id="category-short"
              className="form-control"
              value={form.shortName}
              onChange={(event) => setForm((previous) => ({ ...previous, shortName: event.target.value }))}
              disabled={saving}
              placeholder="Category I"
            />
          </div>

          <div className="form-group">
            <label className="form-label required" htmlFor="category-types">
              Activity types (one per line)
            </label>
            <textarea
              id="category-types"
              rows="8"
              className={`form-control ${formErrors.activityTypes ? 'is-invalid' : ''}`}
              value={form.activityTypesText}
              onChange={(event) => setForm((previous) => ({ ...previous, activityTypesText: event.target.value }))}
              disabled={saving}
            ></textarea>
            {formErrors.activityTypes && <span className="form-error">{formErrors.activityTypes}</span>}
          </div>

          <div className="modal-inline-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Save changes' : 'Create category'}
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
};

export default ActivityCategories;
