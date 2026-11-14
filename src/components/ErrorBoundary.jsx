import React from 'react';

/**
 * Catches render-time errors so a single component failure never leaves a blank page.
 * API errors are handled inside the pages; this is the last line of defence.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    // Keep the details in the console for developers; users see a plain message.
    console.error('Unexpected interface error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="standalone-state">
          <div className="state-page">
            <span className="state-page-code">Oops</span>
            <h1>Something went wrong</h1>
            <p>The page could not be displayed. Reload to try again.</p>
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
