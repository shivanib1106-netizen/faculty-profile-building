import React from 'react';
import Icon from './Icon';

export const EmptyState = ({
  icon = 'folder',
  title = 'Nothing here yet',
  description = 'There is no information to display at the moment.',
  action = null,
}) => (
  <div className="empty-state">
    <div className="empty-state-icon">
      <Icon name={icon} size={28} />
    </div>
    <h3 className="empty-state-title">{title}</h3>
    <p className="empty-state-description">{description}</p>
    {action && <div className="empty-state-action">{action}</div>}
  </div>
);

export default EmptyState;
