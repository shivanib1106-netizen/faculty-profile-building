import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { isDemoMode } from '../api/apiClient';

export const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if session expired
  const sessionExpired = new URLSearchParams(location.search).get('session_expired');

  const validate = () => {
    const errs = {};
    if (!identifier.trim()) {
      errs.identifier = 'Email or Employee ID is required.';
    }
    if (!password) {
      errs.password = 'Password is required.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const result = await login(identifier.trim(), password, rememberMe);
      const userRole = result?.user?.role;

      // Redirect based on role or return to attempted page
      const from = location.state?.from?.pathname;
      if (from && !from.includes('/login')) {
        navigate(from, { replace: true });
      } else if (userRole === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else if (userRole === 'hod') {
        navigate('/hod/dashboard', { replace: true });
      } else {
        navigate('/faculty/dashboard', { replace: true });
      }
    } catch (err) {
      setApiError(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo-badge">FP</div>
          <h1 className="auth-title">College Academic Portal</h1>
          <p className="auth-subtitle">Faculty Profile &amp; Automated API Calculation System</p>
        </div>

        <div className="auth-body">
          {sessionExpired && (
            <div className="alert-box alert-box-warning" role="alert">
              Your session has expired. Please sign in again.
            </div>
          )}

          {apiError && (
            <div className="alert-box alert-box-danger" role="alert">
              {apiError}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label required" htmlFor="identifier">
                Email or Employee ID
              </label>
              <input
                id="identifier"
                type="text"
                className={`form-control ${errors.identifier ? 'is-invalid' : ''}`}
                placeholder="Enter your institutional email or employee ID"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (errors.identifier) setErrors((prev) => ({ ...prev, identifier: '' }));
                }}
                disabled={isSubmitting}
                autoFocus
              />
              {errors.identifier && <span className="form-error">{errors.identifier}</span>}
            </div>

            <div className="form-group">
              <label className="form-label required" htmlFor="password">
                Password
              </label>
              <div className="password-input-wrapper">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className={`form-control ${errors.password ? 'is-invalid' : ''}`}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                  }}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? '👁️' : '🔒'}
                </button>
              </div>
              {errors.password && <span className="form-error">{errors.password}</span>}
            </div>

            <div className="auth-options">
              <label className="form-checkbox-label">
                <input
                  type="checkbox"
                  className="form-checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isSubmitting}
                />
                Remember me
              </label>
              <Link to="/forgot-password" className="auth-options-link">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Signing in...' : 'Sign In to Portal'}
            </button>
          </form>

          {isDemoMode() && (
            <div className="demo-credentials-box">
              <div className="demo-credentials-title">
                <span>Demo mode</span>
                <span className="status-pill status-pending">
                  <span className="status-dot"></span>
                  Demo data
                </span>
              </div>
              <p className="demo-credentials-note">
                Requests are served by the in-browser demo adapter, not the Flask backend.
                Demo accounts (password <strong>Demo@123</strong>):
              </p>
              <ul className="demo-credentials-list">
                <li><strong>faculty@college.edu</strong> — Faculty</li>
                <li><strong>hod@college.edu</strong> — HOD</li>
                <li><strong>admin@college.edu</strong> — Administrator</li>
              </ul>
            </div>
          )}
        </div>

        <div className="auth-footer">
          Need an account? Contact your department office or{' '}
          <Link to="/register">request registration</Link>.
        </div>
      </div>

      <p className="auth-copyright">
        Authorized University Faculty Information Portal &bull; REST API Integrated
      </p>
    </div>
  );
};

export default Login;
