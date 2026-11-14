import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import useAuth from '../hooks/useAuth';
import { hodApi } from '../api/hodApi';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

export const HODDashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await hodApi.getDepartmentSummary());
    } catch (err) {
      setError(err.message || 'Unable to load the department dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const facultyOverview = data?.facultyScoreOverview || [];
  const recentSubmissions = data?.recentSubmissions || [];

  return (
    <Layout title="HOD Dashboard">
      <div className="welcome-banner">
        <div className="welcome-info">
          <span className="welcome-greeting">Department Verification Desk</span>
          <h1 className="welcome-name">{data?.departmentName || user?.department || 'Department'}</h1>
          <div className="welcome-meta">
            <span className="welcome-meta-item">Head of Department: <strong>{user?.name || '—'}</strong></span>
            <span className="welcome-meta-item">Employee ID: <strong>{user?.employeeId || '—'}</strong></span>
          </div>
        </div>
        <div className="welcome-actions">
          <Link to="/hod/verification" className="btn btn-accent">
            <Icon name="checkCircle" size={16} /> Verify activities
          </Link>
        </div>
      </div>

      <ErrorMessage message={error} onRetry={load} />

      {loading ? (
        <Loading message="Loading department metrics..." />
      ) : (
        <>
          <div className="grid-4">
            <div className="stat-card">
              <div className="stat-card-label">Faculty Members</div>
              <div className="stat-card-value">{data?.totalFaculty ?? 0}</div>
              <div className="stat-card-subtext">In your authorized department</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Submitted Activities</div>
              <div className="stat-card-value">{data?.totalSubmitted ?? 0}</div>
              <div className="stat-card-subtext">Excluding drafts</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Pending Verification</div>
              <div className="stat-card-value text-warning">{data?.pendingVerification ?? 0}</div>
              <div className="stat-card-subtext">Awaiting your decision</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Approved / Rejected</div>
              <div className="stat-card-value">
                <span className="text-success">{data?.approvedActivities ?? 0}</span>
                <span className="text-muted"> / </span>
                <span className="text-danger">{data?.rejectedActivities ?? 0}</span>
              </div>
              <div className="stat-card-subtext">Verified records</div>
            </div>
          </div>

          <div className="academic-card">
            <div className="academic-card-header">
              <h2>Faculty API Score Overview</h2>
              <Link to="/hod/faculty-members" className="btn btn-sm btn-secondary">
                All faculty members
              </Link>
            </div>
            {facultyOverview.length === 0 ? (
              <div className="academic-card-body">
                <EmptyState
                  icon="users"
                  title="No faculty members found"
                  description="Faculty accounts linked to your department will appear here."
                />
              </div>
            ) : (
              <div className="table-responsive">
                <table className="academic-table">
                  <thead>
                    <tr>
                      <th>Faculty</th>
                      <th>Employee ID</th>
                      <th>Submitted</th>
                      <th>Approved</th>
                      <th>Pending</th>
                      <th>API Score</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facultyOverview.map((member) => (
                      <tr key={member.id}>
                        <td>
                          <div className="table-cell-title">{member.name}</div>
                        </td>
                        <td>{member.employeeId}</td>
                        <td>{member.submitted ?? 0}</td>
                        <td className="text-success">{member.approved ?? 0}</td>
                        <td className="text-warning">{member.pending ?? 0}</td>
                        <td>
                          {member.score === null || member.score === undefined ? (
                            <span className="text-muted">Not calculated</span>
                          ) : (
                            <strong>{member.score}</strong>
                          )}
                        </td>
                        <td>
                          <StatusBadge status={member.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="academic-card">
            <div className="academic-card-header">
              <h2>Recent Submissions</h2>
              <Link to="/hod/pending-approvals" className="btn btn-sm btn-secondary">
                Pending queue
              </Link>
            </div>
            {recentSubmissions.length === 0 ? (
              <div className="academic-card-body">
                <EmptyState
                  icon="clock"
                  title="No submissions yet"
                  description="Activities submitted by your faculty will appear here."
                />
              </div>
            ) : (
              <div className="table-responsive">
                <table className="academic-table">
                  <thead>
                    <tr>
                      <th>Faculty</th>
                      <th>Activity</th>
                      <th>Category</th>
                      <th>Submitted</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSubmissions.map((activity) => (
                      <tr key={activity.id}>
                        <td>
                          <div className="table-cell-title">{activity.facultyName}</div>
                          <div className="table-cell-subtext">{activity.employeeId}</div>
                        </td>
                        <td>{activity.title}</td>
                        <td>{activity.category}</td>
                        <td>{formatDate(activity.submissionDate)}</td>
                        <td><StatusBadge status={activity.status} /></td>
                        <td>
                          <Link to="/hod/verification" className="table-btn">
                            Review
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </Layout>
  );
};

export default HODDashboard;
