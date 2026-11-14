import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import HodFacultyDetailModal from '../components/HodFacultyDetailModal';
import Icon from '../components/Icon';
import { hodApi } from '../api/hodApi';

export const HODFacultyProfiles = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await hodApi.getDepartmentFaculty();
      setMembers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Unable to load faculty profiles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((member) =>
      [member.name, member.employeeId, member.designation, member.email]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  }, [members, search]);

  return (
    <Layout title="Faculty Profiles">
      <div className="page-header">
        <div className="page-header-title-group">
          <h1>Faculty Profile Directory</h1>
          <p className="page-header-subtitle">
            Review qualifications, experience and activity summaries for your department.
          </p>
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
              placeholder="Search faculty profiles"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <span className="filter-result-count">{filtered.length} profile(s)</span>
        </div>
      </div>

      {loading ? (
        <Loading message="Loading faculty profiles..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="user"
          title="No profiles found"
          description="No faculty profile matches the current search."
        />
      ) : (
        <div className="faculty-card-grid">
          {filtered.map((member) => (
            <article key={member.id} className="faculty-card">
              <div className="faculty-card-top">
                <div className="faculty-card-avatar">
                  {(member.name || 'F').charAt(0).toUpperCase()}
                </div>
                <div className="faculty-card-identity">
                  <h3 className="faculty-card-name">{member.name}</h3>
                  <p className="faculty-card-role">{member.designation || 'Faculty'}</p>
                  <p className="faculty-card-id">{member.employeeId}</p>
                </div>
                <StatusBadge status={member.status} />
              </div>

              <dl className="faculty-card-stats">
                <div>
                  <dt>Activities</dt>
                  <dd>{member.totalActivities ?? 0}</dd>
                </div>
                <div>
                  <dt>Approved</dt>
                  <dd>{member.approvedActivities ?? 0}</dd>
                </div>
                <div>
                  <dt>API score</dt>
                  <dd>{member.currentScore ?? '—'}</dd>
                </div>
              </dl>

              <button
                type="button"
                className="btn btn-sm btn-secondary btn-block"
                onClick={() => setSelectedId(member.id)}
              >
                <Icon name="eye" size={14} /> View full profile
              </button>
            </article>
          ))}
        </div>
      )}

      <HodFacultyDetailModal facultyId={selectedId} onClose={() => setSelectedId(null)} />
    </Layout>
  );
};

export default HODFacultyProfiles;
