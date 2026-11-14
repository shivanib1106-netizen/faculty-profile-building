import React from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import Layout from '../components/Layout';
import Icon from '../components/Icon';

export const NotFound = () => {
  const { user } = useAuth();
  const home = user
    ? user.role === 'admin'
      ? '/admin/dashboard'
      : user.role === 'hod'
      ? '/hod/dashboard'
      : '/faculty/dashboard'
    : '/login';

  const content = (
    <div className="state-page">
      <div className="state-page-icon">
        <Icon name="search" size={34} />
      </div>
      <span className="state-page-code">404</span>
      <h1>Page not found</h1>
      <p>The page you are looking for has moved or never existed.</p>
      <Link to={home} className="btn btn-primary">
        Go to {user ? 'dashboard' : 'sign in'}
      </Link>
    </div>
  );

  if (user) return <Layout title="Page not found">{content}</Layout>;
  return <div className="standalone-state">{content}</div>;
};

export default NotFound;
