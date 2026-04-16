import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { computePersonalityType } from '@/lib/personalityType';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Brain, ChevronRight } from 'lucide-react';
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

  const result = computePersonalityType(traits, voteCount);
  const progress = Math.min((voteCount / MIN_VOTES) * 100, 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => navigate('/profile/taste')}
      className="mx-4 rounded-2xl border border-border bg-card p-4 cursor-pointer active:scale-[0.98] transition-transform"
    >
      <div className="flex items-center gap-3">
        {result.ready ? (
          <>
            <span className="text-3xl">{result.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Your Personality</p>
              <p className="text-base font-display font-bold text-foreground truncate">{result.name}</p>
              <p className="text-[10px] font-mono text-primary font-bold tracking-[3px]">{result.code}</p>
            </div>
          </>
        ) : (
          <>
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Personality Type</p>
              <p className="text-sm text-foreground">
                {voteCount < MIN_VOTES
                  ? `${MIN_VOTES - voteCount} more votes to unlock`
                  : 'Calculating your type...'}
              </p>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1.5 max-w-[180px]">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
    </motion.div>
  );
}
