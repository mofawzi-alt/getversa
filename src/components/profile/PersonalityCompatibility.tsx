import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { computePersonalityType, computeTypeCompatibility, PERSONALITY_TYPES } from '@/lib/personalityType';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { Brain, Sparkles } from 'lucide-react';

interface Props {
  targetUserId: string;
  targetUsername?: string;
}

export default function PersonalityCompatibility({ targetUserId, targetUsername }: Props) {
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
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Type Compatibility
          </span>
        </div>

        {/* Type pairing */}
        <div className="flex items-center justify-center gap-3">
          <div className="text-center">
            <div className="text-2xl">{ownType.emoji}</div>
            <p className="text-[10px] font-bold text-foreground mt-1">{ownType.name}</p>
            <p className="text-[9px] text-muted-foreground">You</p>
          </div>
          <div className="text-center px-3">
            <div className="text-3xl font-bold text-primary">{compat.score}%</div>
            <div className="text-lg">{compat.emoji}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl">{targetType.emoji}</div>
            <p className="text-[10px] font-bold text-foreground mt-1">{targetType.name}</p>
            <p className="text-[9px] text-muted-foreground">@{targetUsername || 'them'}</p>
          </div>
        </div>

        {/* Label */}
        <div className="text-center">
          <span className="px-4 py-1.5 rounded-full bg-primary/10 text-xs font-bold text-primary">
            {compat.label}
          </span>
        </div>

        {/* Description */}
        <p className="text-sm text-center text-muted-foreground leading-relaxed">
          {compat.description}
        </p>

        {/* Shared strengths & tensions */}
        {compat.sharedStrengths.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">What you share</p>
            {compat.sharedStrengths.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-green-500 text-xs">✓</span>
                <p className="text-xs text-foreground/70">{s}</p>
              </div>
            ))}
          </div>
        )}

        {compat.tensions.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Where you differ</p>
            {compat.tensions.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-primary text-xs">↔</span>
                <p className="text-xs text-foreground/70">{t}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
