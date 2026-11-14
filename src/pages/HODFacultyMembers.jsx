import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import HodFacultyDetailModal from '../components/HodFacultyDetailModal';
import Icon from '../components/Icon';
import { hodApi } from '../api/hodApi';

export const HODFacultyMembers = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await hodApi.getDepartmentFaculty();
      setMembers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Unable to load department faculty.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return members.filter((member) => {
      const matchesStatus = status === 'all' || member.status === status;
      const matchesSearch =
        !needle ||
        [member.name, member.employeeId, member.email, member.designation]
          .join(' ')
          .toLowerCase()
          .includes(needle);
      return matchesStatus && matchesSearch;
    });
  }, [members, search, status]);

  return (
    <Layout title="Faculty Members">
      <div className="page-header">
        <div className="page-header-title-group">
          <h1>Department Faculty Members</h1>
          <p className="page-header-subtitle">
            Faculty accounts within your authorized department only.
          </p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
            <Icon name="refresh" size={15} /> Refresh
          </button>
        </div>
      </div>

      <ErrorMessage message={error} onRetry={load} />

      <div className="table-filter-bar">
        <div className="filter-inputs-group">
          <div className="search-input-wrapper">
            <span className="search-icon"><Icon name="search" size={15} /></span>
            <input
              type="search"
              className="form-control"
              placeholder="Search by name, employee ID, email or designation"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select
            className="filter-select"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label="Filter by account status"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <span className="filter-result-count">{filtered.length} member(s)</span>
        </div>
      </div>

      {loading ? (
        <Loading message="Loading faculty members..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="users"
          title="No faculty members match"
          description="Try a different search term or status filter."
        />
      ) : (
        <div className="academic-card">
          <div className="table-responsive">
            <table className="academic-table">
              <thead>
                <tr>
                  <th>Faculty</th>
                  <th>Employee ID</th>
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
                    <td>{member.designation || '—'}</td>
                    <td>{member.totalActivities ?? 0}</td>
                    <td className="text-success">{member.approvedActivities ?? 0}</td>
                    <td className="text-warning">{member.pendingActivities ?? 0}</td>
                    <td>
                      {member.currentScore === null || member.currentScore === undefined
                        ? <span className="text-muted">Not calculated</span>
                        : <strong>{member.currentScore}</strong>}
                    </td>
                    <td><StatusBadge status={member.status} /></td>
                    <td>
                      <button
                        type="button"
                        className="table-btn"
                        onClick={() => setSelectedId(member.id)}
                      >
                        <Icon name="eye" size={14} /> View profile
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <HodFacultyDetailModal facultyId={selectedId} onClose={() => setSelectedId(null)} />
    </Layout>
  );
};

export default HODFacultyMembers;
