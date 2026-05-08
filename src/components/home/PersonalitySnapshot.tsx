import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { computePersonalityType } from '@/lib/personalityType';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Brain, ChevronRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PersonalitySnapshot() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const MIN_VOTES = 30;

  const { data: voteCount = 0 } = useQuery({
    queryKey: ['personality-vote-count', user?.id],
    queryFn: async () => {
      const { count } = await supabase.from('votes').select('id', { count: 'exact' }).eq('user_id', user!.id);
      return count || 0;
    },
    enabled: !!user,
  });

  const { data: traits = [] } = useQuery({
    queryKey: ['personality-traits', user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_user_voting_traits', { p_user_id: user!.id });
      return (data || []) as { tag: string; vote_count: number }[];
    },
    enabled: !!user,
  });

  if (!user) return null;

  const result = computePersonalityType(traits, voteCount, user.id);
  const progress = Math.min((voteCount / MIN_VOTES) * 100, 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => navigate('/personality')}
      className="relative rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform shadow-md"
    >
      {result.ready ? (
        /* ── Unlocked: vibrant gradient card ── */
        <div className="relative bg-gradient-to-br from-primary/90 via-primary to-primary/80 px-4 py-4">
          {/* Decorative glow */}
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-white/10 blur-2xl -mr-6 -mt-6" />
          <div className="absolute bottom-0 left-0 w-20 h-20 rounded-full bg-black/10 blur-xl -ml-4 -mb-4" />

          <div className="flex items-center gap-3 relative z-10">
            <motion.span
              className="text-5xl drop-shadow-lg"
              initial={{ scale: 0.5, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', damping: 10 }}
            >
              {result.emoji}
            </motion.span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Sparkles className="w-3 h-3 text-white/70" />
                <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">Your Personality</p>
              </div>
              <p className="text-lg font-display font-extrabold text-white leading-tight">{result.name}</p>
              {result.description && (
                <p className="text-xs text-white/80 mt-1 leading-snug line-clamp-2">{result.description}</p>
              )}
            </div>
            <ChevronRight className="h-5 w-5 text-white/60 shrink-0" />
          </div>
        </div>
      ) : (
        /* ── Locked: progress card ── */
        <div className="relative border border-border bg-card px-4 py-4 rounded-2xl">
          <div className="flex items-center gap-3">
            <motion.div
              className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
            >
              <Brain className="h-6 w-6 text-primary" />
            </motion.div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Personality Type</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                {voteCount < MIN_VOTES
                  ? `${MIN_VOTES - voteCount} more votes to unlock`
                  : 'Calculating your type...'}
              </p>
              <div className="h-2 rounded-full bg-muted overflow-hidden mt-2 max-w-[200px]">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{voteCount}/{MIN_VOTES} votes</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </div>
      )}
    </motion.div>
  );
}
