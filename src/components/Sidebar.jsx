import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import Icon from './Icon';

const FACULTY_LINKS = [
  { label: 'Dashboard', path: '/faculty/dashboard', icon: 'dashboard' },
  { label: 'My Profile', path: '/faculty/profile', icon: 'user' },
  { label: 'Educational Qualifications', path: '/faculty/qualifications', icon: 'graduation' },
  { label: 'Work Experience', path: '/faculty/experience', icon: 'briefcase' },
  { label: 'Academic Activities', path: '/faculty/activities', icon: 'list' },
  { label: 'Category I', path: '/faculty/category-1', icon: 'book' },
  { label: 'Category II', path: '/faculty/category-2', icon: 'users' },
  { label: 'Category III', path: '/faculty/category-3', icon: 'star' },
  { label: 'Upload Documents', path: '/faculty/documents', icon: 'upload' },
  { label: 'API Score', path: '/faculty/api-score', icon: 'chart' },
  { label: 'Reports', path: '/faculty/reports', icon: 'file' },
  { label: 'Notifications', path: '/faculty/notifications', icon: 'bell' },
  { label: 'Change Password', path: '/faculty/change-password', icon: 'lock' },
];

const HOD_LINKS = [
  { label: 'Dashboard', path: '/hod/dashboard', icon: 'dashboard' },
  { label: 'Faculty Members', path: '/hod/faculty-members', icon: 'users' },
  { label: 'Faculty Profiles', path: '/hod/faculty-profiles', icon: 'user' },
  { label: 'Activity Verification', path: '/hod/verification', icon: 'checkCircle' },
  { label: 'Pending Approvals', path: '/hod/pending-approvals', icon: 'clock' },
  { label: 'Approved Activities', path: '/hod/approved-activities', icon: 'check' },
  { label: 'Rejected Activities', path: '/hod/rejected-activities', icon: 'xCircle' },
  { label: 'Department Reports', path: '/hod/reports', icon: 'file' },
  { label: 'Notifications', path: '/hod/notifications', icon: 'bell' },
];

const ADMIN_LINKS = [
  { label: 'Dashboard', path: '/admin/dashboard', icon: 'dashboard' },
  { label: 'User Management', path: '/admin/users', icon: 'users' },
  { label: 'Faculty Management', path: '/admin/faculty', icon: 'graduation' },
  { label: 'Department Management', path: '/admin/departments', icon: 'building' },
  { label: 'Academic Year Management', path: '/admin/academic-years', icon: 'calendar' },
  { label: 'API Scoring Rules', path: '/admin/scoring-rules', icon: 'edit' },
  { label: 'Activity Categories', path: '/admin/categories', icon: 'list' },
  { label: 'Reports', path: '/admin/reports', icon: 'file' },
  { label: 'Audit Logs', path: '/admin/audit-logs', icon: 'history' },
  { label: 'Settings', path: '/admin/settings', icon: 'settings' },
  { label: 'Notifications', path: '/admin/notifications', icon: 'bell' },
];

const roleConfig = {
  faculty: { links: FACULTY_LINKS, label: 'Faculty Member', className: '' },
  hod: { links: HOD_LINKS, label: 'Head of Department', className: 'role-hod' },
  admin: { links: ADMIN_LINKS, label: 'Administrator', className: 'role-admin' },
};

export const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const role = user?.role || 'faculty';
  const config = roleConfig[role] || roleConfig.faculty;

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
      <div
        className={`sidebar-overlay ${isOpen ? 'overlay-visible' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={`app-sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">FP</div>
          <div className="sidebar-title-group">
            <span className="sidebar-app-name">Faculty Profile</span>
            <span className="sidebar-app-subtitle">API Calculation System</span>
          </div>
        </div>

        <div className="sidebar-role-indicator">
          <span className="sidebar-role-label">Signed in as</span>
          <span className={`sidebar-role-tag ${config.className}`}>{config.label}</span>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          <ul className="sidebar-menu">
            {config.links.map((link) => (
              <li key={link.path} className="sidebar-menu-item">
                <NavLink
                  to={link.path}
                  onClick={onClose}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                  <span className="sidebar-link-icon">
                    <Icon name={link.icon} size={17} />
                  </span>
                  <span>{link.label}</span>
                </NavLink>
              </li>
            ))}
            <li className="sidebar-menu-item">
              <button type="button" className="sidebar-link sidebar-link-button" onClick={handleLogout}>
                <span className="sidebar-link-icon">
                  <Icon name="logout" size={17} />
                </span>
                <span>Logout</span>
              </button>
            </li>
          </ul>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user-info">
            <div className="sidebar-user-avatar">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="sidebar-user-details">
              <span className="sidebar-user-name">{user?.name || 'Academic User'}</span>
              <span className="sidebar-user-role">{user?.employeeId || role.toUpperCase()}</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
