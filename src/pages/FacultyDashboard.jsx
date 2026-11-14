import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { facultyApi } from '../api/facultyApi';
import { useAcademicYears } from '../hooks/useReferenceData';
import { getPercentageClass } from '../utils/helpers';

export const FacultyDashboard = () => {
  const { activeYear } = useAcademicYears();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await facultyApi.getDashboardSummary();
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load faculty dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <Layout title="Faculty Dashboard">
        <Loading message="Loading dashboard metrics..." />
      </Layout>
    );
  }

  const profile = data?.profile || {};
  const stats = data?.stats || {};
  const apiScore = data?.apiScore || {};
  const categories = apiScore.categories || [];
  const completion = Number(data?.completionPercentage) || 0;
  const displayYear = apiScore.academicYear || activeYear;

  return (
    <Layout title="Faculty Dashboard">
      <ErrorMessage message={error} onRetry={loadDashboard} />

      {/* Welcome Banner */}
      <div className="welcome-banner">
        <div className="welcome-info">
          <span className="welcome-greeting">
            {displayYear ? `Academic Year ${displayYear}` : 'Academic Dashboard'}
          </span>
          <h1 className="welcome-name">Welcome back, {profile.fullName || 'Faculty Member'}</h1>
          <div className="welcome-meta">
            <span className="welcome-meta-item">
              Employee ID: <strong>{profile.employeeId || 'N/A'}</strong>
            </span>
            <span className="welcome-meta-item">
              Department: <strong>{profile.department || 'Computer Science'}</strong>
            </span>
            <span className="welcome-meta-item">
              Designation: <strong>{profile.designation || 'Faculty'}</strong>
            </span>
          </div>
        </div>
        <div className="welcome-actions">
          <Link to="/faculty/profile" className="btn btn-secondary">
            Edit Profile
          </Link>
          <Link to="/faculty/activities" className="btn btn-accent">
            + New Activity
          </Link>
        </div>
      </div>

      {/* Profile Completion Indicator Card */}
      <div className="profile-completion-card">
        <div className="profile-completion-header">
          <span className="profile-completion-title">Profile Completion Status</span>
          <span className="profile-completion-pct">{completion}%</span>
        </div>
        <div className="progress-bar-track">
          <div
            className={`progress-bar-fill progress-bar-fill-success ${getPercentageClass(
              completion
            )}`}
          ></div>
        </div>
        <p className="profile-completion-hint">
          Keep your qualifications, teaching workload records, and research documentation up-to-date for accurate PBAS API reporting.
        </p>
      </div>

      {/* KPI Activity Statistics */}
      <div className="grid-4">
        <div className="stat-card">
          <div className="stat-card-label">Total Submitted</div>
          <div className="stat-card-value">{stats.totalSubmitted ?? 0}</div>
          <div className="stat-card-subtext">Across all 3 Categories</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Approved Activities</div>
          <div className="stat-card-value text-success">{stats.approved ?? 0}</div>
          <div className="stat-card-subtext">Verified by Department HOD</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Pending Verification</div>
          <div className="stat-card-value text-warning">{stats.pending ?? 0}</div>
          <div className="stat-card-subtext">Awaiting HOD review</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Revision Required</div>
          <div className="stat-card-value text-danger">{stats.rejected ?? 0}</div>
          <div className="stat-card-subtext">Action needed by faculty</div>
        </div>
      </div>

      {/* Official Backend-Calculated API Score Overview */}
      <div className="academic-card">
        <div className="academic-card-header">
          <h2>Official PBAS API Score Summary</h2>
          <Link to="/faculty/api-score" className="btn btn-sm btn-secondary">
            View Complete Breakdown &rarr;
          </Link>
        </div>
        <div className="academic-card-body">
          {!apiScore.overallScore ? (
            <EmptyState
              icon="chart"
              title="No API score published yet"
              description="The server has not returned a calculated API score for your account. Scores appear after activities are verified."
            />
          ) : (
            <>
          <div className="score-hero-box">
            <div className="score-hero-left">
              <div className="score-badge-circle">
                <span className="score-badge-value">
                  {apiScore.overallScore.finalAccepted ?? '—'}
                </span>
                <span className="score-badge-label">API Score</span>
              </div>
              <div className="score-hero-title-group">
                <h3>Calculated Overall API Score</h3>
                <p>
                  Status: <strong>{apiScore.verificationStatus || 'Not verified'}</strong>
                  {displayYear ? ` • AY ${displayYear}` : ''}
                </p>
              </div>
            </div>
            <div className="score-category-chips">
              {categories.map((cat) => (
                <div key={cat.key} className="score-category-chip">
                  <div className="score-chip-category">{cat.key.toUpperCase()}</div>
                  <div className="score-chip-score">{cat.finalScore} pts</div>
                  <div className="score-chip-limit">Limit: {cat.applicableCap} pts</div>
                </div>
              ))}
            </div>
          </div>

          {/* Category Progress Breakdown */}
          {categories.map((cat) => {
            const cap = Number(cat.applicableCap) || 0;
            const pct = cap
              ? Math.min(100, Math.round((Number(cat.finalScore) || 0) / cap * 100))
              : 0;
            return (
              <div key={cat.key} className="category-score-row">
                <div className="category-score-row-header">
                  <span className="category-score-name">{cat.title}</span>
                  <span className="category-score-value">
                    {cat.finalScore} / {cat.applicableCap} ({pct}%)
                  </span>
                </div>
                <div className="progress-bar-track">
                  <div
                    className={`progress-bar-fill ${getPercentageClass(pct)}`}
                  ></div>
                </div>
              </div>
            );
          })}
            </>
          )}
        </div>
      </div>

      {/* Quick Action Navigation Grid */}
      <div className="grid-3">
        <Link to="/faculty/category-1" className="quick-action-card">
          <div className="quick-action-icon">📖</div>
          <h4 className="quick-action-title">Category I: Teaching &amp; Evaluation</h4>
          <p className="quick-action-desc">
            Submit classroom lectures, course materials, evaluation duties, and student mentoring.
          </p>
        </Link>
        <Link to="/faculty/category-2" className="quick-action-card">
          <div className="quick-action-icon">🤝</div>
          <h4 className="quick-action-title">Category II: Co-Curricular &amp; FDP</h4>
          <p className="quick-action-desc">
            Record workshops, FDPs, student clubs, community outreach, and committee work.
          </p>
        </Link>
        <Link to="/faculty/category-3" className="quick-action-card">
          <div className="quick-action-icon">🔬</div>
          <h4 className="quick-action-title">Category III: Research &amp; Publications</h4>
          <p className="quick-action-desc">
            Log peer-reviewed journals, book chapters, sponsored grants, patents, and awards.
          </p>
        </Link>
      </div>

      {/* Recent Activity Updates Feed */}
      <div className="academic-card">
        <div className="academic-card-header">
          <h2>Recent Academic Activity Submissions</h2>
          <Link to="/faculty/activities" className="btn btn-sm btn-secondary">
            View All Activities
          </Link>
        </div>
        {(data?.recentActivities || []).length === 0 ? (
          <div className="academic-card-body">
            <EmptyState
              icon="list"
              title="No activities submitted yet"
              description="Add your first teaching, co-curricular or research activity to begin building your API record."
              action={
                <Link to="/faculty/activities" className="btn btn-primary">
                  Add an activity
                </Link>
              }
            />
          </div>
        ) : (
        <div className="table-responsive">
          <table className="academic-table">
            <thead>
              <tr>
                <th>Activity Title</th>
                <th>Category</th>
                <th>Submission Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recentActivities || []).map((act) => (
                <tr key={act.id}>
                  <td>
                    <div className="table-cell-title">{act.title}</div>
                    <div className="table-cell-subtext">{act.activityType}</div>
                  </td>
                  <td>{act.category}</td>
                  <td>{act.submissionDate || act.activityDate}</td>
                  <td>
                    <StatusBadge status={act.status} />
                  </td>
                  <td>
                    <Link to="/faculty/activities" className="table-btn">
                      View Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </Layout>
  );
};

export default FacultyDashboard;
