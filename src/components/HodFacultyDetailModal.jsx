import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import Loading from './Loading';
import ErrorMessage from './ErrorMessage';
import StatusBadge from './StatusBadge';
import EmptyState from './EmptyState';
import { hodApi } from '../api/hodApi';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

export const HodFacultyDetailModal = ({ facultyId, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!facultyId) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    setData(null);

    hodApi
      .getFacultyDetail(facultyId)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (active) setError(err.message || 'Unable to load this faculty profile.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [facultyId]);

  const profile = data?.profile || {};
  const stats = data?.stats || {};
  const score = data?.apiScore;

  return (
    <Modal isOpen={Boolean(facultyId)} onClose={onClose} title="Faculty Profile" size="xl">
      {loading && <Loading message="Loading faculty profile..." />}
      {!loading && error && <ErrorMessage message={error} />}
      {!loading && !error && data && (
        <div className="detail-stack">
          <div className="faculty-summary-header">
            <div className="faculty-summary-avatar">
              {(profile.fullName || 'F').charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="faculty-summary-name">{profile.fullName || 'Faculty member'}</h3>
              <p className="faculty-summary-meta">
                {profile.employeeId || '—'} &bull; {profile.designation || '—'} &bull;{' '}
                {profile.department || '—'}
              </p>
              <p className="faculty-summary-meta">
                {profile.email || '—'} &bull; {profile.phone || '—'}
              </p>
            </div>
          </div>

          <div className="grid-4">
            <div className="stat-card stat-card-compact">
              <div className="stat-card-label">Total activities</div>
              <div className="stat-card-value">{stats.totalActivities ?? 0}</div>
            </div>
            <div className="stat-card stat-card-compact">
              <div className="stat-card-label">Approved</div>
              <div className="stat-card-value text-success">{stats.approved ?? 0}</div>
            </div>
            <div className="stat-card stat-card-compact">
              <div className="stat-card-label">Pending</div>
              <div className="stat-card-value text-warning">{stats.pending ?? 0}</div>
            </div>
            <div className="stat-card stat-card-compact">
              <div className="stat-card-label">API score</div>
              <div className="stat-card-value">
                {score?.overallScore?.finalAccepted ?? '—'}
              </div>
            </div>
          </div>

          <section className="detail-section">
            <h4 className="detail-section-title">Profile completion</h4>
            <div className="progress-bar-track">
              <div
                className="progress-bar-fill"
                style={{ width: `${Math.max(0, Math.min(100, data.completionPercentage || 0))}%` }}
              ></div>
            </div>
            <p className="detail-section-hint">{data.completionPercentage || 0}% complete</p>
          </section>

          <section className="detail-section">
            <h4 className="detail-section-title">Educational qualifications</h4>
            {(data.qualifications || []).length === 0 ? (
              <p className="text-muted">No qualifications recorded.</p>
            ) : (
              <ul className="detail-list">
                {data.qualifications.map((item) => (
                  <li key={item.id}>
                    <strong>{item.degree}</strong> — {item.specialization || '—'},{' '}
                    {item.university || '—'} ({item.yearOfPassing || '—'})
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="detail-section">
            <h4 className="detail-section-title">Work experience</h4>
            {(data.experience || []).length === 0 ? (
              <p className="text-muted">No experience recorded.</p>
            ) : (
              <ul className="detail-list">
                {data.experience.map((item) => (
                  <li key={item.id}>
                    <strong>{item.designation}</strong>, {item.institution} —{' '}
                    {formatDate(item.startDate)} to {item.isCurrent ? 'Present' : formatDate(item.endDate)}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="detail-section">
            <h4 className="detail-section-title">Recent activities</h4>
            {(data.activities || []).length === 0 ? (
              <EmptyState
                icon="list"
                title="No activities submitted"
                description="This faculty member has not submitted any activity records."
              />
            ) : (
              <div className="table-responsive">
                <table className="academic-table">
                  <thead>
                    <tr>
                      <th>Activity</th>
                      <th>Category</th>
                      <th>Academic year</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.activities.slice(0, 8).map((activity) => (
                      <tr key={activity.id}>
                        <td>{activity.title}</td>
                        <td>{activity.category}</td>
                        <td>{activity.academicYear}</td>
                        <td><StatusBadge status={activity.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
};

export default HodFacultyDetailModal;
