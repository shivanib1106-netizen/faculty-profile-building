import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Icon from '../components/Icon';
import useAuth from '../hooks/useAuth';
import { adminApi } from '../api/adminApi';

const EMPTY_USER = {
  name: '',
  employeeId: '',
  email: '',
  phone: '',
  role: 'faculty',
  departmentId: '',
  designation: '',
  password: '',
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const UserManagement = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(EMPTY_USER);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [statusTarget, setStatusTarget] = useState(null);
  const [statusSaving, setStatusSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [userList, departmentList] = await Promise.all([
        adminApi.getUsers(),
        adminApi.getDepartments(),
      ]);
      setUsers(Array.isArray(userList) ? userList : []);
      setDepartments(Array.isArray(departmentList) ? departmentList : []);
    } catch (err) {
      setError(err.message || 'Unable to load users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return users.filter((account) => {
      const matchesRole = roleFilter === 'all' || account.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || account.status === statusFilter;
      const matchesSearch =
        !needle ||
        [account.name, account.email, account.employeeId, account.department]
          .join(' ')
          .toLowerCase()
          .includes(needle);
      return matchesRole && matchesStatus && matchesSearch;
    });
  }, [roleFilter, search, statusFilter, users]);

  const openAdd = () => {
    setEditingUser(null);
    setForm({ ...EMPTY_USER, departmentId: departments[0]?.id || '' });
    setFormErrors({});
    setSuccess('');
    setFormOpen(true);
  };

  const openEdit = (account) => {
    setEditingUser(account);
    setForm({
      name: account.name || '',
      employeeId: account.employeeId || '',
      email: account.email || '',
      phone: account.phone || '',
      role: account.role || 'faculty',
      departmentId: account.departmentId || '',
      designation: account.designation || '',
      password: '',
    });
    setFormErrors({});
    setSuccess('');
    setFormOpen(true);
  };

  const updateField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    if (formErrors[field]) setFormErrors((previous) => ({ ...previous, [field]: '' }));
  };

  const validate = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = 'Full name is required.';
    if (!form.employeeId.trim()) errors.employeeId = 'Employee ID is required.';
    if (!form.email.trim()) errors.email = 'Email is required.';
    else if (!emailPattern.test(form.email.trim())) errors.email = 'Enter a valid email address.';
    if (!form.role) errors.role = 'Select a role.';
    if (form.role !== 'admin' && !form.departmentId) errors.departmentId = 'Select a department.';
    if (!editingUser && form.password && form.password.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setError('');
    try {
      const department = departments.find((item) => String(item.id) === String(form.departmentId));
      const payload = {
        name: form.name.trim(),
        employeeId: form.employeeId.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        role: form.role,
        departmentId: form.departmentId ? Number(form.departmentId) : null,
        department: department?.name || (form.role === 'admin' ? 'Administration' : ''),
        designation: form.designation.trim(),
      };
      if (form.password.trim()) payload.password = form.password.trim();

      if (editingUser) {
        await adminApi.updateUser(editingUser.id, payload);
        setUsers((previous) =>
          previous.map((account) =>
            account.id === editingUser.id ? { ...account, ...payload, password: undefined } : account
          )
        );
        setSuccess('User details updated.');
      } else {
        const result = await adminApi.createUser(payload);
        const created = result?.data;
        if (created) setUsers((previous) => [...previous, created]);
        else await load();
        setSuccess('User account created.');
      }
      setFormOpen(false);
    } catch (err) {
      setFormErrors({ form: err.message || 'The user could not be saved.' });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async () => {
    if (!statusTarget) return;
    setStatusSaving(true);
    try {
      const result = await adminApi.toggleUserStatus(statusTarget.id);
      const updated = result?.data;
      setUsers((previous) =>
        previous.map((account) =>
          account.id === statusTarget.id
            ? { ...account, status: updated?.status || (account.status === 'active' ? 'inactive' : 'active') }
            : account
        )
      );
      setSuccess(result?.message || 'User status updated.');
      setStatusTarget(null);
    } catch (err) {
      setError(err.message || 'The user status could not be changed.');
    } finally {
      setStatusSaving(false);
    }
  };

  return (
    <Layout title="User Management">
      <div className="page-header">
        <div className="page-header-title-group">
          <h1>User Management</h1>
          <p className="page-header-subtitle">
            Create accounts, assign roles and activate or deactivate access.
          </p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-primary" onClick={openAdd}>
            <Icon name="plus" size={15} /> Add user
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
        <div className="filter-inputs-group">
          <div className="search-input-wrapper">
            <span className="search-icon"><Icon name="search" size={15} /></span>
            <input
              type="search"
              className="form-control"
              placeholder="Search name, email, employee ID"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select
            className="filter-select"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            aria-label="Filter by role"
          >
            <option value="all">All roles</option>
            <option value="faculty">Faculty</option>
            <option value="hod">HOD</option>
            <option value="admin">Admin</option>
          </select>
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <span className="filter-result-count">{filtered.length} user(s)</span>
        </div>
      </div>

      {loading ? (
        <Loading message="Loading user accounts..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="users"
          title="No users match"
          description="Adjust the filters or add a new user account."
        />
      ) : (
        <div className="academic-card">
          <div className="table-responsive">
            <table className="academic-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Employee ID</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((account) => (
                  <tr key={account.id}>
                    <td>
                      <div className="table-cell-title">{account.name}</div>
                      <div className="table-cell-subtext">{account.designation || '—'}</div>
                    </td>
                    <td>{account.employeeId}</td>
                    <td>{account.email}</td>
                    <td className="text-capitalize">{account.role}</td>
                    <td>{account.department || '—'}</td>
                    <td><StatusBadge status={account.status} /></td>
                    <td>
                      <div className="table-actions">
                        <button type="button" className="table-btn" onClick={() => openEdit(account)}>
                          <Icon name="edit" size={14} /> Edit
                        </button>
                        <button
                          type="button"
                          className={`table-btn ${account.status === 'active' ? 'table-btn-danger' : ''}`}
                          onClick={() => setStatusTarget(account)}
                          disabled={account.id === currentUser?.id}
                          title={account.id === currentUser?.id ? 'You cannot deactivate your own account' : undefined}
                        >
                          <Icon name={account.status === 'active' ? 'xCircle' : 'checkCircle'} size={14} />{' '}
                          {account.status === 'active' ? 'Deactivate' : 'Activate'}
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
        title={editingUser ? 'Edit user account' : 'Add user account'}
        size="lg"
      >
        <form onSubmit={handleSave} noValidate>
          {formErrors.form && <ErrorMessage message={formErrors.form} />}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label required" htmlFor="user-name">Full name</label>
              <input
                id="user-name"
                className={`form-control ${formErrors.name ? 'is-invalid' : ''}`}
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                disabled={saving}
              />
              {formErrors.name && <span className="form-error">{formErrors.name}</span>}
            </div>
            <div className="form-group">
              <label className="form-label required" htmlFor="user-employee-id">Employee ID</label>
              <input
                id="user-employee-id"
                className={`form-control ${formErrors.employeeId ? 'is-invalid' : ''}`}
                value={form.employeeId}
                onChange={(event) => updateField('employeeId', event.target.value)}
                disabled={saving}
              />
              {formErrors.employeeId && <span className="form-error">{formErrors.employeeId}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label required" htmlFor="user-email">Email</label>
              <input
                id="user-email"
                type="email"
                className={`form-control ${formErrors.email ? 'is-invalid' : ''}`}
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                disabled={saving}
              />
              {formErrors.email && <span className="form-error">{formErrors.email}</span>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="user-phone">Phone</label>
              <input
                id="user-phone"
                type="tel"
                className="form-control"
                value={form.phone}
                onChange={(event) => updateField('phone', event.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label required" htmlFor="user-role">Role</label>
              <select
                id="user-role"
                className={`form-control ${formErrors.role ? 'is-invalid' : ''}`}
                value={form.role}
                onChange={(event) => updateField('role', event.target.value)}
                disabled={saving}
              >
                <option value="faculty">Faculty</option>
                <option value="hod">Head of Department</option>
                <option value="admin">Administrator</option>
              </select>
              {formErrors.role && <span className="form-error">{formErrors.role}</span>}
            </div>
            <div className="form-group">
              <label className="form-label required" htmlFor="user-department">Department</label>
              <select
                id="user-department"
                className={`form-control ${formErrors.departmentId ? 'is-invalid' : ''}`}
                value={form.departmentId}
                onChange={(event) => updateField('departmentId', event.target.value)}
                disabled={saving || form.role === 'admin'}
              >
                <option value="">Select department</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>{department.name}</option>
                ))}
              </select>
              {formErrors.departmentId && <span className="form-error">{formErrors.departmentId}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="user-designation">Designation</label>
              <input
                id="user-designation"
                className="form-control"
                value={form.designation}
                onChange={(event) => updateField('designation', event.target.value)}
                disabled={saving}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="user-password">
                {editingUser ? 'New password (optional)' : 'Temporary password (optional)'}
              </label>
              <input
                id="user-password"
                type="password"
                className={`form-control ${formErrors.password ? 'is-invalid' : ''}`}
                value={form.password}
                onChange={(event) => updateField('password', event.target.value)}
                placeholder={editingUser ? 'Leave blank to keep current password' : 'At least 8 characters'}
                disabled={saving}
              />
              {formErrors.password && <span className="form-error">{formErrors.password}</span>}
            </div>
          </div>

          <div className="modal-inline-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : editingUser ? 'Save changes' : 'Create user'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        onConfirm={toggleStatus}
        title={statusTarget?.status === 'active' ? 'Deactivate this account?' : 'Activate this account?'}
        message={
          statusTarget?.status === 'active'
            ? `${statusTarget?.name} will no longer be able to sign in. Existing records are retained.`
            : `${statusTarget?.name} will be able to sign in again with their existing credentials.`
        }
        confirmText={statusTarget?.status === 'active' ? 'Deactivate' : 'Activate'}
        confirmVariant={statusTarget?.status === 'active' ? 'danger' : 'success'}
        isLoading={statusSaving}
      />
    </Layout>
  );
};

export default UserManagement;
