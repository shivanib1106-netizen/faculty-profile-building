import React, { useCallback, useEffect, useState } from 'react';
import Layout from '../components/Layout';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import Icon from '../components/Icon';
import { scoreApi } from '../api/scoreApi';
import { useAcademicYears } from '../hooks/useReferenceData';
import { formatDate } from '../utils/helpers';

const scorePercent = (score, cap) => {
  const numericScore = Number(score) || 0;
  const numericCap = Number(cap) || 0;
  if (!numericCap) return 0;
  return Math.max(0, Math.min(100, Math.round((numericScore / numericCap) * 100)));
};

export const APIScore = () => {
  const { years, activeYear, loading: yearsLoading } = useAcademicYears();
  const [selectedYear, setSelectedYear] = useState('');
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!selectedYear && activeYear) setSelectedYear(activeYear);
  }, [activeYear, selectedYear]);

  const load = useCallback(async () => {
    if (!selectedYear) return;
    setLoading(true);
    setError('');
    setScore(null);
    try {
      setScore(await scoreApi.getApiScore(selectedYear));
    } catch (err) {
      if (err.status === 404) {
        setScore(null);
      } else {
        setError(err.message || 'Unable to load the API score.');
      }
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    load();
  }, [load]);

  const categories = score?.categories || [];
  const overall = score?.overallScore || {};

  return (
    <Layout title="API Score">
      <div className="page-header">
        <div className="page-header-title-group">
          <h1>Official API Score</h1>
          <p className="page-header-subtitle">
            Calculated and verified by the server. This screen displays scores and never calculates them.
          </p>
        </div>
        <div className="page-header-actions">
          <div className="form-group form-group-inline">
            <label className="form-label" htmlFor="score-year">Academic year</label>
            <select
              id="score-year"
              className="filter-select"
              value={selectedYear}
              onChange={(event) => setSelectedYear(event.target.value)}
              disabled={yearsLoading}
            >
              <option value="">Select year</option>
              {years.map((year) => (
                <option key={year.id || year.year} value={year.year}>
                  {year.year}{year.status === 'Active' ? ' (Active)' : ''}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="btn btn-secondary" onClick={load} disabled={loading || !selectedYear}>
            <Icon name="refresh" size={15} /> Refresh
          </button>
        </div>
      </div>

      <ErrorMessage message={error} onRetry={load} />

      {loading ? (
        <Loading message="Fetching official API score..." />
      ) : !score ? (
        <EmptyState
          icon="chart"
          title="No score available for this year"
          description="The server has not published a calculated API score for the selected academic year yet. Pending activities must be verified first."
        />
      ) : (
        <>
          <div className="score-hero-box score-hero-box-large">
            <div className="score-hero-left">
              <div className="score-badge-circle">
                <span className="score-badge-value">{overall.finalAccepted ?? '—'}</span>
                <span className="score-badge-label">Final accepted</span>
              </div>
              <div className="score-hero-title-group">
                <h2>Overall API Score</h2>
                <p>
                  Academic year <strong>{score.academicYear || selectedYear}</strong> &bull; Calculated{' '}
                  {score.calculationDate ? formatDate(score.calculationDate) : 'date not provided'}
                </p>
                <div className="score-status-row">
                  <StatusBadge status={score.verificationStatus || 'Not verified'} />
                  <span className="score-source-note">
                    <Icon name="shield" size={14} /> Source: Flask scoring service
                  </span>
                </div>
              </div>
            </div>
            <dl className="score-hero-figures">
              <div>
                <dt>Claimed</dt>
                <dd>{overall.totalClaimed ?? '—'}</dd>
              </div>
              <div>
                <dt>Approved</dt>
                <dd>{overall.totalApproved ?? '—'}</dd>
              </div>
              <div>
                <dt>Applicable cap</dt>
                <dd>{overall.applicableCap ?? '—'}</dd>
              </div>
              <div>
                <dt>Final accepted</dt>
                <dd>{overall.finalAccepted ?? '—'}</dd>
              </div>
            </dl>
          </div>

          <div className="section-heading">
            <h2>Category-wise breakdown</h2>
            <p>Pending and provisional values are labelled exactly as returned by the server.</p>
          </div>

          {categories.length === 0 ? (
            <EmptyState
              icon="chart"
              title="No category breakdown returned"
              description="The server did not include a category breakdown for this score."
            />
          ) : (
            <div className="score-category-grid">
              {categories.map((category) => {
                const percent = scorePercent(category.finalScore, category.applicableCap);
                return (
                  <article key={category.key} className="score-category-card">
                    <div className="score-category-card-head">
                      <h3>{category.title || category.key}</h3>
                      <StatusBadge status={category.status || score.verificationStatus} />
                    </div>

                    <div className="score-category-figures">
                      <div>
                        <span className="score-figure-label">Activities</span>
                        <span className="score-figure-value">{category.totalActivities ?? '—'}</span>
                      </div>
                      <div>
                        <span className="score-figure-label">Approved</span>
                        <span className="score-figure-value">{category.approvedActivities ?? '—'}</span>
                      </div>
                      <div>
                        <span className="score-figure-label">Raw</span>
                        <span className="score-figure-value">{category.rawScore ?? '—'}</span>
                      </div>
                      <div>
                        <span className="score-figure-label">Eligible</span>
                        <span className="score-figure-value">{category.eligibleScore ?? '—'}</span>
                      </div>
                    </div>

                    <div className="score-category-progress">
                      <div className="score-category-progress-labels">
                        <span>
                          Final <strong>{category.finalScore ?? '—'}</strong>
                        </span>
                        <span>Cap {category.applicableCap ?? '—'}</span>
                      </div>
                      <div className="progress-bar-track">
                        <div className="progress-bar-fill" style={{ width: `${percent}%` }}></div>
                      </div>
                      <span className="score-percent-note">{percent}% of applicable cap</span>
                    </div>

                    {(category.breakdown || []).length > 0 && (
                      <div className="table-responsive">
                        <table className="academic-table academic-table-compact">
                          <thead>
                            <tr>
                              <th>Component</th>
                              <th>Claimed</th>
                              <th>Approved</th>
                            </tr>
                          </thead>
                          <tbody>
                            {category.breakdown.map((row, index) => (
                              <tr key={`${category.key}-${index}`}>
                                <td>{row.item}</td>
                                <td>{row.claimed ?? '—'}</td>
                                <td>{row.approved ?? '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          <div className="alert-box alert-box-info score-disclaimer">
            <Icon name="info" size={16} />
            <div>
              Scores shown here are calculated exclusively by the backend scoring rules. The frontend
              does not apply, adjust or recalculate any formula. Contact the API cell if a value looks
              incorrect.
            </div>
          </div>
        </>
      )}
    </Layout>
  );
};

export default APIScore;
