import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import { adminApi } from '../api/adminApi';
import { formatDateTime } from '../utils/helpers';

export const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.getAuditLogs();
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Unable to load audit logs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const actions = useMemo(
    () => [...new Set(logs.map((log) => log.action).filter(Boolean))].sort(),
    [logs]
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return logs.filter((log) => {
      const matchesAction = actionFilter === 'all' || log.action === actionFilter;
      const matchesSearch =
        !needle ||
        [log.actor, log.action, log.target, log.ipAddress]
          .join(' ')
          .toLowerCase()
          .includes(needle);
      return matchesAction && matchesSearch;
    });
  }, [actionFilter, logs, search]);

  return (
    <Layout title="Audit Logs">
      <div className="page-header">
        <div className="page-header-title-group">
          <h1>Audit Logs</h1>
          <p className="page-header-subtitle">
            Read-only trail of administrative and verification actions recorded by the backend.
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
              placeholder="Search actor, target or IP address"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select
            className="filter-select"
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
            aria-label="Filter by action"
          >
            <option value="all">All actions</option>
            {actions.map((action) => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
          <span className="filter-result-count">{filtered.length} entr(ies)</span>
        </div>
      </div>

      {loading ? (
        <Loading message="Loading audit trail..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="history"
          title="No audit entries"
          description="No log entry matches the current filters."
        />
      ) : (
        <div className="academic-card">
          <div className="table-responsive">
            <table className="academic-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>IP address</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => (
                  <tr key={log.id}>
                    <td className="text-nowrap">{formatDateTime(log.timestamp)}</td>
                    <td>{log.actor || '—'}</td>
                    <td><span className="code-pill">{log.action}</span></td>
                    <td>{log.target || '—'}</td>
                    <td>{log.ipAddress || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default AuditLogs;
