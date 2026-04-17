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

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries();
    // Small delay so the spinner is visible
    await new Promise(r => setTimeout(r, 400));
  }, [queryClient]);

  return (
    <div className="min-h-screen pt-14 pb-20 relative overflow-hidden">
      {/* Decorative Background Elements - Concentric Rings */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Large ring - top right */}
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full border-2 border-primary/10 opacity-50" />
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full border border-accent/10 opacity-40" />
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full border border-primary/5 opacity-30" />
        
        {/* Medium ring - bottom left */}
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full border-2 border-accent/10 opacity-40" />
        <div className="absolute -bottom-12 -left-12 w-56 h-56 rounded-full border border-primary/10 opacity-30" />
        <div className="absolute -bottom-4 -left-4 w-40 h-40 rounded-full border border-accent/5 opacity-20" />
        
        {/* Floating accent orbs */}
        <div className="absolute top-1/4 left-8 w-2 h-2 rounded-full bg-accent/30 animate-pulse" />
        <div className="absolute top-1/3 right-12 w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse" style={{ animationDelay: '0.5s' }} />
        <div className="absolute bottom-1/3 left-16 w-1 h-1 rounded-full bg-accent/25 animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-2/3 right-8 w-2 h-2 rounded-full bg-primary/30 animate-pulse" style={{ animationDelay: '1.5s' }} />
        
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] via-transparent to-accent/[0.02]" />
      </div>
      
      {!hideNav && <AppHeader />}
      <main className="safe-area-top relative z-10">
        <PullToRefresh onRefresh={handleRefresh}>
          {children}
        </PullToRefresh>
        <LegalFooter />
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}