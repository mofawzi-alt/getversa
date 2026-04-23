import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Top-level error boundary so a render-time crash in any route shows a
 * friendly fallback instead of Apple's "blank white screen of death"
 * (a common App Store rejection trigger).
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // Keep this lightweight — no remote logging required for App Store review.
    console.error('App crashed:', error, info);
  }

  handleReload = () => {
    try {
      window.location.href = '/';
    } catch {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-6 text-center safe-area-top safe-area-bottom">
        <div className="max-w-sm space-y-4">
          <h1 className="text-2xl font-display font-bold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            Versa hit an unexpected error. Tap reload to start fresh — your account and votes are safe.
          </p>
          <button
            onClick={this.handleReload}
            className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-primary text-primary-foreground font-medium shadow-card hover:opacity-90 transition"
          >
            Reload Versa
          </button>
        </div>
      </div>
    );
  }
}
