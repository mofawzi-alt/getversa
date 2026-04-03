import { useState, useRef, useCallback, ReactNode } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const PULL_THRESHOLD = 80;
const MAX_PULL = 120;

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh?: () => Promise<void>;
}

export default function PullToRefresh({ children, onRefresh }: PullToRefreshProps) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const controls = useAnimation();

  const canPull = () => {
    return window.scrollY <= 0;
  };

  const startXRef = useRef(0);
  const activatedRef = useRef(false);

  const isInteractive = (el: EventTarget | null): boolean => {
    if (!el || !(el instanceof HTMLElement)) return false;
    const tag = el.tagName;
    if (['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT', 'LABEL'].includes(tag)) return true;
    if (el.closest('button, a, [role="button"], input, textarea, select')) return true;
    return false;
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (refreshing) return;
    activatedRef.current = false;
    if (isInteractive(e.target)) return;
    if (canPull()) {
      startYRef.current = e.touches[0].clientY;
      startXRef.current = e.touches[0].clientX;
      pullingRef.current = true;
    }
  }, [refreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pullingRef.current || refreshing) return;
    const dy = e.touches[0].clientY - startYRef.current;
    const dx = Math.abs(e.touches[0].clientX - startXRef.current);
    // Only activate pull if clearly vertical and downward, not horizontal
    if (!activatedRef.current) {
      if (dy < 10 || dx > dy) {
        // Not a clear pull-down — abort
        pullingRef.current = false;
        return;
      }
      activatedRef.current = true;
    }
    if (dy > 0 && canPull()) {
      const dampened = Math.min(dy * 0.5, MAX_PULL);
      setPullY(dampened);
    } else {
      pullingRef.current = false;
      setPullY(0);
    }
  }, [refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!pullingRef.current) return;
    pullingRef.current = false;

    if (pullY >= PULL_THRESHOLD && onRefresh) {
      setRefreshing(true);
      setPullY(50);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullY(0);
      }
    } else {
      setPullY(0);
    }
  }, [pullY, onRefresh]);

  const progress = Math.min(pullY / PULL_THRESHOLD, 1);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-200"
        style={{ height: pullY > 0 || refreshing ? `${Math.max(pullY, refreshing ? 50 : 0)}px` : '0px' }}
      >
        {refreshing ? (
          <Loader2 className="h-5 w-5 text-primary animate-spin" />
        ) : (
          <motion.div
            style={{ opacity: progress, rotate: progress * 180 }}
            className="text-primary"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M19 12l-7 7-7-7" />
            </svg>
          </motion.div>
        )}
      </div>
      {children}
    </div>
  );
}
