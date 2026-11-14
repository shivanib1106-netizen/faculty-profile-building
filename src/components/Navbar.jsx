import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { notificationApi } from '../api/notificationApi';
import { systemApi } from '../api/systemApi';
import Icon from './Icon';

const formatNotificationTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const Navbar = ({ onToggleSidebar, pageTitle = 'Dashboard' }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [activeYear, setActiveYear] = useState('');
  const [notificationError, setNotificationError] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    let active = true;
    notificationApi
      .getNotifications()
      .then((data) => {
        if (active) setNotifications(Array.isArray(data) ? data : data?.notifications || []);
      })
      .catch(() => {
        if (active) setNotificationError('Notifications unavailable.');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    systemApi
      .getAcademicYears()
      .then((years) => {
        if (!active) return;
        const current = (years || []).find((year) => year.status === 'Active');
        setActiveYear(current?.year || '');
      })
      .catch(() => {
        if (active) setActiveYear('');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setShowNotifications(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const unreadCount = notifications.filter((item) => !item.read).length;
  const notificationsPath = `/${user?.role || 'faculty'}/notifications`;

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      setNotifications((previous) =>
        previous.map((item) => (item.id === notification.id ? { ...item, read: true } : item))
      );
      try {
        await notificationApi.markAsRead(notification.id);
      } catch {
        setNotifications((previous) =>
          previous.map((item) => (item.id === notification.id ? { ...item, read: false } : item))
        );
      }
    }
  };

  const handleMarkAll = async () => {
    const snapshot = notifications;
    setNotifications((previous) => previous.map((item) => ({ ...item, read: true })));
    try {
      await notificationApi.markAllAsRead();
    } catch {
      setNotifications(snapshot);
    }
  };

  const profilePath =
    user?.role === 'admin'
      ? '/admin/settings'
      : user?.role === 'hod'
      ? '/hod/faculty-members'
      : '/faculty/profile';

  return (
    <header className="app-navbar">
      <div className="navbar-left">
        <button
          type="button"
          className="mobile-menu-toggle"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
        >
          <Icon name="menu" size={20} />
        </button>
        <h2 className="navbar-page-title">{pageTitle}</h2>
      </div>

      <div className="navbar-right">
        {activeYear && (
          <div className="navbar-academic-year" title="Active academic year">
            <span className="navbar-academic-year-dot"></span>
            <span>AY {activeYear}</span>
          </div>
        )}

        <div className="navbar-notifications-wrapper" ref={dropdownRef}>
          <button
            type="button"
            className="navbar-icon-btn"
            onClick={() => setShowNotifications((previous) => !previous)}
            aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
            aria-expanded={showNotifications}
          >
            <Icon name="bell" size={19} />
            {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
          </button>

          {showNotifications && (
            <div className="notifications-dropdown">
              <div className="notifications-header">
                <h4 className="notifications-title">Notifications</h4>
                {unreadCount > 0 && (
                  <button type="button" className="notifications-mark-all" onClick={handleMarkAll}>
                    Mark all read
                  </button>
                )}
              </div>
              <ul className="notifications-list">
                {notifications.length === 0 ? (
                  <li className="notification-item">
                    <p className="notification-item-desc">
                      {notificationError || 'No notifications yet.'}
                    </p>
                  </li>
                ) : (
                  notifications.slice(0, 5).map((notification) => (
                    <li
                      key={notification.id}
                      className={`notification-item ${notification.read ? '' : 'unread'}`}
                      onClick={() => handleNotificationClick(notification)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handleNotificationClick(notification);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`${notification.title}${notification.read ? '' : ' (unread)'}`}
                    >
                      <div className="notification-item-title">{notification.title}</div>
                      <div className="notification-item-desc">{notification.message}</div>
                      <div className="notification-item-time">
                        {formatNotificationTime(notification.timestamp)}
                      </div>
                    </li>
                  ))
                )}
              </ul>
              <div className="notifications-footer">
                <Link
                  to={notificationsPath}
                  className="notifications-view-all"
                  onClick={() => setShowNotifications(false)}
                >
                  View all notifications <Icon name="arrowRight" size={13} />
                </Link>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          className="navbar-user-section"
          onClick={() => navigate(profilePath)}
          title="Open my profile"
        >
          <div className="navbar-user-avatar">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="navbar-user-meta">
            <span className="navbar-user-name">{user?.name || 'Academic User'}</span>
            <span className="navbar-user-role">
              {user?.role === 'hod'
                ? 'Head of Department'
                : user?.role === 'admin'
                ? 'System Administrator'
                : user?.designation || 'Faculty'}
            </span>
          </div>
        </button>
      </div>
    </header>
  );
};

export default Navbar;
