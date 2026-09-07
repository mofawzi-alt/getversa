import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ChevronUp, Flame, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLiveDebateFeed } from '@/hooks/useLiveDebateFeed';
import { getPollDisplayImageSrc } from '@/lib/pollImages';
import { mapToVersaCategory, getCategoryColorClass } from '@/lib/categoryMeta';
import BottomNav from '@/components/layout/BottomNav';
import { playSwipeSound, playResultSound } from '@/lib/sounds';
import { toast } from 'sonner';

type ShortPoll = any;

function OptionSide({
  label,
  image,
  question,
  side,
  percent,
  revealed,
  chosen,
  onVote,
}: {
  label: string;
  image: string | null;
  question: string;
  side: 'A' | 'B';
  percent: number;
  revealed: boolean;
  chosen: boolean;
  onVote: () => void;
}) {
  const src = getPollDisplayImageSrc({ imageUrl: image, option: label, question, side });

  return (
    <button
      onClick={onVote}
      className="relative flex-1 min-h-0 overflow-hidden text-left active:opacity-95"
    >
      {src ? (
        <img src={src} alt={label} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-muted" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/30" />

      <div className="absolute inset-x-0 bottom-0 px-4 pt-10 pb-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
        <p
          className="font-display font-bold text-[18px] leading-tight text-white"
          style={{ textShadow: '0 1px 3px rgba(0,0,0,.45)' }}
        >
          {label}
        </p>
        {revealed && (
          <div className="mt-2">
            <div className="h-1.5 rounded-full bg-white/25 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 0.6 }}
                className={`h-full ${side === 'A' ? 'bg-option-a' : 'bg-option-b'}`}
              />
            </div>
            <p
              className="mt-1 font-display font-extrabold text-[15px] text-white tabular-nums"
              style={{ textShadow: '0 1px 3px rgba(0,0,0,.5)' }}
            >
              {percent}%{chosen ? ' · your pick' : ''}
            </p>
          </div>
        )}
      </div>
    </button>
  );
}

export default function Shorts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useLiveDebateFeed(true);
  const [results, setResults] = useState<Record<string, 'A' | 'B'>>({});
  const [tallies, setTallies] = useState<Record<string, { a: number; b: number }>>({});
  const [liveDeltas, setLiveDeltas] = useState<Record<string, { a: number; b: number }>>({});
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const polls: ShortPoll[] = useMemo(
    () => (data?.pages || []).flatMap((p: any) => p.polls),
    [data]
  );

  const { data: profile } = useQuery({
    queryKey: ['shorts-profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_my_profile');
      return (Array.isArray(data) ? data[0] : data) as any;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
  });

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
    }, { rootMargin: '600px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleVote = async (poll: ShortPoll, choice: 'A' | 'B') => {
    if (results[poll.id]) return;

    if (!user) {
      navigate('/auth');
      return;
    }

    playSwipeSound();
    setResults((prev) => ({ ...prev, [poll.id]: choice }));
    setTallies((prev) => ({
      ...prev,
      [poll.id]: {
        a: (poll.votesA || 0) + (choice === 'A' ? 1 : 0),
        b: (poll.votesB || 0) + (choice === 'B' ? 1 : 0),
      },
    }));
    playResultSound();

    const { error } = await supabase.from('votes').insert({
      poll_id: poll.id,
      user_id: user.id,
      choice,
      category: poll.category || null,
      voter_country: profile?.country || null,
      voter_age_range: profile?.age_range || null,
      voter_gender: profile?.gender || null,
      voter_city: profile?.city || null,
    } as any);

    if (error && !`${error.message}`.toLowerCase().includes('duplicate')) {
      toast.error("Couldn't save your vote — try again");
      setResults((prev) => {
        const next = { ...prev };
        delete next[poll.id];
        return next;
      });
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['user-voted-ids'] });
    queryClient.invalidateQueries({ queryKey: ['user-vote-count'] });
  };

  return (
    <div className="fixed inset-0 bg-black">
      <div className="h-full w-full overflow-y-auto snap-y snap-mandatory scrollbar-hide" style={{ paddingBottom: 0 }}>
        {isLoading && (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary-foreground/70" />
          </div>
        )}

        {polls.map((poll, i) => {
          const choice = results[poll.id];
          const tally = tallies[poll.id];
          const totalA = tally ? tally.a : poll.votesA || 0;
          const totalB = tally ? tally.b : poll.votesB || 0;
          const total = totalA + totalB;
          const pctA = total > 0 ? Math.round((totalA / total) * 100) : 50;

          return (
            <section
              key={poll.id}
              className="relative h-full w-full snap-start snap-always flex flex-col"
              style={{ height: '100%' }}
            >
              {/* Question header */}
              <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-3 bg-gradient-to-b from-black/70 to-transparent">
                <h2
                  className="font-display font-bold text-[22px] leading-[1.15] text-white"
                  style={{ letterSpacing: '-0.01em', textShadow: '0 1px 4px rgba(0,0,0,.5)' }}
                >
                  {poll.question}
                </h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold tracking-wide ${getCategoryColorClass(mapToVersaCategory(poll.category))}`}>
                    <Flame className="h-3 w-3" />
                    {mapToVersaCategory(poll.category)}
                  </span>
                  {total > 0 && (
                    <span className="ml-auto text-[12px] font-semibold text-white/80 tabular-nums">{total.toLocaleString()} votes</span>
                  )}
                </div>
                {poll.subtitle && (
                  <p className="mt-1.5 text-[12px] font-medium text-white/75">{poll.subtitle}</p>
                )}
              </div>

              {/* Two stacked halves */}
              <div className="flex-1 min-h-0 flex flex-col">
                <OptionSide
                  label={poll.option_a}
                  image={poll.image_a_url}
                  question={poll.question}
                  side="A"
                  percent={pctA}
                  revealed={!!choice}
                  chosen={choice === 'A'}
                  onVote={() => handleVote(poll, 'A')}
                />
                <OptionSide
                  label={poll.option_b}
                  image={poll.image_b_url}
                  question={poll.question}
                  side="B"
                  percent={100 - pctA}
                  revealed={!!choice}
                  chosen={choice === 'B'}
                  onVote={() => handleVote(poll, 'B')}
                />
              </div>

              {/* % split bar — same red/blue bar used on Browse cards */}
              {choice && (
                <div
                  className="absolute inset-x-0 z-20 pointer-events-none"
                  style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}
                >
                  <div className="flex items-center justify-between px-3 pb-1.5">
                    <span className="text-[13px] font-extrabold tabular-nums text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,.6)' }}>
                      <span className="text-option-a">●</span> {pctA}%
                    </span>
                    <span className="text-[13px] font-extrabold tabular-nums text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,.6)' }}>
                      {100 - pctA}% <span className="text-option-b">●</span>
                    </span>
                  </div>
                  <div className="h-3 w-full flex overflow-hidden">
                    <div className="h-full bg-option-a transition-all duration-700" style={{ width: `${pctA}%` }} />
                    <div className="h-full bg-option-b transition-all duration-700" style={{ width: `${100 - pctA}%` }} />
                  </div>
                </div>
              )}

              {/* Swipe hint on the first card */}
              {i === 0 && !choice && (
                <div className="absolute bottom-24 left-0 right-0 z-20 flex flex-col items-center gap-1 pointer-events-none">
                  <ChevronUp className="h-4 w-4 text-white/80 animate-bounce" />
                  <span className="text-[11px] font-semibold text-white/80">Tap a side to vote · swipe up for next</span>
                </div>
              )}
            </section>
          );
        })}

        <div ref={sentinelRef} className="h-10" />

        {!isLoading && polls.length === 0 && (
          <div className="h-full flex items-center justify-center px-8 text-center">
            <p className="text-sm font-semibold text-white/80">No shorts right now — check back soon.</p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
