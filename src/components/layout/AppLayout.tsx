import { ReactNode, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import BottomNav from './BottomNav';
import AppHeader from './AppHeader';
import PullToRefresh from './PullToRefresh';
import LegalFooter from './LegalFooter';
import { useDuelAutoOpen } from '@/hooks/useDuelAutoOpen';

interface AppLayoutProps {
  children: ReactNode;
  hideNav?: boolean;
}

export default function AppLayout({ children, hideNav }: AppLayoutProps) {
  const queryClient = useQueryClient();
  useDuelAutoOpen();
  const safeTopInset = 'max(env(safe-area-inset-top), 1.75rem)';

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries();
    // Small delay so the spinner is visible
    await new Promise(r => setTimeout(r, 400));
  }, [queryClient]);

  return (
    <div className="min-h-screen pb-20 relative bg-background">
      {!hideNav && <AppHeader />}
      <main
        className="relative z-10"
        style={{ paddingTop: `calc(3.5rem + ${safeTopInset} + 0.5rem)` }}
      >
        <PullToRefresh onRefresh={handleRefresh}>
          {children}
        </PullToRefresh>
        <LegalFooter />
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}