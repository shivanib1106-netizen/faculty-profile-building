import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api/authApi';

export const Register = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: '',
    employeeId: '',
    email: '',
    phone: '',
    department: '',
    designation: 'Assistant Professor',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const designations = [
    'Assistant Professor',
    'Associate Professor',
    'Professor',
    'Professor & Head',
    'Adjunct Faculty',
  ];

  const validate = () => {
    const errs = {};
    if (!formData.fullName.trim()) errs.fullName = 'Full name is required.';
    if (!formData.employeeId.trim()) errs.employeeId = 'Employee ID is required.';
    if (!formData.email.trim()) {
      errs.email = 'Email address is required.';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errs.email = 'Please provide a valid email format.';
    }
    if (!formData.phone.trim()) {
      errs.phone = 'Contact number is required.';
    } else if (!/^\+?[0-9\s-]{10,14}$/.test(formData.phone)) {
      errs.phone = 'Enter a valid 10-digit phone number.';
    }
    if (!formData.department.trim()) errs.department = 'Department is required.';
    if (!formData.password) {
      errs.password = 'Password is required.';
    } else if (formData.password.length < 8) {
      errs.password = 'Password must be at least 8 characters.';
    }
    if (formData.password !== formData.confirmPassword) {
      errs.confirmPassword = 'Passwords do not match.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    setSuccessMessage('');

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const response = await authApi.register({
        name: formData.fullName.trim(),
        employeeId: formData.employeeId.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        department: formData.department.trim(),
        designation: formData.designation,
        password: formData.password,
      });
      setSuccessMessage(
        response.message || 'Registration submitted! Please login with your credentials.'
      );
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setApiError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card auth-card-wide">
        <div className="auth-header">
          <div className="auth-logo-badge">FP</div>
          <h1 className="auth-title">Faculty Registration</h1>
          <p className="auth-subtitle">Create an official academic portal account</p>
        </div>

        <div className="auth-body">
          {successMessage && (
            <div className="alert-box alert-box-success" role="alert">
              {successMessage}
            </div>
          )}

          {apiError && (
            <div className="alert-box alert-box-danger" role="alert">
              {apiError}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label required" htmlFor="fullName">
                  Full Name (with Prefix)
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  className={`form-control ${errors.fullName ? 'is-invalid' : ''}`}
                  placeholder="e.g. Dr. Ramesh Sharma"
                  value={formData.fullName}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
                {errors.fullName && <span className="form-error">{errors.fullName}</span>}
              </div>

              <div className="form-group">
                <label className="form-label required" htmlFor="employeeId">
                  Employee ID / Biometric Code
                </label>
                <input
                  id="employeeId"
                  name="employeeId"
                  type="text"
                  className={`form-control ${errors.employeeId ? 'is-invalid' : ''}`}
                  placeholder="e.g. FAC101"
                  value={formData.employeeId}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
                {errors.employeeId && <span className="form-error">{errors.employeeId}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label required" htmlFor="email">
                  Institutional Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                  placeholder="name@college.edu"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
                {errors.email && <span className="form-error">{errors.email}</span>}
              </div>

              <div className="form-group">
                <label className="form-label required" htmlFor="phone">
                  Mobile Number
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  className={`form-control ${errors.phone ? 'is-invalid' : ''}`}
                  placeholder="+91 9876543210"
                  value={formData.phone}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
                {errors.phone && <span className="form-error">{errors.phone}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label required" htmlFor="department">
                  Department
                </label>
                <input
                  id="department"
                  name="department"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Computer Science and Engineering"
                  value={formData.department}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
                {errors.department && <span className="form-error">{errors.department}</span>}
              </div>

              <div className="form-group">
                <label className="form-label required" htmlFor="designation">
                  Designation
                </label>
                <select
                  id="designation"
                  name="designation"
                  className="form-control"
                  value={formData.designation}
                  onChange={handleChange}
                  disabled={isSubmitting}
                >
                  {designations.map((desig) => (
                    <option key={desig} value={desig}>
                      {desig}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label required" htmlFor="password">
                  Password
                </label>
                <div className="password-input-wrapper">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    className={`form-control ${errors.password ? 'is-invalid' : ''}`}
                    placeholder="Min. 8 characters"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label="Toggle password"
                    tabIndex={-1}
                  >
                    {showPassword ? '👁️' : '🔒'}
                  </button>
                </div>
                {errors.password && <span className="form-error">{errors.password}</span>}
              </div>

              <div className="form-group">
                <label className="form-label required" htmlFor="confirmPassword">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  className={`form-control ${errors.confirmPassword ? 'is-invalid' : ''}`}
                  placeholder="Re-enter password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
                {errors.confirmPassword && (
                  <span className="form-error">{errors.confirmPassword}</span>
                )}
              </div>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={isSubmitting}>
              {isSubmitting ? 'Registering Account...' : 'Complete Registration'}
            </button>
          </form>
        </div>

        <div className="auth-footer">
          Already registered in the system? <Link to="/login">Sign In here</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
