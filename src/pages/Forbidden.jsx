import React from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import Layout from '../components/Layout';
import Icon from '../components/Icon';

const dashboardFor = (role) => {
  if (role === 'admin') return '/admin/dashboard';
  if (role === 'hod') return '/hod/dashboard';
  return '/faculty/dashboard';
};

export const Forbidden = () => {
  const { user } = useAuth();
  const content = (
    <div className="state-page">
      <div className="state-page-icon">
        <Icon name="shield" size={34} />
      </div>
      <span className="state-page-code">403</span>
      <h1>You do not have access to this page</h1>
      <p>
        Your account role does not permit this section. If you believe this is an error, contact
        your department administrator.
      </p>
      <Link to={dashboardFor(user?.role)} className="btn btn-primary">
        Return to my dashboard
      </Link>
    </div>
  );

  if (user) return <Layout title="Access denied">{content}</Layout>;
  return <div className="standalone-state">{content}</div>;
};

export default Forbidden;
