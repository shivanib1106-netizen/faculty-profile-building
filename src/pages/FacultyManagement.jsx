import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import Icon from '../components/Icon';
import { adminApi } from '../api/adminApi';

export const FacultyManagement = () => {
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('all');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.getFacultyManagementList();
      setFaculty(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Unable to load faculty records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const departments = useMemo(
    () => [...new Set(faculty.map((member) => member.department).filter(Boolean))],
    [faculty]
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return faculty.filter((member) => {
      const matchesDepartment = department === 'all' || member.department === department;
      const matchesSearch =
        !needle ||
        [member.name, member.employeeId, member.email, member.designation]
          .join(' ')
          .toLowerCase()
          .includes(needle);
      return matchesDepartment && matchesSearch;
    });
  }, [department, faculty, search]);

  const activeCount = faculty.filter((member) => member.status === 'active').length;

  return (
    <Layout title="Faculty Management">
      <div className="page-header">
        <div className="page-header-title-group">
          <h1>Faculty Management</h1>
          <p className="page-header-subtitle">
            Read-only faculty overview. Account changes are performed in User Management.
          </p>
        </div>
      </div>

      <ErrorMessage message={error} onRetry={load} />

      <div className="grid-3">
        <div className="stat-card stat-card-compact">
          <div className="stat-card-label">Total faculty</div>
          <div className="stat-card-value">{faculty.length}</div>
        </div>
        <div className="stat-card stat-card-compact">
          <div className="stat-card-label">Active accounts</div>
          <div className="stat-card-value text-success">{activeCount}</div>
        </div>
        <div className="stat-card stat-card-compact">
          <div className="stat-card-label">Departments represented</div>
          <div className="stat-card-value">{departments.length}</div>
        </div>
      </div>

      <div className="table-filter-bar">
        <div className="filter-inputs-group">
          <div className="search-input-wrapper">
            <span className="search-icon"><Icon name="search" size={15} /></span>
            <input
              type="search"
              className="form-control"
              placeholder="Search faculty"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select
            className="filter-select"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            aria-label="Filter by department"
          >
            <option value="all">All departments</option>
            {departments.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <span className="filter-result-count">{filtered.length} record(s)</span>
        </div>
      </div>

      {loading ? (
        <Loading message="Loading faculty records..." />
      ) : filtered.length === 0 ? (
        <EmptyState icon="graduation" title="No faculty records" description="No faculty account matches the current filters." />
      ) : (
        <div className="academic-card">
          <div className="table-responsive">
            <table className="academic-table">
              <thead>
                <tr>
                  <th>Faculty</th>
                  <th>Employee ID</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Activities</th>
                  <th>Approved</th>
                  <th>Pending</th>
                  <th>API score</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div className="table-cell-title">{member.name}</div>
                      <div className="table-cell-subtext">{member.email}</div>
                    </td>
                    <td>{member.employeeId}</td>
                    <td>{member.department || '—'}</td>
                    <td>{member.designation || '—'}</td>
                    <td>{member.totalActivities ?? 0}</td>
                    <td className="text-success">{member.approvedActivities ?? 0}</td>
                    <td className="text-warning">{member.pendingActivities ?? 0}</td>
                    <td>{member.currentScore ?? '—'}</td>
                    <td><StatusBadge status={member.status} /></td>
                    <td>
                      <button type="button" className="table-btn" onClick={() => setSelected(member)}>
                        <Icon name="eye" size={14} /> Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        isOpen={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Faculty Record Summary"
      >
        {selected && (
          <dl className="detail-list-grid">
            <div><dt>Name</dt><dd>{selected.name}</dd></div>
            <div><dt>Employee ID</dt><dd>{selected.employeeId}</dd></div>
            <div><dt>Email</dt><dd>{selected.email}</dd></div>
            <div><dt>Department</dt><dd>{selected.department || '—'}</dd></div>
            <div><dt>Designation</dt><dd>{selected.designation || '—'}</dd></div>
            <div><dt>Status</dt><dd><StatusBadge status={selected.status} /></dd></div>
            <div><dt>Total activities</dt><dd>{selected.totalActivities ?? 0}</dd></div>
            <div><dt>Approved</dt><dd>{selected.approvedActivities ?? 0}</dd></div>
            <div><dt>Pending</dt><dd>{selected.pendingActivities ?? 0}</dd></div>
            <div><dt>API score</dt><dd>{selected.currentScore ?? 'Not calculated'}</dd></div>
          </dl>
        )}
      </Modal>
    </Layout>
  );
};

export default FacultyManagement;
