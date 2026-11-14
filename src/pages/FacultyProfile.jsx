import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import { facultyApi } from '../api/facultyApi';
import { getPercentageClass } from '../utils/helpers';

export const FacultyProfile = () => {
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  const loadProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await facultyApi.getProfile();
      setProfile(data);
      setFormData(data.personalInfo || {});
    } catch (err) {
      setError(err.message || 'Failed to load profile data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const validate = () => {
    const errs = {};
    if (!formData.fullName?.trim()) errs.fullName = 'Full name is required.';
    if (!formData.employeeId?.trim()) errs.employeeId = 'Employee ID is required.';
    if (!formData.email?.trim()) {
      errs.email = 'Email is required.';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errs.email = 'Enter a valid email address.';
    }
    if (!formData.phone?.trim()) errs.phone = 'Contact number is required.';
    if (!formData.department?.trim()) errs.department = 'Department is required.';
    if (!formData.designation?.trim()) errs.designation = 'Designation is required.';
    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (validationErrors[name]) {
      setValidationErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validate()) return;

    setSaving(true);
    try {
      await facultyApi.updatePersonalInfo(formData);
      setProfile((prev) => ({ ...prev, personalInfo: formData }));
      setIsEditing(false);
      setSuccess('Personal information has been successfully updated.');
    } catch (err) {
      setError(err.message || 'Error updating profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData(profile?.personalInfo || {});
    setValidationErrors({});
    setIsEditing(false);
  };

  if (loading) {
    return (
      <Layout title="My Profile">
        <Loading message="Loading faculty profile details..." />
      </Layout>
    );
  }

  const pInfo = isEditing ? formData : (profile?.personalInfo || {});
  const personalFields = [
    'fullName',
    'employeeId',
    'dateOfBirth',
    'gender',
    'email',
    'phone',
    'address',
    'department',
    'designation',
    'dateOfJoining',
  ];
  const filledFields = personalFields.filter((field) => String(pInfo[field] || '').trim()).length;
  const sectionRatio = [
    filledFields / personalFields.length,
    (profile?.qualifications || []).length ? 1 : 0,
    (profile?.experience || []).length ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0) / 3;
  const completionPercentage = Math.round(sectionRatio * 100);
  const completionStatus =
    completionPercentage >= 85 ? 'Excellent' : completionPercentage >= 60 ? 'Good' : 'Needs attention';

  return (
    <Layout title="Faculty Profile">
      <div className="page-header">
        <div className="page-header-title-group">
          <h1>Faculty Profile Management</h1>
          <p className="page-header-subtitle">
            Manage your personal academic records, qualifications, and employment history
          </p>
        </div>
        <div className="page-header-actions">
          {!isEditing ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsEditing(true)}
            >
              ✎ Edit Personal Info
            </button>
          ) : (
            <div className="form-actions-inline">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCancel}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-success"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : '💾 Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>

      <ErrorMessage message={error} onRetry={loadProfile} />

      {success && (
        <div className="alert-box alert-box-success" role="alert">
          {success}
        </div>
      )}

      {/* Completion Indicator Card */}
      <div className="profile-completion-card">
        <div className="profile-completion-header">
          <span className="profile-completion-title">Profile Completeness: {completionPercentage}%</span>
          <span className="profile-completion-pct">Status: {completionStatus}</span>
        </div>
        <div className="progress-bar-track">
          <div
            className={`progress-bar-fill progress-bar-fill-success ${getPercentageClass(
              completionPercentage
            )}`}
          ></div>
        </div>
      </div>

      {/* Section 1: Personal Information Form */}
      <div className="academic-card">
        <div className="academic-card-header">
          <h2>Personal &amp; Institutional Information</h2>
          <span className="status-pill status-submitted">Official Record</span>
        </div>
        <div className="academic-card-body">
          <form onSubmit={handleSave}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label required" htmlFor="fullName">Full Name</label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  className={`form-control ${validationErrors.fullName ? 'is-invalid' : ''}`}
                  value={pInfo.fullName || ''}
                  onChange={handleChange}
                  disabled={!isEditing || saving}
                />
                {validationErrors.fullName && <span className="form-error">{validationErrors.fullName}</span>}
              </div>

              <div className="form-group">
                <label className="form-label required" htmlFor="employeeId">Employee ID</label>
                <input
                  id="employeeId"
                  name="employeeId"
                  type="text"
                  className={`form-control ${validationErrors.employeeId ? 'is-invalid' : ''}`}
                  value={pInfo.employeeId || ''}
                  onChange={handleChange}
                  disabled={!isEditing || saving}
                />
                {validationErrors.employeeId && <span className="form-error">{validationErrors.employeeId}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="dateOfBirth">Date of Birth</label>
                <input
                  id="dateOfBirth"
                  name="dateOfBirth"
                  type="date"
                  className="form-control"
                  value={pInfo.dateOfBirth || ''}
                  onChange={handleChange}
                  disabled={!isEditing || saving}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="gender">Gender</label>
                <select
                  id="gender"
                  name="gender"
                  className="form-control"
                  value={pInfo.gender || ''}
                  onChange={handleChange}
                  disabled={!isEditing || saving}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label required" htmlFor="email">Email Address</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className={`form-control ${validationErrors.email ? 'is-invalid' : ''}`}
                  value={pInfo.email || ''}
                  onChange={handleChange}
                  disabled={!isEditing || saving}
                />
                {validationErrors.email && <span className="form-error">{validationErrors.email}</span>}
              </div>

              <div className="form-group">
                <label className="form-label required" htmlFor="phone">Phone Number</label>
                <input
                  id="phone"
                  name="phone"
                  type="text"
                  className={`form-control ${validationErrors.phone ? 'is-invalid' : ''}`}
                  value={pInfo.phone || ''}
                  onChange={handleChange}
                  disabled={!isEditing || saving}
                />
                {validationErrors.phone && <span className="form-error">{validationErrors.phone}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label required" htmlFor="department">Department</label>
                <input
                  id="department"
                  name="department"
                  type="text"
                  className={`form-control ${validationErrors.department ? 'is-invalid' : ''}`}
                  value={pInfo.department || ''}
                  onChange={handleChange}
                  disabled={!isEditing || saving}
                />
              </div>

              <div className="form-group">
                <label className="form-label required" htmlFor="designation">Designation</label>
                <input
                  id="designation"
                  name="designation"
                  type="text"
                  className={`form-control ${validationErrors.designation ? 'is-invalid' : ''}`}
                  value={pInfo.designation || ''}
                  onChange={handleChange}
                  disabled={!isEditing || saving}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="dateOfJoining">Date of Joining</label>
                <input
                  id="dateOfJoining"
                  name="dateOfJoining"
                  type="date"
                  className="form-control"
                  value={pInfo.dateOfJoining || ''}
                  onChange={handleChange}
                  disabled={!isEditing || saving}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="address">Official / Residential Address</label>
                <input
                  id="address"
                  name="address"
                  type="text"
                  className="form-control"
                  value={pInfo.address || ''}
                  onChange={handleChange}
                  disabled={!isEditing || saving}
                />
              </div>
            </div>

            {isEditing && (
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-success" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Personal Details'}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Section 2: Educational Qualifications Snapshot */}
      <div className="academic-card">
        <div className="academic-card-header">
          <h2>Educational Qualifications</h2>
          <Link to="/faculty/qualifications" className="btn btn-sm btn-accent">
            Manage Qualifications ({profile?.qualifications?.length || 0}) &rarr;
          </Link>
        </div>
        <div className="table-responsive">
          <table className="academic-table">
            <thead>
              <tr>
                <th>Degree</th>
                <th>Specialization</th>
                <th>University / Board</th>
                <th>Year</th>
                <th>CGPA / %</th>
              </tr>
            </thead>
            <tbody>
              {(profile?.qualifications || []).map((q) => (
                <tr key={q.id}>
                  <td><strong>{q.degree}</strong></td>
                  <td>{q.specialization}</td>
                  <td>{q.university}</td>
                  <td>{q.yearOfPassing}</td>
                  <td>{q.percentageOrCgpa}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: Work Experience Snapshot */}
      <div className="academic-card">
        <div className="academic-card-header">
          <h2>Academic &amp; Professional Experience</h2>
          <Link to="/faculty/experience" className="btn btn-sm btn-accent">
            Manage Experience ({profile?.experience?.length || 0}) &rarr;
          </Link>
        </div>
        <div className="table-responsive">
          <table className="academic-table">
            <thead>
              <tr>
                <th>Institution</th>
                <th>Designation</th>
                <th>Employment Type</th>
                <th>Duration</th>
                <th>Total Exp.</th>
              </tr>
            </thead>
            <tbody>
              {(profile?.experience || []).map((exp) => (
                <tr key={exp.id}>
                  <td><strong>{exp.institution}</strong></td>
                  <td>{exp.designation}</td>
                  <td>{exp.employmentType}</td>
                  <td>
                    {exp.startDate} &mdash; {exp.endDate || 'Present'}
                  </td>
                  <td>{exp.totalExperience}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
};

export default FacultyProfile;
