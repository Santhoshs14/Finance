import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ background: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', maxWidth: '400px', textAlign: 'center' }}>
            <h2 style={{ color: '#ef4444', marginTop: 0 }}>Something went wrong.</h2>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '24px' }}>An unexpected error occurred in the application. We recommend refreshing the page.</p>
            <button 
              onClick={() => window.location.reload()} 
              style={{ background: '#10b981', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
