import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

// Maps tags to human-readable insight phrases
const TAG_INSIGHTS: Record<string, string> = {
  convenience: 'You tend to prioritize convenience over effort',
  price_sensitive: 'You are highly price-conscious in your decisions',
  brand_oriented: 'You prefer strong brands over cheaper alternatives',
  growth: 'You lean towards long-term growth decisions',
  conservative: 'You prefer stability and low-risk choices',
  risk_taker: 'You are comfortable taking risks for higher rewards',
  experience: 'You value experience and lifestyle choices',
  practical: 'You tend to make practical, value-driven decisions',
  quality: 'You choose quality over quantity',
  speed: 'You value speed and efficiency',
  adventurous: 'You tend to explore new options over familiar ones',
  social: 'You value social connection and community',
  independent: 'You prefer independence and self-reliance',
  health: 'You prioritize health and wellness choices',
  indulgent: 'You enjoy indulging in life\'s pleasures',
  minimal: 'You lean towards simplicity and minimalism',
  luxury: 'You appreciate premium and luxury experiences',
  traditional: 'You value tradition and proven approaches',
  innovative: 'You gravitate towards innovation and new ideas',
  local: 'You prefer supporting local options',
  global: 'You tend to choose globally recognized options',
};

const FALLBACK_INSIGHT = (tag: string) =>
  `You often choose "${tag.replace(/_/g, ' ')}" options`;

const MIN_VOTES_FOR_INSIGHTS = 5;
const MAX_INSIGHTS = 4;

export default function VotingInsights() {
  const { user, profile } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ['user-vote-count', user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from('votes')
        .select('id', { count: 'exact' })
        .eq('user_id', user!.id);
      return count || 0;
    },
    enabled: !!user,
  });

  const { data: traits, isLoading } = useQuery({
    queryKey: ['user-voting-traits', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_user_voting_traits', {
        p_user_id: user!.id,
      } as any);
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!user && (stats || 0) >= MIN_VOTES_FOR_INSIGHTS,
  });

  if (!user || isLoading) return null;

  // Not enough votes yet
  if ((stats || 0) < MIN_VOTES_FOR_INSIGHTS) {
    const remaining = MIN_VOTES_FOR_INSIGHTS - (stats || 0);
    return (
      <div className="glass rounded-2xl p-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-display font-bold text-foreground">Your Decision Profile</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Vote on {remaining} more poll{remaining !== 1 ? 's' : ''} to unlock your personal insights
        </p>
        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${((stats || 0) / MIN_VOTES_FOR_INSIGHTS) * 100}%` }}
          />
        </div>
      </div>
    );
  }

  // No tagged polls voted on yet
  if (!traits || traits.length === 0) return null;

  const insights = traits
    .filter((t: any) => t.vote_count >= 2)
    .slice(0, MAX_INSIGHTS)
    .map((t: any) => TAG_INSIGHTS[t.tag] || FALLBACK_INSIGHT(t.tag));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-4 space-y-3"
    >
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-display font-bold text-foreground">Your Decision Profile</h3>
      </div>

      <div className="space-y-2">
        {insights.map((insight: string, i: number) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-start gap-2.5"
          >
            <span className="text-primary text-xs mt-0.5">●</span>
            <p className="text-xs text-foreground/80 leading-relaxed">{insight}</p>
          </motion.div>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground/60 text-center pt-1">
        Based on your voting patterns
      </p>
    </motion.div>
  );
}
