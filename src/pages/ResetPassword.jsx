import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/authApi';

export const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!token) {
      setError('This password reset link is invalid or incomplete. Request a new link.');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authApi.resetPassword(token, newPassword);
      setMessage(res.message || 'Password updated successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err.message || 'Password reset token is invalid or has expired.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo-badge">FP</div>
          <h1 className="auth-title">Set New Password</h1>
          <p className="auth-subtitle">Create a secure new password for your account</p>
        </div>

        <div className="auth-body">
          {message && (
            <div className="alert-box alert-box-success" role="alert">
              {message}
            </div>
          )}

          {error && (
            <div className="alert-box alert-box-danger" role="alert">
              {error}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label required" htmlFor="newPassword">
                New Password
              </label>
              <input
                id="newPassword"
                type="password"
                className={`form-control ${error ? 'is-invalid' : ''}`}
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setError('');
                }}
                disabled={isSubmitting}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label required" htmlFor="confirmPassword">
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                className={`form-control ${error ? 'is-invalid' : ''}`}
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError('');
                }}
                disabled={isSubmitting}
              />
            </div>

            <button type="submit" className="auth-submit-btn" disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>

        <div className="auth-footer">
          <Link to="/login">Return to Sign In</Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
