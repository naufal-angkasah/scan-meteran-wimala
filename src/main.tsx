import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 480, margin: '40px auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }}>
          <h2 style={{ color: '#b91c1c', fontSize: 18, fontWeight: 'bold', margin: '0 0 8px 0' }}>Terjadi Kesalahan pada Aplikasi</h2>
          <p style={{ color: '#475569', fontSize: 13, margin: '0 0 16px 0' }}>
            {this.state.error?.message || 'Gagal memuat komponen.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '8px 16px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', fontSize: 12, cursor: 'pointer' }}
          >
            Muat Ulang Halaman
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
