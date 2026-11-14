import React from 'react';

export const ErrorMessage = ({ message, onRetry }) => {
  if (!message) return null;

  return (
    <div className="alert-box alert-box-danger" role="alert">
      <span>&#9888;</span>
      <div className="flex-1">
        <p className="alert-message-text">{message}</p>
        {onRetry && (
          <button type="button" className="btn btn-sm btn-secondary" onClick={onRetry}>
            Try Again
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorMessage;
