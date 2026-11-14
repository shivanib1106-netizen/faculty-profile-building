import React from 'react';

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="academic-footer">
      <div className="academic-footer-content">
        <p className="academic-footer-text">
          &copy; {currentYear} Faculty Profile Builder with Automated API Calculation System. All rights reserved.
        </p>
        <div className="academic-footer-links">
          <span>AICTE &amp; UGC PBAS Compliant</span>
          <span>&bull;</span>
          <span>Version 2.4.0</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
