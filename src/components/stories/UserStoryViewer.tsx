import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, Eye } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { GroupedUserStories, UserStory, UserStoryType } from '@/hooks/useUserStories';
import ShareButton from '@/components/poll/ShareButton';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  open: boolean;
  group: GroupedUserStories | null;
  onClose: () => void;
  onViewed: (storyId: string) => void;
  onDelete?: (storyId: string) => void;
  /** Navigate to next user's stories */
  onNext?: () => boolean;
  /** Navigate to previous user's stories */
  onPrevious?: () => boolean;
}

function storyContent(story: UserStory) {
  const c = story.content || {};
  switch (story.story_type) {
    case 'poll_result':
      return {
        headline: c.question || 'Poll Result',
        primary: c.winning_option
          ? `${c.winning_option} wins ${c.winning_pct}%`
          : `${c.option_a}: ${c.pct_a}% vs ${c.option_b}: ${c.pct_b}%`,
        secondary: c.total_votes ? `${Number(c.total_votes).toLocaleString()} votes` : undefined,
        bg: c.image_url || c.image_a_url || c.image_b_url,
        splitA: c.option_a && c.pct_a != null ? { label: c.option_a, pct: c.pct_a } : undefined,
        splitB: c.option_b && c.pct_b != null ? { label: c.option_b, pct: c.pct_b } : undefined,
        emoji: '📊',
        label: 'Poll Result',
        pollId: c.poll_id,
      };
    case 'taste_profile':
      return {
        headline: c.archetype || 'My Taste Profile',
        primary: c.description || 'Check out my taste identity',
        secondary: c.top_categories?.join(' • '),
        bg: c.card_image || null,
        emoji: '🧬',
        label: 'Taste Profile',
      };
    case 'achievement':
      return {
        headline: c.badge_name || c.title || 'Achievement Unlocked!',
        primary: c.description || '🏆',
        secondary: c.detail,
        bg: c.icon_url || null,
        emoji: '🏆',
        label: 'Achievement',
      };
    case 'duel_result':
      return {
        headline: c.opponent ? `vs ${c.opponent}` : 'Duel Result',
        primary: c.won ? '🎉 Won!' : c.tied ? '🤝 Tied' : '😤 Lost',
        secondary: c.score || undefined,
        bg: c.image_url || null,
        emoji: '⚔️',
        label: 'Arena Result',
      };
    default:
      return {
        headline: 'Story',
        primary: '',
        emoji: '✨',
        label: 'Story',
      };
  }
}

export default function UserStoryViewer({ open, group, onClose, onViewed, onDelete, onNext, onPrevious }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [idx, setIdx] = useState(0);
  const stories = group?.stories || [];
  const story = stories[idx];
  const isOwn = user?.id === group?.user_id;

  // Reset index when group changes
  useEffect(() => { setIdx(0); }, [group?.user_id]);

  // Mark viewed
  useEffect(() => {
    if (story && !isOwn) {
      onViewed(story.id);
    }
  }, [story?.id, isOwn, onViewed]);

  // Auto-progress timer
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
    if (idx < stories.length - 1) {
      setIdx(i => i + 1);
    } else if (onNext && onNext()) {
      // handled
    } else {
      onClose();
    }
  }, [idx, stories.length, onNext, onClose]);

  const goPrev = useCallback(() => {
    if (idx > 0) {
      setIdx(i => i - 1);
    } else if (onPrevious) {
      onPrevious();
    }
  }, [idx, onPrevious]);

  // Tap zones
  const handleTap = useCallback((e: React.MouseEvent) => {
    const x = e.clientX;
    const w = window.innerWidth;
    if (x < w * 0.3) goPrev();
    else goNext();
  }, [goPrev, goNext]);

  if (!open || !story || !group) return null;

  const content = storyContent(story);
  const timeAgo = formatDistanceToNow(new Date(story.created_at), { addSuffix: true });

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Progress bars */}
      <div className="absolute top-0 left-0 right-0 flex gap-1 px-2 pt-[calc(env(safe-area-inset-top)+8px)] z-10">
        {stories.map((s, i) => (
          <div key={s.id} className="flex-1 h-[2.5px] bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all"
              style={{ width: i < idx ? '100%' : i === idx ? `${progress}%` : '0%' }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 flex items-center gap-2 px-4 z-10"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 20px)' }}
      >
        <Avatar className="h-8 w-8 border-2 border-white/50">
          {group.avatar_url && <AvatarImage src={group.avatar_url} />}
          <AvatarFallback className="text-xs bg-white/20 text-white">
            {(group.username || '?')[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <span className="text-white text-sm font-semibold truncate block">
            {group.username || 'User'}
          </span>
          <span className="text-white/60 text-[10px]">{timeAgo}</span>
        </div>

        {isOwn && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete?.(story.id); }}
            className="p-2 text-white/70 hover:text-white"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
        {isOwn && (
          <span className="flex items-center gap-1 text-white/60 text-xs">
            <Eye className="w-3.5 h-3.5" />
            {story.views_count}
          </span>
        )}
        <button onClick={onClose} className="p-2 text-white/70 hover:text-white">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Content area — tap zones */}
      <div className="flex-1 relative" onClick={handleTap}>
        {/* Background — gradient for taste/achievement, image for others */}
        {story.story_type === 'taste_profile' ? (
          <>
            <div className="absolute inset-0" style={{
              background: 'linear-gradient(160deg, #0a0f2c 0%, #111b4d 25%, #1a2980 50%, #26348a 75%, #0d1440 100%)'
            }} />
            {/* Radial glow */}
            <div className="absolute inset-0" style={{
              background: 'radial-gradient(circle at 50% 40%, rgba(99,102,241,0.3) 0%, transparent 60%)'
            }} />
            {/* Large centered emoji */}
            <div className="absolute inset-0 flex items-center justify-center" style={{ paddingBottom: '30%' }}>
              <span className="text-[120px] opacity-90">{content.emoji}</span>
            </div>
          </>
        ) : (
          <>
            {(content.bg || story.image_url) && (
              <img
                src={content.bg || story.image_url!}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/50" />
          </>
        )}

        {/* Story content */}
        <div className="absolute bottom-0 left-0 right-0 p-6 pb-20 flex flex-col gap-3">
          <span className="text-white/70 text-xs font-medium uppercase tracking-wider">
            {content.emoji} {content.label}
          </span>
          <h2 className="text-white text-2xl font-bold leading-tight">{content.headline}</h2>
          {content.primary && (
            <p className="text-white text-lg font-semibold">{content.primary}</p>
          )}
          {content.secondary && (
            <p className="text-white/70 text-sm">{content.secondary}</p>
          )}

          {/* Split bar */}
          {content.splitA && content.splitB && (
            <div className="w-full rounded-full overflow-hidden h-8 flex bg-white/10 backdrop-blur-sm">
              <div
                className="h-full flex items-center justify-center text-xs font-bold text-white bg-primary/80"
                style={{ width: `${content.splitA.pct}%` }}
              >
                {content.splitA.label} {content.splitA.pct}%
              </div>
              <div
                className="h-full flex items-center justify-center text-xs font-bold text-white bg-white/20"
                style={{ width: `${content.splitB.pct}%` }}
              >
                {content.splitB.label} {content.splitB.pct}%
              </div>
            </div>
          )}

          {/* Poll link */}
          {content.pollId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
                navigate(`/poll/${content.pollId}`);
              }}
              className="self-start px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm font-medium"
            >
              View Poll →
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
