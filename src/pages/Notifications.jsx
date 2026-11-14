import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import { notificationApi } from '../api/notificationApi';

const formatTimestamp = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const typeIcon = (type) => {
  if (type === 'approval' || type === 'verification') return 'checkCircle';
  if (type === 'remarks') return 'alert';
  if (type === 'score') return 'chart';
  if (type === 'report') return 'file';
  return 'bell';
};

export const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await notificationApi.getNotifications();
      setNotifications(Array.isArray(data) ? data : data?.notifications || []);
    } catch (err) {
      setError(err.message || 'Notifications could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === 'unread') return notifications.filter((item) => !item.read);
    if (filter === 'read') return notifications.filter((item) => item.read);
    return notifications;
  }, [filter, notifications]);

  const unreadCount = notifications.filter((item) => !item.read).length;

  const markRead = async (notification) => {
    if (notification.read) return;
    setBusyId(notification.id);
    setNotifications((previous) =>
      previous.map((item) => (item.id === notification.id ? { ...item, read: true } : item))
    );
    try {
      await notificationApi.markAsRead(notification.id);
    } catch (err) {
      setNotifications((previous) =>
        previous.map((item) => (item.id === notification.id ? { ...item, read: false } : item))
      );
      setError(err.message || 'The notification could not be marked as read.');
    } finally {
      setBusyId(null);
    }
  };

  const markAll = async () => {
    setMarkingAll(true);
    const snapshot = notifications;
    setNotifications((previous) => previous.map((item) => ({ ...item, read: true })));
    try {
      await notificationApi.markAllAsRead();
    } catch (err) {
      setNotifications(snapshot);
      setError(err.message || 'Notifications could not be marked as read.');
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <Layout title="Notifications">
      <div className="page-header">
        <div className="page-header-title-group">
          <h1>Notifications</h1>
          <p className="page-header-subtitle">
            Updates about submissions, verification decisions, remarks and API score publication.
          </p>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={markAll}
            disabled={markingAll || unreadCount === 0}
          >
            <Icon name="check" size={15} /> {markingAll ? 'Marking...' : 'Mark all as read'}
          </button>
        </div>
      </div>

      <ErrorMessage message={error} onRetry={load} />

      <div className="table-filter-bar">
        <div className="filter-inputs-group">
          <div className="segmented-control" role="group" aria-label="Filter notifications">
            {[
              { id: 'all', label: `All (${notifications.length})` },
              { id: 'unread', label: `Unread (${unreadCount})` },
              { id: 'read', label: 'Read' },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                className={`segmented-control-btn ${filter === option.id ? 'active' : ''}`}
                onClick={() => setFilter(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <Loading message="Loading notifications..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="bell"
          title={filter === 'unread' ? 'You are all caught up' : 'No notifications yet'}
          description="Activity and verification updates will appear here."
        />
      ) : (
        <ul className="notification-list">
          {filtered.map((notification) => (
            <li
              key={notification.id}
              className={`notification-card ${notification.read ? '' : 'unread'}`}
            >
              <div className="notification-card-icon">
                <Icon name={typeIcon(notification.type)} size={18} />
              </div>
              <div className="notification-card-body">
                <div className="notification-card-head">
                  <h3>{notification.title}</h3>
                  <time>{formatTimestamp(notification.timestamp)}</time>
                </div>
                <p>{notification.message}</p>
                {!notification.read && (
                  <button
                    type="button"
                    className="table-btn"
                    onClick={() => markRead(notification)}
                    disabled={busyId === notification.id}
                  >
                    <Icon name="check" size={13} />{' '}
                    {busyId === notification.id ? 'Updating...' : 'Mark as read'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Layout>
  );
};

export default Notifications;
