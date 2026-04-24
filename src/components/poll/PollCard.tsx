import { useState, useRef, TouchEvent, MouseEvent, useCallback, useEffect } from 'react';
import { Clock, Loader2 } from 'lucide-react';
import { playSwipeSound, playResultSound } from '@/lib/sounds';
import LiveIndicator from '@/components/poll/LiveIndicator';
import PollOptionImage from '@/components/poll/PollOptionImage';
import BrandDisclaimer from '@/components/poll/BrandDisclaimer';
import CategoryBadge from '@/components/category/CategoryBadge';
import { mapToVersaCategory } from '@/lib/categoryMeta';

interface Poll {
  id: string;
  question: string;
  subtitle?: string | null;
  option_a: string;
  option_b: string;
  category: string | null;
  image_a_url: string | null;
  image_b_url: string | null;
  is_sponsored?: boolean;
  sponsor_name?: string;
  sponsor_logo_url?: string;
  ends_at?: string | null;
  starts_at?: string | null;
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
  const hasStarted = poll.starts_at ? new Date(poll.starts_at) <= new Date() : true;
  const isLive = !isExpired && hasStarted;

  const userPercent = result ? (result.choice === 'A' ? result.percentA : result.percentB) : 0;
  const isWinnerA = result ? result.percentA >= result.percentB : true;
  const userPickedWinner = result ? (result.choice === 'A' && isWinnerA) || (result.choice === 'B' && !isWinnerA) : false;

  return (
    <div
      ref={cardRef}
      className={`w-full h-full select-none flex flex-col items-center justify-center ${hasResult ? '' : 'cursor-grab active:cursor-grabbing'} ${getAnimationClass()}`}
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
      {/* Card container — white rounded shell like reference */}
      <div className="w-full max-w-[440px] mx-auto bg-card rounded-3xl shadow-lg border border-border/60 overflow-hidden flex flex-col">
        {/* Images — slightly squared, labels overlaid in corners */}
        <div className="relative grid grid-cols-2 gap-0 w-full aspect-[4/3] overflow-hidden">
          {/* Option A */}
          <div
            className="relative overflow-hidden transition-transform duration-200"
            style={{
              transform: !hasResult && dragOffset < -30 ? `scale(${1 + highlightIntensity * 0.04})` : 'scale(1)',
            }}
          >
            <PollOptionImage
              imageUrl={poll.image_a_url}
              option={poll.option_a}
              question={poll.question}
              side="A"
              maxLogoSize="70%"
              showLoader={true}
            />
            {/* Label overlay bottom-left */}
            <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/70 via-black/30 to-transparent pointer-events-none">
              <p className="text-white text-sm font-bold leading-tight drop-shadow-md line-clamp-2">{poll.option_a}</p>
            </div>
            {!hasResult && dragOffset < -30 && (
              <div className="absolute inset-0 border-2 border-option-a/60 pointer-events-none" style={{ opacity: highlightIntensity }} />
            )}
            {hasResult && result?.choice === 'A' && (
              <div className="absolute inset-0 border-2 border-option-a pointer-events-none" />
            )}
          </div>

          {/* Option B */}
          <div
            className="relative overflow-hidden transition-transform duration-200"
            style={{
              transform: !hasResult && dragOffset > 30 ? `scale(${1 + highlightIntensity * 0.04})` : 'scale(1)',
            }}
          >
            <PollOptionImage
              imageUrl={poll.image_b_url}
              option={poll.option_b}
              question={poll.question}
              side="B"
              maxLogoSize="70%"
              showLoader={true}
            />
            <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/70 via-black/30 to-transparent pointer-events-none">
              <p className="text-white text-sm font-bold leading-tight drop-shadow-md line-clamp-2 text-right">{poll.option_b}</p>
            </div>
            {!hasResult && dragOffset > 30 && (
              <div className="absolute inset-0 border-2 border-option-b/60 pointer-events-none" style={{ opacity: highlightIntensity }} />
            )}
            {hasResult && result?.choice === 'B' && (
              <div className="absolute inset-0 border-2 border-option-b pointer-events-none" />
            )}
          </div>
        </div>

        {/* Big percentages row — only after vote */}
        {hasResult && (
          <div className="grid grid-cols-2 px-4 pt-4 pb-2 animate-fade-in">
            <div className="text-center">
              <span className="text-4xl font-extrabold text-option-a tracking-tight">{result!.percentA}<span className="text-2xl">%</span></span>
            </div>
            <div className="text-center">
              <span className="text-4xl font-extrabold text-option-b tracking-tight">{result!.percentB}<span className="text-2xl">%</span></span>
            </div>
          </div>
        )}

        {/* Body — question + meta */}
        <div className="px-4 pt-3 pb-3">
          <p className="text-[17px] font-bold text-foreground leading-snug">{poll.question}</p>
          {poll.subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{poll.subtitle}</p>
          )}

          <div className="flex items-center gap-2 mt-2.5">
            {hasResult && (
              <span className="text-xs text-muted-foreground">{result!.totalVotes.toLocaleString()} votes</span>
            )}
            {poll.category && (
              <CategoryBadge
                category={mapToVersaCategory(poll.category)}
                variant="pill"
                size="sm"
              />
            )}
            {isLive && !hasResult && <LiveIndicator variant="badge" />}
            {isExpired && !hasResult && (
              <span className="inline-flex items-center gap-1 text-xs text-foreground/50">
                <Clock className="h-3 w-3" /> Expired
              </span>
            )}
          </div>

          {/* Result bars — match reference */}
          {hasResult && (
            <div className="mt-3 space-y-2 animate-fade-in">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-foreground line-clamp-1">{poll.option_a}</span>
                  <span className="text-sm font-bold text-foreground shrink-0 ml-2">{result!.percentA}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-option-a rounded-full" style={{ width: `${result!.percentA}%`, transition: 'width 0.7s ease-out' }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-foreground line-clamp-1">{poll.option_b}</span>
                  <span className="text-sm font-bold text-foreground shrink-0 ml-2">{result!.percentB}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-option-b rounded-full" style={{ width: `${result!.percentB}%`, transition: 'width 0.7s ease-out' }} />
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className={`font-semibold px-2 py-0.5 rounded-full text-[10px] ${userPickedWinner ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {userPickedWinner ? 'Majority' : 'Minority'}
                </span>
                <div className="flex-1 mx-2 h-0.5 bg-border rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ animation: `progress-fill ${RESULT_DISPLAY_MS}ms linear forwards` }} />
                </div>
              </div>
            </div>
          )}

          {/* Swipe hint — minimal */}
          {!hasResult && !isExpired && (
            <div className="flex justify-center gap-8 text-[10px] uppercase tracking-wider text-muted-foreground/60 mt-2">
              <span>← Swipe</span>
              <span>Swipe →</span>
            </div>
          )}
        </div>
      </div>
      <BrandDisclaimer optionA={poll.option_a} optionB={poll.option_b} question={poll.question} />
    </div>
  );
}
