import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { computePersonalityType, computeTypeCompatibility, PERSONALITY_TYPES } from '@/lib/personalityType';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { Brain, Sparkles } from 'lucide-react';
import { useT } from '@/hooks/useT';

interface Props {
  targetUserId: string;
  targetUsername?: string;
}

export default function PersonalityCompatibility({ targetUserId, targetUsername }: Props) {
  const { t } = useT();
  const { user } = useAuth();

  // Own traits + vote count
  const { data: ownTraits = [] } = useQuery({
    queryKey: ['personality-traits', user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_user_voting_traits', { p_user_id: user!.id });
      return (data || []) as { tag: string; vote_count: number }[];
    },
    enabled: !!user?.id,
  });

  const { data: ownVoteCount = 0 } = useQuery({
    queryKey: ['personality-vote-count', user?.id],
    queryFn: async () => {
      const { count } = await supabase.from('votes').select('id', { count: 'exact' }).eq('user_id', user!.id);
      return count || 0;
    },
    enabled: !!user?.id,
  });

  // Target traits + vote count
  const { data: targetTraits = [] } = useQuery({
    queryKey: ['personality-traits', targetUserId],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_user_voting_traits', { p_user_id: targetUserId });
      return (data || []) as { tag: string; vote_count: number }[];
    },
    enabled: !!targetUserId,
  });

  const { data: targetVoteCount = 0 } = useQuery({
    queryKey: ['personality-vote-count', targetUserId],
    queryFn: async () => {
      const { count } = await supabase.from('votes').select('id', { count: 'exact' }).eq('user_id', targetUserId);
      return count || 0;
    },
    enabled: !!targetUserId,
  });

  const ownType = computePersonalityType(ownTraits, ownVoteCount, user?.id);
  const targetType = computePersonalityType(targetTraits, targetVoteCount, targetUserId);
  const compat = computeTypeCompatibility(ownType, targetType);

  if (!compat) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl overflow-hidden border border-primary/20"
    >
      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              {t('Type Compatibility')}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground/80 text-center max-w-[260px] leading-tight">
            {t('Based on personality archetypes — not the same as your Vote Match %.')}
          </p>
        </div>

        {/* Type pairing */}
        <div className="flex items-center justify-center gap-3">
          <div className="text-center">
            <div className="text-2xl">{ownType.emoji}</div>
            <p className="text-[10px] font-bold text-foreground mt-1">{t(ownType.name)}</p>
            <p className="text-[9px] text-muted-foreground">{t('You')}</p>
          </div>
          <div className="text-center px-3">
            <div className="text-3xl font-bold text-primary">{compat.score}%</div>
            <div className="text-lg">{compat.emoji}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl">{targetType.emoji}</div>
            <p className="text-[10px] font-bold text-foreground mt-1">{t(targetType.name)}</p>
            <p className="text-[9px] text-muted-foreground">@{targetUsername || t('them')}</p>
          </div>
        </div>

        {/* Label */}
        <div className="text-center">
          <span className="px-4 py-1.5 rounded-full bg-primary/10 text-xs font-bold text-primary">
            {t(compat.label)}
          </span>
        </div>

        {/* Description */}
        <p className="text-sm text-center text-muted-foreground leading-relaxed">
          {t(compat.descriptionKey, { a: t(compat.nameA), b: t(compat.nameB) })}
        </p>

        {/* Shared strengths & tensions */}
        {compat.sharedStrengths.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t('What you share')}</p>
            {compat.sharedStrengths.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-green-500 text-xs">✓</span>
                <p className="text-xs text-foreground/70">{t(s)}</p>
              </div>
            ))}
          </div>
        )}

        {compat.tensions.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t('Where you differ')}</p>
            {compat.tensions.map((x, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-primary text-xs">↔</span>
                <p className="text-xs text-foreground/70">{t(x)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
