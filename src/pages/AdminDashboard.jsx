import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import useAuth from '../hooks/useAuth';
import { adminApi } from '../api/adminApi';
import { formatDateTime } from '../utils/helpers';

export const AdminDashboard = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setMetrics(await adminApi.getSystemMetrics());
    } catch (err) {
      setError(err.message || 'Unable to load system metrics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const summary = metrics?.systemActivitySummary || [];

  return (
    <Layout title="Admin Dashboard">
      <div className="welcome-banner">
        <div className="welcome-info">
          <span className="welcome-greeting">System Administration</span>
          <h1 className="welcome-name">Welcome, {user?.name || 'Administrator'}</h1>
          <div className="welcome-meta">
            <span className="welcome-meta-item">
              Active academic year: <strong>{metrics?.activeAcademicYear || '—'}</strong>
            </span>
            <span className="welcome-meta-item">Role: <strong>System Administrator</strong></span>
          </div>
        </div>
        <div className="welcome-actions">
          <Link to="/admin/users" className="btn btn-accent">
            <Icon name="users" size={16} /> Manage users
          </Link>
        </div>
      </div>

      <ErrorMessage message={error} onRetry={load} />

      {loading ? (
        <Loading message="Loading system overview..." />
      ) : (
        <>
          <div className="grid-4">
            <div className="stat-card">
              <div className="stat-card-label">Registered users</div>
              <div className="stat-card-value">{metrics?.totalUsers ?? 0}</div>
              <div className="stat-card-subtext">All roles</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Faculty members</div>
              <div className="stat-card-value">{metrics?.totalFaculty ?? 0}</div>
              <div className="stat-card-subtext">Active profiles</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Departments</div>
              <div className="stat-card-value">{metrics?.totalDepartments ?? 0}</div>
              <div className="stat-card-subtext">Across the institution</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Pending approvals</div>
              <div className="stat-card-value text-warning">{metrics?.pendingApprovals ?? 0}</div>
              <div className="stat-card-subtext">Awaiting HOD decisions</div>
            </div>
          </div>

          <div className="grid-3">
            <Link to="/admin/departments" className="quick-action-card">
              <div className="quick-action-icon"><Icon name="building" size={22} /></div>
              <h4 className="quick-action-title">Departments</h4>
              <p className="quick-action-desc">Maintain department records and Heads of Department.</p>
            </Link>
            <Link to="/admin/scoring-rules" className="quick-action-card">
              <div className="quick-action-icon"><Icon name="edit" size={22} /></div>
              <h4 className="quick-action-title">API scoring rules</h4>
              <p className="quick-action-desc">Review rule versions and configured category limits.</p>
            </Link>
            <Link to="/admin/audit-logs" className="quick-action-card">
              <div className="quick-action-icon"><Icon name="history" size={22} /></div>
              <h4 className="quick-action-title">Audit trail</h4>
              <p className="quick-action-desc">Inspect administrative and verification actions.</p>
            </Link>
          </div>

          <div className="academic-card">
            <div className="academic-card-header">
              <h2>System Activity Summary</h2>
              <Link to="/admin/audit-logs" className="btn btn-sm btn-secondary">
                Full audit log
              </Link>
            </div>
            {summary.length === 0 ? (
              <div className="academic-card-body">
                <EmptyState
                  icon="history"
                  title="No recent system activity"
                  description="Administrative actions will be recorded here."
                />
              </div>
            ) : (
              <ul className="activity-timeline">
                {summary.map((item) => (
                  <li key={item.id}>
                    <span className="activity-timeline-dot" aria-hidden="true"></span>
                    <div>
                      <strong>{item.action}</strong>
                      <p>{item.target}</p>
                      <time>{formatDateTime(item.time)}</time>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="info-strip">
            <div>
              <span className="info-strip-label">Total activities</span>
              <span>{metrics?.totalActivities ?? 0}</span>
            </div>
            <div>
              <span className="info-strip-label">Academic year</span>
              <span>{metrics?.activeAcademicYear || 'Not configured'}</span>
            </div>
            <div>
              <span className="info-strip-label">API scoring</span>
              <span>Calculated by the backend only</span>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
};

export default AdminDashboard;
