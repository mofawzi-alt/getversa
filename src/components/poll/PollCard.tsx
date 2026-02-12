import { useState, useRef, TouchEvent, MouseEvent, useCallback, useEffect } from 'react';
import { Clock, Radio, Loader2 } from 'lucide-react';
import { playSwipeSound, playResultSound } from '@/lib/sounds';

interface Poll {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  category: string | null;
  image_a_url: string | null;
  image_b_url: string | null;
  is_sponsored?: boolean;
  sponsor_name?: string;
  sponsor_logo_url?: string;
  ends_at?: string | null;
  is_daily_poll?: boolean;
  created_by?: string | null;
  creator_username?: string | null;
}

interface VoteResult {
  choice: 'A' | 'B';
  percentA: number;
  percentB: number;
  totalVotes: number;
}

interface PollCardProps {
  poll: Poll;
  onSwipe: (direction: 'left' | 'right') => void;
  isAnimating: 'left' | 'right' | null;
  result?: VoteResult | null;
  onResultDone?: () => void;
}

const SWIPE_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 0.4;
const MAX_ROTATION = 12;
const RESULT_DISPLAY_MS = 1200;

export default function PollCard({ poll, onSwipe, isAnimating, result, onResultDone }: PollCardProps) {
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [imageALoaded, setImageALoaded] = useState(false);
  const [imageBLoaded, setImageBLoaded] = useState(false);
  const [currentPollId, setCurrentPollId] = useState(poll.id);
  const startX = useRef(0);
  const startTime = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  if (poll.id !== currentPollId) {
    setCurrentPollId(poll.id);
    setImageALoaded(false);
    setImageBLoaded(false);
  }

  // Play result sound and auto-advance after 1.2s
  useEffect(() => {
    if (!result || !onResultDone) return;
    playResultSound();
    const timer = setTimeout(onResultDone, RESULT_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [result, onResultDone]);

  const hasResult = !!result;

  const handleStart = useCallback((clientX: number) => {
    if (hasResult) return;
    setIsDragging(true);
    startX.current = clientX;
    startTime.current = Date.now();
  }, [hasResult]);

  const handleMove = useCallback((clientX: number) => {
    if (!isDragging || hasResult) return;
    setDragOffset(clientX - startX.current);
  }, [isDragging, hasResult]);

  const handleEnd = useCallback(() => {
    if (!isDragging || hasResult) return;
    setIsDragging(false);

    const elapsed = Date.now() - startTime.current;
    const velocity = Math.abs(dragOffset) / Math.max(elapsed, 1);
    const isFastFlick = velocity > VELOCITY_THRESHOLD && Math.abs(dragOffset) > 40;

    if (dragOffset > SWIPE_THRESHOLD || (isFastFlick && dragOffset > 0)) {
      playSwipeSound();
      onSwipe('right');
    } else if (dragOffset < -SWIPE_THRESHOLD || (isFastFlick && dragOffset < 0)) {
      playSwipeSound();
      onSwipe('left');
    }
    setDragOffset(0);
  }, [isDragging, hasResult, dragOffset, onSwipe]);

  const handleTouchStart = (e: TouchEvent) => handleStart(e.touches[0].clientX);
  const handleTouchMove = (e: TouchEvent) => {
    handleMove(e.touches[0].clientX);
    if (Math.abs(dragOffset) > 10) e.preventDefault();
  };
  const handleMouseDown = (e: MouseEvent) => { e.preventDefault(); handleStart(e.clientX); };
  const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX);

  const normalizedOffset = Math.min(Math.abs(dragOffset), 200) / 200;
  const rotation = Math.sign(dragOffset) * normalizedOffset * MAX_ROTATION;
  const opacity = 1 - normalizedOffset * 0.3;
  const highlightIntensity = Math.min(Math.abs(dragOffset) / SWIPE_THRESHOLD, 1);

  const getAnimationClass = () => {
    if (isAnimating === 'left') return 'animate-swipe-left';
    if (isAnimating === 'right') return 'animate-swipe-right';
    return '';
  };

  const isExpired = poll.ends_at ? new Date(poll.ends_at) < new Date() : false;
  const isLive = !isExpired && poll.is_daily_poll;

  // Result calculations
  const userPercent = result ? (result.choice === 'A' ? result.percentA : result.percentB) : 0;
  const isWinnerA = result ? result.percentA >= result.percentB : true;
  const userPickedWinner = result ? (result.choice === 'A' && isWinnerA) || (result.choice === 'B' && !isWinnerA) : false;

  return (
    <div
      ref={cardRef}
      className={`w-full max-w-md mx-auto select-none ${hasResult ? '' : 'cursor-grab active:cursor-grabbing'} ${getAnimationClass()}`}
      style={{
        transform: isAnimating ? undefined : hasResult ? 'none' : `translateX(${dragOffset}px) rotate(${rotation}deg)`,
        opacity: isAnimating ? undefined : hasResult ? 1 : opacity,
        transition: isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.35s ease-out',
        willChange: isDragging ? 'transform' : 'auto',
      }}
      onTouchStart={hasResult ? undefined : handleTouchStart}
      onTouchMove={hasResult ? undefined : handleTouchMove}
      onTouchEnd={hasResult ? undefined : handleEnd}
      onMouseDown={hasResult ? undefined : handleMouseDown}
      onMouseMove={hasResult ? undefined : handleMouseMove}
      onMouseUp={hasResult ? undefined : handleEnd}
      onMouseLeave={hasResult ? undefined : () => isDragging && handleEnd()}
    >
      <div className="bg-poll-card rounded-2xl p-3 shadow-card overflow-hidden">
        {/* Question */}
        <div className="mb-2">
          <p className="text-base font-bold text-poll-card-foreground leading-snug text-center">{poll.question}</p>
        </div>

        {/* Image Options */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          {/* Option A */}
          <div
            className="relative rounded-2xl overflow-hidden transition-all duration-150"
            style={{
              transform: !hasResult && dragOffset < -30 ? `scale(${1 + highlightIntensity * 0.05})` : 'scale(1)',
              boxShadow: !hasResult && dragOffset < -30
                ? `0 0 ${highlightIntensity * 20}px hsl(var(--accent) / ${highlightIntensity * 0.4})`
                : hasResult && result?.choice === 'A'
                  ? '0 0 15px hsl(var(--accent) / 0.4)'
                  : 'none',
            }}
          >
            <div className="aspect-[4/5] bg-background/10 rounded-2xl overflow-hidden relative">
              {poll.image_a_url ? (
                <>
                  {!imageALoaded && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/20">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  <img
                    key={`${poll.id}-a`}
                    src={poll.image_a_url}
                    alt={poll.option_a}
                    className={`w-full h-full object-cover transition-opacity duration-300 ${imageALoaded ? 'opacity-100' : 'opacity-0'}`}
                    draggable={false}
                    onLoad={() => setImageALoaded(true)}
                    loading="eager"
                  />
                </>
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-option-a to-option-a/80 flex items-center justify-center p-4">
                  <span className="text-option-a-foreground text-center font-bold text-base leading-tight">{poll.option_a}</span>
                </div>
              )}

              {/* Result overlay on image */}
              {hasResult && (
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center animate-fade-in">
                  <span className="text-3xl font-bold text-white">{result!.percentA}%</span>
                  {result?.choice === 'A' && (
                    <span className="text-xs font-semibold text-accent mt-1">Your vote</span>
                  )}
                </div>
              )}
            </div>

            {/* Selection indicator during drag */}
            {!hasResult && dragOffset < -30 && (
              <div
                className="absolute inset-0 rounded-2xl border-4 border-accent pointer-events-none"
                style={{ opacity: highlightIntensity }}
              />
            )}
            {/* Highlight chosen option after vote */}
            {hasResult && result?.choice === 'A' && (
              <div className="absolute inset-0 rounded-2xl border-3 border-accent pointer-events-none" />
            )}

            {poll.image_a_url && !hasResult && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 pt-8">
                <p className="text-white text-sm font-bold truncate drop-shadow-lg">{poll.option_a}</p>
              </div>
            )}
          </div>

          {/* Option B */}
          <div
            className="relative rounded-2xl overflow-hidden transition-all duration-150"
            style={{
              transform: !hasResult && dragOffset > 30 ? `scale(${1 + highlightIntensity * 0.05})` : 'scale(1)',
              boxShadow: !hasResult && dragOffset > 30
                ? `0 0 ${highlightIntensity * 20}px hsl(var(--warning) / ${highlightIntensity * 0.4})`
                : hasResult && result?.choice === 'B'
                  ? '0 0 15px hsl(var(--warning) / 0.4)'
                  : 'none',
            }}
          >
            <div className="aspect-[4/5] bg-background/10 rounded-2xl overflow-hidden relative">
              {poll.image_b_url ? (
                <>
                  {!imageBLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/20">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  <img
                    key={`${poll.id}-b`}
                    src={poll.image_b_url}
                    alt={poll.option_b}
                    className={`w-full h-full object-cover transition-opacity duration-300 ${imageBLoaded ? 'opacity-100' : 'opacity-0'}`}
                    draggable={false}
                    onLoad={() => setImageBLoaded(true)}
                    loading="eager"
                  />
                </>
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-option-b to-option-b/80 flex items-center justify-center p-4">
                  <span className="text-option-b-foreground text-center font-bold text-base leading-tight">{poll.option_b}</span>
                </div>
              )}

              {/* Result overlay on image */}
              {hasResult && (
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center animate-fade-in">
                  <span className="text-3xl font-bold text-white">{result!.percentB}%</span>
                  {result?.choice === 'B' && (
                    <span className="text-xs font-semibold text-warning mt-1">Your vote</span>
                  )}
                </div>
              )}
            </div>

            {!hasResult && dragOffset > 30 && (
              <div
                className="absolute inset-0 rounded-2xl border-4 border-warning pointer-events-none"
                style={{ opacity: highlightIntensity }}
              />
            )}
            {hasResult && result?.choice === 'B' && (
              <div className="absolute inset-0 rounded-2xl border-3 border-warning pointer-events-none" />
            )}

            {poll.image_b_url && !hasResult && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 pt-8">
                <p className="text-white text-sm font-bold truncate drop-shadow-lg">{poll.option_b}</p>
              </div>
            )}
          </div>
        </div>

        {/* Swipe hints - only before voting */}
        {!hasResult && !isExpired && (
          <div className="flex justify-center gap-6 text-xs text-poll-card-foreground/50">
            <span>← {poll.option_a.length > 12 ? poll.option_a.slice(0, 12) + '…' : poll.option_a}</span>
            <span>{poll.option_b.length > 12 ? poll.option_b.slice(0, 12) + '…' : poll.option_b} →</span>
          </div>
        )}

        {/* Inline result footer */}
        {hasResult && (
          <div className="animate-fade-in space-y-2 mt-1">
            {/* Animated percentage bar */}
            <div className="h-2 bg-muted rounded-full overflow-hidden flex">
              <div
                className="h-full bg-option-a rounded-l-full"
                style={{ width: `${result!.percentA}%`, transition: 'width 0.7s ease-out' }}
              />
              <div
                className="h-full bg-option-b rounded-r-full"
                style={{ width: `${result!.percentB}%`, transition: 'width 0.7s ease-out' }}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{result!.totalVotes.toLocaleString()} perspectives</span>
              <span className={`font-semibold px-2 py-0.5 rounded-full text-[10px] ${
                userPickedWinner ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                {userPickedWinner ? 'Majority' : 'Minority'}
              </span>
            </div>
            <p className="text-xs text-center text-poll-card-foreground/60 italic">
              That says something about you.
            </p>
            {/* Progress bar for auto-advance */}
            <div className="h-0.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ animation: `progress-fill ${RESULT_DISPLAY_MS}ms linear forwards` }}
              />
            </div>
          </div>
        )}

        {/* Live badge only - category hidden from user view */}
        {isLive && !hasResult && (
          <div className="flex items-center justify-center gap-2 mt-2">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/20 text-destructive">
              <Radio className="h-2.5 w-2.5" />
              <span className="text-[10px] font-bold uppercase">Live</span>
            </div>
          </div>
        )}

        {isExpired && !hasResult && (
          <div className="flex items-center justify-center gap-2 py-2 mt-2 rounded-xl bg-muted/50 text-poll-card-foreground/60">
            <Clock className="h-3 w-3" />
            <span className="text-xs font-medium">Expired</span>
          </div>
        )}
      </div>
    </div>
  );
}
