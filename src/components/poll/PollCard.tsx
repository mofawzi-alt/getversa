import { useState, useRef, TouchEvent, MouseEvent, useEffect } from 'react';
import { Clock, Radio, Loader2, Users, MapPin, Calendar } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

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

interface Demographics {
  gender: Record<string, { a: number; b: number }>;
  age: Record<string, { a: number; b: number }>;
  country: Record<string, { a: number; b: number }>;
}

interface PollCardProps {
  poll: Poll;
  onSwipe: (direction: 'left' | 'right') => void;
  isAnimating: 'left' | 'right' | null;
  liveVotes?: { a: number; b: number; demographics?: Demographics };
  hasVoted?: boolean;
  showDemographics?: boolean;
  showCreator?: boolean;
}

export default function PollCard({ poll, onSwipe, isAnimating, liveVotes, hasVoted, showDemographics = false, showCreator = true }: PollCardProps) {
  const { user } = useAuth();
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [imageALoaded, setImageALoaded] = useState(false);
  const [imageBLoaded, setImageBLoaded] = useState(false);
  const [currentPollId, setCurrentPollId] = useState(poll.id);
  const startX = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  // Reset image loading states only when poll ID actually changes
  if (poll.id !== currentPollId) {
    setCurrentPollId(poll.id);
    setImageALoaded(false);
    setImageBLoaded(false);
  }

  const handleStart = (clientX: number) => {
    if (hasVoted) return; // Prevent dragging on voted polls
    setIsDragging(true);
    startX.current = clientX;
  };

  const handleMove = (clientX: number) => {
    if (!isDragging || hasVoted) return;
    const diff = clientX - startX.current;
    setDragOffset(diff);
  };

  const handleEnd = () => {
    if (!isDragging || hasVoted) return;
    setIsDragging(false);

    const threshold = 100;
    
    if (dragOffset > threshold) {
      onSwipe('right');
    } else if (dragOffset < -threshold) {
      onSwipe('left');
    }
    
    setDragOffset(0);
  };

  const handleTouchStart = (e: TouchEvent) => handleStart(e.touches[0].clientX);
  const handleTouchMove = (e: TouchEvent) => handleMove(e.touches[0].clientX);
  const handleMouseDown = (e: MouseEvent) => handleStart(e.clientX);
  const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX);

  const rotation = dragOffset * 0.08;
  const opacity = 1 - Math.abs(dragOffset) / 600;

  const getAnimationClass = () => {
    if (isAnimating === 'left') return 'animate-swipe-left';
    if (isAnimating === 'right') return 'animate-swipe-right';
    return '';
  };

  // Check if expired
  const isExpired = poll.ends_at ? new Date(poll.ends_at) < new Date() : false;
  const isLive = !isExpired && poll.is_daily_poll;

  // Calculate live percentages
  const totalLiveVotes = (liveVotes?.a || 0) + (liveVotes?.b || 0);
  const livePercentA = totalLiveVotes > 0 ? Math.round((liveVotes?.a || 0) / totalLiveVotes * 100) : 50;
  const livePercentB = totalLiveVotes > 0 ? Math.round((liveVotes?.b || 0) / totalLiveVotes * 100) : 50;

  return (
    <div
      ref={cardRef}
      className={`w-full max-w-sm mx-auto ${hasVoted ? '' : 'cursor-grab active:cursor-grabbing'} ${getAnimationClass()}`}
      style={{
        transform: isAnimating ? undefined : `translateX(${dragOffset}px) rotate(${rotation}deg)`,
        opacity: isAnimating ? undefined : opacity,
        transition: isDragging ? 'none' : 'transform 0.3s ease-out',
      }}
      onTouchStart={hasVoted ? undefined : handleTouchStart}
      onTouchMove={hasVoted ? undefined : handleTouchMove}
      onTouchEnd={hasVoted ? undefined : handleEnd}
      onMouseDown={hasVoted ? undefined : handleMouseDown}
      onMouseMove={hasVoted ? undefined : handleMouseMove}
      onMouseUp={hasVoted ? undefined : handleEnd}
      onMouseLeave={hasVoted ? undefined : () => isDragging && handleEnd()}
    >
      <div className="bg-poll-card rounded-2xl p-3 shadow-card overflow-hidden">
        {/* Minimal header - just the question */}
        <div className="mb-2">
          <p className="text-base font-bold text-poll-card-foreground leading-snug text-center">{poll.question}</p>
        </div>

        {/* Image Options - Side by Side - BIGGER */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          {/* Option A */}
          <div 
            className={`relative rounded-2xl overflow-hidden transition-all duration-200 ${
              dragOffset < -50 
                ? 'ring-4 ring-accent scale-[1.05] shadow-[0_0_20px_rgba(var(--accent),0.3)]' 
                : ''
            }`}
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
                <div className="w-full h-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center p-4">
                  <span className="text-white text-center font-bold text-base leading-tight">
                    {poll.option_a}
                  </span>
                </div>
              )}
            </div>
            
            {/* Vote indicator */}
            {dragOffset < -50 && (
              <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-sm font-bold shadow-lg">
                ✓
              </div>
            )}
            
            {/* Option label overlay */}
            {poll.image_a_url && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 pt-8">
                <p className="text-white text-sm font-bold truncate drop-shadow-lg">{poll.option_a}</p>
              </div>
            )}
          </div>

          {/* Option B */}
          <div 
            className={`relative rounded-2xl overflow-hidden transition-all duration-200 ${
              dragOffset > 50 
                ? 'ring-4 ring-yellow-400 scale-[1.05] shadow-[0_0_20px_rgba(234,179,8,0.3)]' 
                : ''
            }`}
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
                <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center p-4">
                  <span className="text-white text-center font-bold text-base leading-tight">
                    {poll.option_b}
                  </span>
                </div>
              )}
            </div>
            
            {/* Vote indicator */}
            {dragOffset > 50 && (
              <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-yellow-400 text-black text-sm font-bold shadow-lg">
                ✓
              </div>
            )}
            
            {/* Option label overlay */}
            {poll.image_b_url && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 pt-8">
                <p className="text-white text-sm font-bold truncate drop-shadow-lg">{poll.option_b}</p>
              </div>
            )}
          </div>
        </div>

        {/* Minimal swipe hint - only when not voted */}
        {!hasVoted && !isExpired && (
          <div className="flex justify-center gap-6 text-xs text-poll-card-foreground/50">
            <span>← {poll.option_a.length > 12 ? poll.option_a.slice(0, 12) + '…' : poll.option_a}</span>
            <span>{poll.option_b.length > 12 ? poll.option_b.slice(0, 12) + '…' : poll.option_b} →</span>
          </div>
        )}

        {/* Category + Live badge - compact row after images */}
        {(poll.category || isLive) && !hasVoted && (
          <div className="flex items-center justify-center gap-2 mt-2">
            {isLive && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/20 text-destructive">
                <Radio className="h-2.5 w-2.5" />
                <span className="text-[10px] font-bold uppercase">Live</span>
              </div>
            )}
            {poll.category && (
              <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-medium">
                {poll.category}
              </span>
            )}
          </div>
        )}

        {/* Results Bar - compact after voting */}
        {hasVoted && totalLiveVotes > 0 && (
          <div className="space-y-2 mt-2">
            <div className="flex justify-between text-xs font-bold text-poll-card-foreground">
              <span>{livePercentA}%</span>
              <span>{livePercentB}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden flex">
              <div 
                className="h-full bg-option-a transition-all duration-500 ease-out"
                style={{ width: `${livePercentA}%` }}
              />
              <div 
                className="h-full bg-option-b transition-all duration-500 ease-out"
                style={{ width: `${livePercentB}%` }}
              />
            </div>
            <div className="text-[10px] text-center text-poll-card-foreground/60">
              {totalLiveVotes} votes {isLive && <span className="text-destructive">• Live</span>}
            </div>
            
            {/* Demographics Breakdown - Only shown for admins */}
            {showDemographics && liveVotes?.demographics && (
              <div className="space-y-2 pt-3 border-t border-border/30">
                <h3 className="text-sm font-semibold text-poll-card-foreground">Analytics</h3>
                {/* Gender Breakdown */}
                {Object.keys(liveVotes.demographics.gender).length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-poll-card-foreground/70">
                      <Users className="h-3 w-3" />
                      <span>By Gender</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(liveVotes.demographics.gender).map(([gender, votes]) => {
                        const total = votes.a + votes.b;
                        const percentA = total > 0 ? Math.round((votes.a / total) * 100) : 0;
                        return (
                          <div key={gender} className="flex items-center gap-1.5 text-xs bg-background/20 px-2 py-1 rounded-full">
                            <span className="capitalize text-foreground">{gender}:</span>
                            <span className="font-medium text-option-a">{percentA}%</span>
                            <span className="text-foreground/50">vs</span>
                            <span className="font-medium text-option-b">{100 - percentA}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Age Breakdown */}
                {Object.keys(liveVotes.demographics.age).length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-poll-card-foreground/70">
                      <Calendar className="h-3 w-3" />
                      <span>By Age</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(liveVotes.demographics.age).map(([age, votes]) => {
                        const total = votes.a + votes.b;
                        const percentA = total > 0 ? Math.round((votes.a / total) * 100) : 0;
                        return (
                          <div key={age} className="flex items-center gap-1.5 text-xs bg-background/20 px-2 py-1 rounded-full">
                            <span className="text-foreground">{age}:</span>
                            <span className="font-medium text-option-a">{percentA}%</span>
                            <span className="text-foreground/50">vs</span>
                            <span className="font-medium text-option-b">{100 - percentA}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Country Breakdown */}
                {Object.keys(liveVotes.demographics.country).length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-poll-card-foreground/70">
                      <MapPin className="h-3 w-3" />
                      <span>By Country</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(liveVotes.demographics.country).slice(0, 5).map(([country, votes]) => {
                        const total = votes.a + votes.b;
                        const percentA = total > 0 ? Math.round((votes.a / total) * 100) : 0;
                        return (
                          <div key={country} className="flex items-center gap-1.5 text-xs bg-background/20 px-2 py-1 rounded-full">
                            <span className="text-foreground">{country}:</span>
                            <span className="font-medium text-option-a">{percentA}%</span>
                            <span className="text-foreground/50">vs</span>
                            <span className="font-medium text-option-b">{100 - percentA}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Expired indicator */}
        {isExpired && !hasVoted && (
          <div className="flex items-center justify-center gap-2 py-2 mt-2 rounded-xl bg-muted/50 text-poll-card-foreground/60">
            <Clock className="h-3 w-3" />
            <span className="text-xs font-medium">Expired</span>
          </div>
        )}
      </div>
    </div>
  );
}
