import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import Footer from './Footer';
import { isDemoMode } from '../api/apiClient';

export const Layout = ({ children, title = 'Faculty Management System' }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen((previous) => !previous);
  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="app-layout">
      <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />
      <div className="main-content-wrapper">
        <Navbar onToggleSidebar={toggleSidebar} pageTitle={title} />
        {isDemoMode() && (
          <div className="demo-strip" role="status">
            <strong>Demo data</strong>
            <span>
              Requests are served by the in-browser demo adapter. Values are not official API scores.
            </span>
          </div>
        )}
        <main className="page-content-area">{children}</main>
        <Footer />
      </div>
    </div>
  );
};

export default Layout;
