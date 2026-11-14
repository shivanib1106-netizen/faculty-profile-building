import React from 'react';

export const Loading = ({ message = 'Loading data, please wait...', fullScreen = false }) => {
  if (fullScreen) {
    return (
      <div className="modal-backdrop">
        <div className="loading-fullscreen-card">
          <div className="spinner"></div>
          <p>{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="spinner-container">
      <div className="spinner"></div>
      <p>{message}</p>
    </div>
  );
};

export default Loading;
