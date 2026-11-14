import React, { useCallback, useEffect, useState } from 'react';
import Layout from '../components/Layout';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import Icon from '../components/Icon';
import { adminApi } from '../api/adminApi';

const EMPTY_DEPARTMENT = { code: '', name: '', hod: '', activeStatus: 'Active' };

export const DepartmentManagement = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_DEPARTMENT);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.getDepartments();
      setDepartments(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Unable to load departments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_DEPARTMENT);
    setFormErrors({});
    setSuccess('');
    setFormOpen(true);
  };

  const openEdit = (department) => {
    setEditing(department);
    setForm({
      code: department.code || '',
      name: department.name || '',
      hod: department.hod || '',
      activeStatus: department.activeStatus || 'Active',
    });
    setFormErrors({});
    setSuccess('');
    setFormOpen(true);
  };

  const updateField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    if (formErrors[field]) setFormErrors((previous) => ({ ...previous, [field]: '' }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const errors = {};
    if (!form.code.trim()) errors.code = 'Department code is required.';
    if (!form.name.trim()) errors.name = 'Department name is required.';
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        hod: form.hod.trim(),
        activeStatus: form.activeStatus,
      };
      if (editing) {
        const result = await adminApi.updateDepartment(editing.id, payload);
        const updated = result?.data || { ...editing, ...payload };
        setDepartments((previous) =>
          previous.map((department) => (department.id === editing.id ? { ...department, ...updated } : department))
        );
        setSuccess('Department updated.');
      } else {
        const result = await adminApi.createDepartment(payload);
        if (result?.data) {
          setDepartments((previous) => [...previous, result.data]);
        } else {
          await load();
        }
        setSuccess('Department created.');
      }
      setFormOpen(false);
    } catch (err) {
      setFormErrors({ form: err.message || 'The department could not be saved.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout title="Departments">
      <div className="page-header">
        <div className="page-header-title-group">
          <h1>Department Management</h1>
          <p className="page-header-subtitle">Maintain academic departments and their Heads of Department.</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-primary" onClick={openAdd}>
            <Icon name="plus" size={15} /> Add department
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
        <Loading message="Loading departments..." />
      ) : departments.length === 0 ? (
        <EmptyState
          icon="building"
          title="No departments configured"
          description="Add the first academic department to begin."
          action={<button type="button" className="btn btn-primary" onClick={openAdd}>Add department</button>}
        />
      ) : (
        <div className="academic-card">
          <div className="table-responsive">
            <table className="academic-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Department</th>
                  <th>Head of Department</th>
                  <th>Faculty</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((department) => (
                  <tr key={department.id}>
                    <td><span className="code-pill">{department.code}</span></td>
                    <td><div className="table-cell-title">{department.name}</div></td>
                    <td>{department.hod || '—'}</td>
                    <td>{department.facultyCount ?? 0}</td>
                    <td><StatusBadge status={department.activeStatus} /></td>
                    <td>
                      <div className="table-actions">
                        <button type="button" className="table-btn" onClick={() => setViewing(department)}>
                          <Icon name="eye" size={14} /> View
                        </button>
                        <button type="button" className="table-btn" onClick={() => openEdit(department)}>
                          <Icon name="edit" size={14} /> Edit
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

      <Modal
        isOpen={formOpen}
        onClose={() => (saving ? null : setFormOpen(false))}
        title={editing ? 'Edit department' : 'Add department'}
      >
        <form onSubmit={handleSave} noValidate>
          {formErrors.form && <ErrorMessage message={formErrors.form} />}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label required" htmlFor="dept-code">Code</label>
              <input
                id="dept-code"
                className={`form-control ${formErrors.code ? 'is-invalid' : ''}`}
                value={form.code}
                onChange={(event) => updateField('code', event.target.value)}
                placeholder="e.g. CSE"
                disabled={saving}
              />
              {formErrors.code && <span className="form-error">{formErrors.code}</span>}
            </div>
            <div className="form-group">
              <label className="form-label required" htmlFor="dept-name">Department name</label>
              <input
                id="dept-name"
                className={`form-control ${formErrors.name ? 'is-invalid' : ''}`}
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                disabled={saving}
              />
              {formErrors.name && <span className="form-error">{formErrors.name}</span>}
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="dept-hod">Head of Department</label>
              <input
                id="dept-hod"
                className="form-control"
                value={form.hod}
                onChange={(event) => updateField('hod', event.target.value)}
                disabled={saving}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="dept-status">Status</label>
              <select
                id="dept-status"
                className="form-control"
                value={form.activeStatus}
                onChange={(event) => updateField('activeStatus', event.target.value)}
                disabled={saving}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="modal-inline-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Save changes' : 'Create department'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(viewing)} onClose={() => setViewing(null)} title="Department details">
        {viewing && (
          <dl className="detail-list-grid">
            <div><dt>Code</dt><dd>{viewing.code}</dd></div>
            <div><dt>Name</dt><dd>{viewing.name}</dd></div>
            <div><dt>Head of Department</dt><dd>{viewing.hod || '—'}</dd></div>
            <div><dt>Faculty members</dt><dd>{viewing.facultyCount ?? 0}</dd></div>
            <div><dt>Status</dt><dd><StatusBadge status={viewing.activeStatus} /></dd></div>
          </dl>
        )}
      </Modal>
    </Layout>
  );
};

export default DepartmentManagement;
