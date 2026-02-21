import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Users, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { playSwipeSound, playResultSound } from '@/lib/sounds';

// ── Hub config: Add new seasonal events here ──
interface HubSection {
  key: string;
  emoji: string;
  label: string;
  category: string; // maps to polls.category
}

interface HubConfig {
  slug: string;
  title: string;
  subtitle: string;
  headerText: string;
  accentColor: string; // tailwind class
  bgGradient: string;
  sections: HubSection[];
}

const SEASONAL_HUBS: Record<string, HubConfig> = {
  'ramadan-2026': {
    slug: 'ramadan-2026',
    title: '🌙 Ramadan 2026',
    subtitle: 'Egypt is voting right now.',
    headerText: 'Ramadan Battles',
    accentColor: 'text-amber-400',
    bgGradient: 'from-[#0a0a0a] via-[#1a1510] to-[#0a0a0a]',
    sections: [
      { key: 'series', emoji: '📺', label: 'Series Battles', category: 'Series Battles' },
      { key: 'dessert', emoji: '🍰', label: 'Dessert Battles', category: 'Dessert Battles' },
      { key: 'gym', emoji: '🏋️', label: 'Gym Battles', category: 'Gym Battles' },
    ],
  },
};

interface Poll {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  category: string | null;
  image_a_url: string | null;
  image_b_url: string | null;
}

interface VoteResult {
  choice: 'A' | 'B';
  percentA: number;
  percentB: number;
  totalVotes: number;
}

const SWIPE_THRESHOLD = 80;

export default function SeasonalHub() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const hub = SEASONAL_HUBS[slug || ''];

  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [result, setResult] = useState<VoteResult | null>(null);

  // Fetch polls for this hub
  const { data: hubData, isLoading } = useQuery({
    queryKey: ['seasonal-hub', slug, user?.id],
    queryFn: async () => {
      if (!hub) return { polls: [], votedMap: new Map<string, string>() };
      const { data: polls } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, category, image_a_url, image_b_url')
        .eq('is_active', true)
        .eq('intent_tag', slug!)
        .order('created_at', { ascending: true });

      let votedMap = new Map<string, string>();
      if (user) {
        const pollIds = polls?.map(p => p.id) || [];
        if (pollIds.length > 0) {
          const { data: votes } = await supabase.from('votes').select('poll_id, choice').eq('user_id', user.id).in('poll_id', pollIds);
          votedMap = new Map(votes?.map(v => [v.poll_id, v.choice]) || []);
        }
      }

      // Get results for all polls
      const pollIds = polls?.map(p => p.id) || [];
      let resultsMap = new Map<string, any>();
      if (pollIds.length > 0) {
        const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: pollIds });
        resultsMap = new Map(results?.map((r: any) => [r.poll_id, r]) || []);
      }

      return { polls: (polls || []) as Poll[], votedMap, resultsMap };
    },
    enabled: !!hub,
  });

  const polls = hubData?.polls || [];
  const votedMap = hubData?.votedMap || new Map<string, string>();
  const resultsMap = hubData?.resultsMap || new Map<string, any>();

  if (!hub) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Hub not found</p>
      </div>
    );
  }

  // Group polls by section
  const sectionPolls: Record<string, Poll[]> = {};
  hub.sections.forEach(s => {
    sectionPolls[s.key] = polls.filter(p => p.category === s.category);
  });

  const activeSectionConfig = hub.sections.find(s => s.key === activeSection);
  const activePollList = activeSection ? (sectionPolls[activeSection] || []) : [];

  // If a section is active, show the swipe view
  if (activeSection && activeSectionConfig) {
    return (
      <SectionSwipeView
        hub={hub}
        section={activeSectionConfig}
        polls={activePollList}
        votedMap={votedMap}
        resultsMap={resultsMap}
        userId={user?.id}
        onBack={() => setActiveSection(null)}
      />
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-b ${hub.bgGradient}`}>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-black/80 backdrop-blur-lg border-b border-amber-900/20">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate('/home')} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <ArrowLeft className="h-4 w-4 text-white" />
          </button>
          <div>
            <h1 className={`text-lg font-display font-bold ${hub.accentColor}`}>{hub.title}</h1>
            <p className="text-[10px] text-white/50">{hub.subtitle}</p>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="px-4 py-6 space-y-4">
        {hub.sections.map((section, i) => {
          const sPolls = sectionPolls[section.key] || [];
          const votedCount = sPolls.filter(p => votedMap.has(p.id)).length;
          const hasPolls = sPolls.length > 0;

          return (
            <motion.div
              key={section.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => hasPolls && setActiveSection(section.key)}
              className={`relative rounded-2xl overflow-hidden border ${hasPolls ? 'border-amber-800/30 cursor-pointer' : 'border-white/5 opacity-60'} bg-white/5 backdrop-blur-sm`}
            >
              {/* Gold accent line */}
              <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />

              <div className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{section.emoji}</span>
                  <div>
                    <h3 className="text-white font-bold text-base">{section.label}</h3>
                    <p className="text-white/40 text-xs mt-0.5">
                      {hasPolls
                        ? `${sPolls.length} matchups${votedCount > 0 ? ` · ${votedCount} voted` : ''}`
                        : 'Coming soon'}
                    </p>
                  </div>
                </div>
                {hasPolls && (
                  <ChevronRight className="h-5 w-5 text-amber-400/60" />
                )}
              </div>

              {/* Preview thumbnails for polls with images */}
              {hasPolls && sPolls.slice(0, 3).some(p => p.image_a_url || p.image_b_url) && (
                <div className="px-5 pb-4 flex gap-2">
                  {sPolls.slice(0, 4).map(p => (
                    <div key={p.id} className="w-12 h-12 rounded-lg overflow-hidden border border-white/10">
                      <img
                        src={p.image_a_url || p.image_b_url || ''}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ── Section Swipe View ──
function SectionSwipeView({
  hub,
  section,
  polls,
  votedMap,
  resultsMap,
  userId,
  onBack,
}: {
  hub: HubConfig;
  section: HubSection;
  polls: Poll[];
  votedMap: Map<string, string>;
  resultsMap: Map<string, any>;
  userId?: string;
  onBack: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [result, setResult] = useState<VoteResult | null>(null);
  const [phase, setPhase] = useState<'swipe' | 'result'>('swipe');
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const queryClient = useQueryClient();

  const poll = polls[currentIndex];
  const hasMore = currentIndex < polls.length - 1;
  const isVoted = poll ? votedMap.has(poll.id) : false;

  // Show results for already-voted polls
  useEffect(() => {
    if (!poll || !isVoted) return;
    const r = resultsMap.get(poll.id);
    if (r) {
      const total = r.total_votes || 0;
      const pctA = total > 0 ? Math.round((r.votes_a / total) * 100) : 50;
      setResult({
        choice: (votedMap.get(poll.id) as 'A' | 'B') || 'A',
        percentA: pctA,
        percentB: 100 - pctA,
        totalVotes: total,
      });
      setPhase('result');
    }
  }, [poll?.id]);

  const voteMutation = useMutation({
    mutationFn: async ({ pollId, choice }: { pollId: string; choice: 'A' | 'B' }) => {
      if (!userId) throw new Error('Not authenticated');
      await supabase.from('votes').insert({ poll_id: pollId, user_id: userId, choice });
      const { data: votes } = await supabase.from('votes').select('choice').eq('poll_id', pollId);
      const total = votes?.length || 0;
      const aVotes = votes?.filter(v => v.choice === 'A').length || 0;
      const pctA = total > 0 ? Math.round((aVotes / total) * 100) : 50;
      return { choice, percentA: pctA, percentB: 100 - pctA, totalVotes: total };
    },
    onSuccess: (data) => {
      playResultSound();
      setResult(data);
      setPhase('result');
      queryClient.invalidateQueries({ queryKey: ['seasonal-hub'] });
    },
  });

  const handleVote = useCallback((choice: 'A' | 'B') => {
    if (!poll || phase !== 'swipe' || voteMutation.isPending) return;
    playSwipeSound();
    voteMutation.mutate({ pollId: poll.id, choice });
  }, [poll, phase, voteMutation]);

  const handleNext = () => {
    if (hasMore) {
      setCurrentIndex(prev => prev + 1);
      setResult(null);
      setPhase('swipe');
      setDragX(0);
    } else {
      onBack();
    }
  };

  // Swipe handlers
  const handleStart = (clientX: number) => {
    if (phase !== 'swipe' || isVoted) return;
    setIsDragging(true);
    startXRef.current = clientX;
  };
  const handleMove = (clientX: number) => {
    if (!isDragging) return;
    setDragX(clientX - startXRef.current);
  };
  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragX < -SWIPE_THRESHOLD) handleVote('A');
    else if (dragX > SWIPE_THRESHOLD) handleVote('B');
    setDragX(0);
  };

  if (!poll) {
    return (
      <div className={`min-h-screen bg-gradient-to-b ${hub.bgGradient} flex items-center justify-center`}>
        <div className="text-center">
          <p className="text-white text-lg font-bold">No matchups yet</p>
          <button onClick={onBack} className="mt-4 px-6 py-2 rounded-full bg-amber-500/20 text-amber-400 text-sm font-bold">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const normalizedDrag = Math.min(Math.abs(dragX), 200) / 200;
  const rotation = Math.sign(dragX) * normalizedDrag * 8;

  return (
    <div className={`fixed inset-0 z-[100] bg-gradient-to-b ${hub.bgGradient} flex flex-col`}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-[env(safe-area-inset-top,12px)] pb-2 z-30">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
          <ArrowLeft className="h-4 w-4 text-white" />
        </button>
        <span className={`text-xs font-bold ${hub.accentColor}`}>
          {section.emoji} {section.label}
        </span>
        <span className="text-white/30 text-[10px]">
          {currentIndex + 1}/{polls.length}
        </span>
      </div>

      {/* Question */}
      <div className="px-6 py-2 text-center z-20">
        <p className={`text-lg font-display font-bold text-white drop-shadow-lg`}>
          {poll.question}
        </p>
      </div>

      {/* Card */}
      <div className="flex-1 px-4 pb-4 relative">
        <div
          className="w-full h-full rounded-2xl overflow-hidden border border-amber-900/30 shadow-2xl"
          style={{
            transform: phase === 'swipe' && !isVoted
              ? `translateX(${dragX}px) rotate(${rotation}deg)`
              : 'none',
            transition: isDragging ? 'none' : 'transform 0.3s ease-out',
          }}
          onTouchStart={e => handleStart(e.touches[0].clientX)}
          onTouchMove={e => { handleMove(e.touches[0].clientX); if (Math.abs(dragX) > 10) e.preventDefault(); }}
          onTouchEnd={handleEnd}
          onMouseDown={e => { e.preventDefault(); handleStart(e.clientX); }}
          onMouseMove={e => handleMove(e.clientX)}
          onMouseUp={handleEnd}
          onMouseLeave={() => isDragging && handleEnd()}
        >
          <div className="flex h-full w-full relative">
            {/* Option A */}
            <div className="w-1/2 h-full relative overflow-hidden">
              {poll.image_a_url ? (
                <img src={poll.image_a_url} alt={poll.option_a} className="w-full h-full object-cover" draggable={false} />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-amber-900/40 to-black flex items-center justify-center p-4">
                  <span className="text-white font-bold text-center text-lg">{poll.option_a}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
              <div className="absolute bottom-4 left-3 right-1">
                <p className="text-white text-base font-bold drop-shadow-lg">{poll.option_a}</p>
              </div>
              {dragX < -30 && (
                <div className="absolute inset-0 border-2 border-option-a/60 pointer-events-none" style={{ opacity: normalizedDrag }} />
              )}
            </div>

            <div className="absolute inset-y-0 left-1/2 w-[2px] bg-amber-500/20 z-10" />

            {/* Option B */}
            <div className="w-1/2 h-full relative overflow-hidden">
              {poll.image_b_url ? (
                <img src={poll.image_b_url} alt={poll.option_b} className="w-full h-full object-cover" draggable={false} />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-amber-900/40 to-black flex items-center justify-center p-4">
                  <span className="text-white font-bold text-center text-lg">{poll.option_b}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
              <div className="absolute bottom-4 left-1 right-3 text-right">
                <p className="text-white text-base font-bold drop-shadow-lg">{poll.option_b}</p>
              </div>
              {dragX > 30 && (
                <div className="absolute inset-0 border-2 border-option-b/60 pointer-events-none" style={{ opacity: normalizedDrag }} />
              )}
            </div>
          </div>

          {/* Results overlay */}
          <AnimatePresence>
            {phase === 'result' && result && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 z-40 flex items-end justify-center pb-8 bg-gradient-to-t from-black/80 via-black/30 to-transparent"
              >
                <div className="flex flex-col items-center gap-3 w-full px-6">
                  <div className="flex items-center gap-6 w-full justify-center">
                    <div className="flex flex-col items-center">
                      <span className={`text-3xl font-bold ${result.choice === 'A' ? 'text-option-a' : 'text-white/60'}`}>
                        {result.percentA}%
                      </span>
                      <span className="text-white/40 text-xs mt-1 truncate max-w-[100px]">{poll.option_a}</span>
                      {result.choice === 'A' && <span className="text-option-a text-[10px] font-bold mt-0.5">Your vote</span>}
                    </div>
                    <div className="w-px h-12 bg-amber-500/20" />
                    <div className="flex flex-col items-center">
                      <span className={`text-3xl font-bold ${result.choice === 'B' ? 'text-option-b' : 'text-white/60'}`}>
                        {result.percentB}%
                      </span>
                      <span className="text-white/40 text-xs mt-1 truncate max-w-[100px]">{poll.option_b}</span>
                      {result.choice === 'B' && <span className="text-option-b text-[10px] font-bold mt-0.5">Your vote</span>}
                    </div>
                  </div>

                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden flex">
                    <motion.div
                      initial={{ width: '50%' }}
                      animate={{ width: `${result.percentA}%` }}
                      transition={{ duration: 0.7 }}
                      className="h-full bg-option-a rounded-l-full"
                    />
                    <motion.div
                      initial={{ width: '50%' }}
                      animate={{ width: `${result.percentB}%` }}
                      transition={{ duration: 0.7 }}
                      className="h-full bg-option-b rounded-r-full"
                    />
                  </div>

                  <span className="text-white/30 text-xs flex items-center gap-1">
                    <Users className="h-3 w-3" /> {result.totalVotes} votes
                  </span>

                  <button
                    onClick={handleNext}
                    className="mt-2 px-6 py-2.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-bold"
                  >
                    {hasMore ? 'Next Matchup →' : 'Back to Hub'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Swipe hints */}
      {phase === 'swipe' && !isVoted && (
        <div className="flex justify-center gap-6 text-xs text-white/25 pb-[env(safe-area-inset-bottom,8px)] px-4">
          <span>← {poll.option_a.length > 12 ? poll.option_a.slice(0, 12) + '…' : poll.option_a}</span>
          <span>{poll.option_b.length > 12 ? poll.option_b.slice(0, 12) + '…' : poll.option_b} →</span>
        </div>
      )}
    </div>
  );
}
