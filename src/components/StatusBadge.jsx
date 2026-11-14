import React from 'react';

export const StatusBadge = ({ status }) => {
  if (!status) return null;

  const normalized = status.toLowerCase();
  let statusClass = 'status-draft';

  if (normalized.includes('approv')) {
    statusClass = 'status-approved';
  } else if (normalized.includes('pend') || normalized.includes('review')) {
    statusClass = 'status-pending';
  } else if (normalized.includes('reject')) {
    statusClass = 'status-rejected';
  } else if (normalized.includes('submit')) {
    statusClass = 'status-submitted';
  }

  return (
    <span className={`status-pill ${statusClass}`}>
      <span className="status-dot"></span>
      {status}
    </span>
  );
};

export default StatusBadge;
