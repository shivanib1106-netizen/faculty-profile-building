import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/authApi';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setError('Please provide a valid registered email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authApi.forgotPassword(email.trim());
      setMessage(
        res.message || 'Password reset link has been dispatched to your institutional email.'
      );
    } catch (err) {
      setError(err.message || 'Unable to process reset request. Please contact system admin.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo-badge">FP</div>
          <h1 className="auth-title">Password Recovery</h1>
          <p className="auth-subtitle">Enter your institutional email to receive reset instructions</p>
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
              <label className="form-label required" htmlFor="email">
                Institutional Email Address
              </label>
              <input
                id="email"
                type="email"
                className={`form-control ${error ? 'is-invalid' : ''}`}
                placeholder="ramesh.sharma@college.edu"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                disabled={isSubmitting}
                autoFocus
              />
            </div>

            <button type="submit" className="auth-submit-btn" disabled={isSubmitting}>
              {isSubmitting ? 'Sending Request...' : 'Send Recovery Instructions'}
            </button>
          </form>
        </div>

        <div className="auth-footer">
          Remembered your password? <Link to="/login">Back to Sign In</Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
