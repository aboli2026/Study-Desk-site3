import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
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
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in StudyDesk:', error, errorInfo);
  }

  private handleReset = () => {
    try {
      localStorage.clear();
      window.location.reload();
    } catch {}
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#09090b',
          color: '#f4f4f5',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'system-ui, sans-serif',
          direction: 'rtl'
        }}>
          <div style={{
            maxWidth: '480px',
            backgroundColor: '#18181b',
            border: '1px solid #27272a',
            borderRadius: '16px',
            padding: '28px',
            textAlign: 'center'
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '12px' }}>
              خطا در بارگذاری برنامه
            </h2>
            <p style={{ color: '#a1a1aa', fontSize: '14px', marginBottom: '20px', lineHeight: '1.6' }}>
              {this.state.error?.message || 'مشکلی در بارگذاری داده‌ها رخ داده است.'}
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '10px 18px',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                تلاش مجدد
              </button>
              <button
                onClick={this.handleReset}
                style={{
                  padding: '10px 18px',
                  backgroundColor: '#27272a',
                  color: '#e4e4e7',
                  borderRadius: '8px',
                  border: '1px solid #3f3f46',
                  cursor: 'pointer'
                }}
              >
                پاکسازی حافظه محلی
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

// Register offline Service Worker via Vite PWA for full offline & background update
if ('serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({
      immediate: true,
      onRegisteredSW(_swUrl, r) {
        console.log('Study Desk Service Worker registered:', r);
      },
      onRegisterError(error) {
        console.warn('Study Desk Service Worker registration failed:', error);
      },
    });
  }).catch(() => {
    // In dev mode or environments without virtual module
  });
}
