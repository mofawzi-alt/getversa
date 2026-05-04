import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, Eye, TrendingUp, Users, Flame, Crown, Zap, Share2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { GroupedUserStories, UserStory } from '@/hooks/useUserStories';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  open: boolean;
  group: GroupedUserStories | null;
  onClose: () => void;
  onViewed: (storyId: string) => void;
  onDelete?: (storyId: string) => void;
  onNext?: () => boolean;
  onPrevious?: () => boolean;
}

/** Fetch poll data for stories with incomplete content */
function usePollFallback(pollId: string | undefined, hasData: boolean) {
  return useQuery({
    queryKey: ['story-poll-fallback', pollId],
    queryFn: async () => {
      if (!pollId) return null;
      const { data: poll } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, image_a_url, image_b_url')
        .eq('id', pollId)
        .single();
      if (!poll) return null;

      const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: [pollId] });
      const r = results?.[0];
      return {
        ...poll,
        pct_a: r?.pct_a ?? 50,
        pct_b: r?.pct_b ?? 50,
        total_votes: r?.total ?? 0,
        winning_option: (r?.pct_a ?? 50) >= (r?.pct_b ?? 50) ? poll.option_a : poll.option_b,
        winning_pct: Math.max(r?.pct_a ?? 50, r?.pct_b ?? 50),
      };
    },
    enabled: !!pollId && !hasData,
    staleTime: 60000,
  });
}

function storyContent(story: UserStory, fallbackPoll?: any) {
  const c = story.content || {};
  const p = fallbackPoll; // poll fallback when content is incomplete

  switch (story.story_type) {
    case 'poll_result': {
      const optA = c.option_a || p?.option_a;
      const optB = c.option_b || p?.option_b;
      const pctA = c.pct_a ?? p?.pct_a;
      const pctB = c.pct_b ?? p?.pct_b;
      const totalVotes = c.total_votes ?? p?.total_votes ?? 0;
      const winOpt = c.winning_option || p?.winning_option;
      const winPct = c.winning_pct || p?.winning_pct;
      const imgA = c.image_a_url || p?.image_a_url;
      const imgB = c.image_b_url || p?.image_b_url;
      const bg = c.image_url || imgA || imgB;

      const hasResults = pctA != null && pctB != null;
      return {
        headline: c.question || p?.question || 'Poll Result',
        primary: hasResults
          ? (winOpt
            ? `${winOpt} wins with ${winPct}%`
            : `${optA}: ${pctA}% vs ${optB}: ${pctB}%`)
          : 'Vote to see results',
        secondary: totalVotes > 0 ? `${Number(totalVotes).toLocaleString()} people voted` : undefined,
        bg,
        splitA: optA && pctA != null ? { label: optA, pct: Number(pctA) } : undefined,
        splitB: optB && pctB != null ? { label: optB, pct: Number(pctB) } : undefined,
        emoji: '📊',
        label: 'Poll Result',
        pollId: c.poll_id,
        totalVotes,
        type: 'poll_result' as const,
      };
    }
    case 'taste_profile':
      return {
        headline: c.archetype || 'My Taste Profile',
        primary: c.description || 'Check out my taste identity',
        secondary: [
          c.personality_name,
          c.top_categories?.length ? c.top_categories.join(' · ') : null,
          c.total_votes ? `${Number(c.total_votes).toLocaleString()} votes` : null,
        ].filter(Boolean).join('  ·  ') || undefined,
        bg: c.card_image || null,
        emoji: '🧬',
        label: 'Taste Profile',
        type: 'taste_profile' as const,
      };
    case 'achievement':
      return {
        headline: c.badge_name || c.title || 'Achievement Unlocked!',
        primary: c.description || '🏆',
        secondary: c.detail,
        bg: c.icon_url || null,
        emoji: '🏆',
        label: 'Achievement',
        type: 'achievement' as const,
      };
    case 'duel_result':
      return {
        headline: c.opponent ? `vs ${c.opponent}` : 'Duel Result',
        primary: c.won ? '🎉 Won!' : c.tied ? '🤝 Tied' : '😤 Lost',
        secondary: c.score || undefined,
        bg: c.image_url || null,
        emoji: '⚔️',
        label: 'Arena Result',
        type: 'duel_result' as const,
      };
    default:
      return {
        headline: 'Story',
        primary: '',
        emoji: '✨',
        label: 'Story',
        type: 'default' as const,
      };
  }
}

const STORY_THEMES: Record<string, {
  gradient: string;
  glow: string;
  accent: string;
  icon: typeof Flame;
}> = {
  poll_result: {
    gradient: 'linear-gradient(160deg, #0a1628 0%, #0f2440 30%, #1a3a5f 60%, #2563eb 100%)',
    glow: 'radial-gradient(ellipse at 50% 30%, rgba(37,99,235,0.4) 0%, transparent 70%)',
    accent: '#3b82f6',
    icon: TrendingUp,
  },
  taste_profile: {
    gradient: 'linear-gradient(160deg, #0a0f2c 0%, #111b4d 30%, #1a2980 60%, #26348a 100%)',
    glow: 'radial-gradient(ellipse at 50% 30%, rgba(99,102,241,0.4) 0%, transparent 70%)',
    accent: '#818cf8',
    icon: Zap,
  },
  achievement: {
    gradient: 'linear-gradient(160deg, #1a0a00 0%, #3d1c00 30%, #7a3d00 60%, #b87333 100%)',
    glow: 'radial-gradient(ellipse at 50% 30%, rgba(251,191,36,0.4) 0%, transparent 70%)',
    accent: '#fbbf24',
    icon: Crown,
  },
  duel_result: {
    gradient: 'linear-gradient(160deg, #1a0022 0%, #2d0041 30%, #5b21b6 60%, #7c3aed 100%)',
    glow: 'radial-gradient(ellipse at 50% 30%, rgba(139,92,246,0.4) 0%, transparent 70%)',
    accent: '#a78bfa',
    icon: Flame,
  },
};

export default function UserStoryViewer({ open, group, onClose, onViewed, onDelete, onNext, onPrevious }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [idx, setIdx] = useState(0);
  const stories = group?.stories || [];
  const story = stories[idx];
  const isOwn = user?.id === group?.user_id;

  // Determine if we need poll fallback data
  const needsFallback = story?.story_type === 'poll_result' &&
    story?.content?.poll_id &&
    (story?.content?.pct_a == null || story?.content?.option_a == null);
  const { data: fallbackPoll } = usePollFallback(
    story?.content?.poll_id,
    !needsFallback
  );

  useEffect(() => { setIdx(0); }, [group?.user_id]);

  useEffect(() => {
    if (story && !isOwn) onViewed(story.id);
  }, [story?.id, isOwn, onViewed]);

  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!open || !story) return;
    setProgress(0);
    const duration = 6000;
    const interval = 50;
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += interval;
      setProgress(Math.min((elapsed / duration) * 100, 100));
      if (elapsed >= duration) {
        clearInterval(timer);
        goNext();
      }
    }, interval);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, story?.id]);

  const goNext = useCallback(() => {
    if (idx < stories.length - 1) setIdx(i => i + 1);
    else if (onNext && onNext()) { /* handled */ }
    else onClose();
  }, [idx, stories.length, onNext, onClose]);

  const goPrev = useCallback(() => {
    if (idx > 0) setIdx(i => i - 1);
    else if (onPrevious) onPrevious();
  }, [idx, onPrevious]);

  const handleTap = useCallback((e: React.MouseEvent) => {
    const x = e.clientX;
    const w = window.innerWidth;
    if (x < w * 0.3) goPrev();
    else goNext();
  }, [goPrev, goNext]);

  if (!open || !story || !group) return null;

  const content = storyContent(story, fallbackPoll);
  const timeAgo = formatDistanceToNow(new Date(story.created_at), { addSuffix: true });
  const theme = STORY_THEMES[story.story_type] || STORY_THEMES.poll_result;
  const hasImage = !!(content.bg || story.image_url);
  const ThemeIcon = theme.icon;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Progress bars */}
      <div className="absolute top-0 left-0 right-0 flex gap-1 px-3 pt-[calc(env(safe-area-inset-top)+8px)] z-20">
        {stories.map((s, i) => (
          <div key={s.id} className="flex-1 h-[3px] bg-white/20 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: theme.accent }}
              initial={{ width: '0%' }}
              animate={{ width: i < idx ? '100%' : i === idx ? `${progress}%` : '0%' }}
              transition={{ ease: 'linear', duration: 0.05 }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center gap-3 px-4 z-20"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 22px)' }}
      >
        <Avatar className="h-9 w-9 ring-2 ring-white/30">
          {group.avatar_url && <AvatarImage src={group.avatar_url} />}
          <AvatarFallback className="text-xs bg-white/20 text-white font-bold">
            {(group.username || '?')[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <span className="text-white text-sm font-bold truncate block">
            {group.username || 'User'}
          </span>
          <span className="text-white/50 text-[10px]">{timeAgo}</span>
        </div>
        {isOwn && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm('Delete this story?')) {
                  onDelete?.(story.id);
                  if (stories.length > 1) {
                    setIdx(idx >= stories.length - 1 ? Math.max(0, idx - 1) : idx);
                  } else onClose();
                }
              }}
              className="p-2 text-white/50 hover:text-white transition"
            >
              <Trash2 className="w-4.5 h-4.5" />
            </button>
            <span className="flex items-center gap-1 text-white/40 text-xs">
              <Eye className="w-3.5 h-3.5" />
              {story.views_count}
            </span>
          </>
        )}
        <button onClick={onClose} className="p-2 text-white/60 hover:text-white transition">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content area — tap zones */}
      <div className="flex-1 relative overflow-hidden" onClick={handleTap}>
        {/* Background */}
        {hasImage ? (
          <>
            <img
              src={content.bg || story.image_url!}
              alt=""
              className="absolute inset-0 w-full h-full object-cover scale-105 blur-[1px]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/60" />
          </>
        ) : (
          <>
            <div className="absolute inset-0" style={{ background: theme.gradient }} />
            <div className="absolute inset-0" style={{ background: theme.glow }} />
            {/* Animated emoji icon */}
            <div className="absolute inset-0 flex items-center justify-center" style={{ paddingBottom: '35%' }}>
              <motion.span
                className="text-[140px] drop-shadow-2xl"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 0.9 }}
                transition={{ type: 'spring', damping: 12 }}
              >
                {content.emoji}
              </motion.span>
            </div>
          </>
        )}

        {/* Floating accent glow orb */}
        <div
          className="absolute w-64 h-64 rounded-full opacity-20 blur-3xl"
          style={{ background: theme.accent, bottom: '20%', left: '-10%' }}
        />

        {/* Story content */}
        <div className="absolute bottom-0 left-0 right-0 p-6 pb-8 flex flex-col gap-3">
          {/* Type badge */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-2"
          >
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider backdrop-blur-md"
              style={{
                backgroundColor: `${theme.accent}30`,
                color: theme.accent,
                border: `1px solid ${theme.accent}40`,
              }}
            >
              <ThemeIcon className="w-3 h-3" />
              {content.label}
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-white text-[26px] font-extrabold leading-[1.15] drop-shadow-lg"
          >
            {content.headline}
          </motion.h2>

          {/* Primary text */}
          {content.primary && (
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="text-white/90 text-lg font-semibold"
            >
              {content.primary}
            </motion.p>
          )}

          {/* Results split bar — redesigned */}
          {content.splitA && content.splitB && (
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: 0.35, type: 'spring', damping: 20 }}
              className="w-full"
            >
              <div className="flex items-center justify-between text-[11px] text-white/70 font-medium mb-1.5">
                <span>{content.splitA.label}</span>
                <span>{content.splitB.label}</span>
              </div>
              <div className="w-full rounded-full overflow-hidden h-10 flex bg-white/10 backdrop-blur-md border border-white/10">
                <motion.div
                  className="h-full flex items-center justify-center text-sm font-extrabold text-white"
                  style={{ backgroundColor: `${theme.accent}cc` }}
                  initial={{ width: '50%' }}
                  animate={{ width: `${content.splitA.pct}%` }}
                  transition={{ delay: 0.5, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                >
                  {content.splitA.pct > 15 && `${content.splitA.pct}%`}
                </motion.div>
                <div className="h-full flex-1 flex items-center justify-center text-sm font-extrabold text-white/80">
                  {content.splitB.pct > 15 && `${content.splitB.pct}%`}
                </div>
              </div>
            </motion.div>
          )}

          {/* Secondary / social proof */}
          {content.secondary && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex items-center gap-2 text-white/60 text-sm"
            >
              <Users className="w-3.5 h-3.5" />
              <span>{content.secondary}</span>
            </motion.div>
          )}

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex items-center gap-3 mt-1"
          >
            {content.pollId && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                  navigate(`/poll/${content.pollId}`);
                }}
                className="px-5 py-2.5 rounded-full font-bold text-sm transition-all active:scale-95"
                style={{
                  backgroundColor: theme.accent,
                  color: '#fff',
                  boxShadow: `0 4px 20px ${theme.accent}60`,
                }}
              >
                Vote Now →
              </button>
            )}
          </motion.div>
        </div>

        {/* Subtle watermark */}
        <div className="absolute bottom-2 right-4 text-white/15 text-[10px] font-bold tracking-widest uppercase">
          Versa
        </div>
      </div>
    </div>,
    document.body
  );
}
