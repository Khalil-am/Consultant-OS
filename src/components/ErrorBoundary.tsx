import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** Short label for the section (e.g. "Dashboard") shown in the error UI */
  section?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const { section = 'This section', error } = { section: this.props.section, error: this.state.error };
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '200px', padding: '2rem', gap: '1rem',
          background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)',
          borderRadius: '12px', margin: '1rem',
        }}>
          <div style={{ fontSize: '1.5rem' }}>⚠️</div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#F1F5F9' }}>
            {section} failed to load
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', textAlign: 'center', maxWidth: '400px' }}>
            {error?.message ?? 'An unexpected error occurred. Try refreshing the page.'}
          </div>
          <button
            onClick={this.handleReset}
            style={{
              padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: 'rgba(239,68,68,0.15)', color: '#F87171',
              fontSize: '0.8rem', fontWeight: 600,
            }}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
