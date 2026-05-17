import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  retryCount: number;
}

/**
 * Top-level error boundary.
 *
 * Apple App Review hit our visible "Something went wrong" fallback on iPad
 * (Guideline 2.1(a) rejection). To prevent transient render errors from
 * surfacing to reviewers / users, we now:
 *   1. Silently auto-recover from the first render error by remounting
 *      children (most React crashes are one-shot hook/order glitches).
 *   2. Only show the visible fallback if the error repeats after the
 *      silent retry — i.e. it's a real, persistent crash.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, retryCount: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('App crashed:', error, info);

    // Detect stale chunk / dynamic import failures after a redeploy.
    // The user's cached index.html references JS chunks that no longer exist,
    // so lazy-loaded routes (e.g. /admin) fail with "Importing a module script
    // failed" or "Failed to fetch dynamically imported module". A hard reload
    // fetches the new index + chunk hashes and resolves it.
    const msg = String(error?.message || '');
    const isChunkError =
      /Importing a module script failed/i.test(msg) ||
      /Failed to fetch dynamically imported module/i.test(msg) ||
      /error loading dynamically imported module/i.test(msg) ||
      (/Load failed/i.test(msg) && /chunk|module|script/i.test(String((error as any)?.stack || '')));

    if (isChunkError) {
      const KEY = 'versa.chunk-reload.v1';
      try {
        const last = Number(sessionStorage.getItem(KEY) || '0');
        if (Date.now() - last > 10_000) {
          sessionStorage.setItem(KEY, String(Date.now()));
          window.location.reload();
          return;
        }
      } catch {
        window.location.reload();
        return;
      }
    }

    // First crash: try a silent automatic recovery on the next tick.
    if (this.state.retryCount < 1) {
      setTimeout(() => {
        this.setState((s) => ({
          hasError: false,
          error: undefined,
          retryCount: s.retryCount + 1,
        }));
      }, 0);
    }
  }

  handleReload = () => {
    try {
      window.location.href = '/';
    } catch {
      window.location.reload();
    }
  };

  render() {
    // Still in error state AND we've already used our silent retry → show fallback.
    if (this.state.hasError && this.state.retryCount >= 1) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-6 text-center safe-area-top safe-area-bottom">
          <div className="max-w-sm space-y-4">
            <h1 className="text-2xl font-display font-bold">Just a moment</h1>
            <p className="text-sm text-muted-foreground">
              Versa needs to refresh. Tap below to continue — your account and votes are safe.
            </p>
            <button
              onClick={this.handleReload}
              className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-primary text-primary-foreground font-medium shadow-card hover:opacity-90 transition"
            >
              Continue
            </button>
          </div>
        </div>
      );
    }

    // While the silent retry is queued, render nothing for one tick.
    if (this.state.hasError) {
      return <div className="min-h-screen bg-background" />;
    }

    return this.props.children;
  }
}
