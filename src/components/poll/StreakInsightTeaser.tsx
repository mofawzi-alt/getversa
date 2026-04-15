import { Lock, Flame, MapPin, Users, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { getInsightTier, getNextUnlock, type InsightTier } from '@/lib/streakGating';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface StreakInsightTeaserProps {
  pollId: string;
  choice: 'A' | 'B';
}

export default function StreakInsightTeaser({ pollId, choice }: StreakInsightTeaserProps) {
  const { user, profile } = useAuth();
  const streak = profile?.current_streak ?? 0;
  const tier = getInsightTier(streak);
  const nextUnlock = getNextUnlock(streak);

  // City split data (tier >= city)
  const { data: cityData } = useQuery({
    queryKey: ['city-split', pollId, profile?.city],
    queryFn: async () => {
      if (!profile?.city) return null;
      const { data } = await supabase.rpc('get_demographic_poll_result', {
        p_poll_id: pollId,
        p_city: profile.city,
      });
      return data?.[0] || null;
    },
    enabled: tier !== 'none' && !!profile?.city,
    staleTime: 60000,
  });

  // Age split data (tier >= age)
  const { data: ageData } = useQuery({
    queryKey: ['age-split', pollId, profile?.age_range],
    queryFn: async () => {
      if (!profile?.age_range) return null;
      const { data } = await supabase.rpc('get_demographic_poll_result', {
        p_poll_id: pollId,
        p_age_range: profile.age_range,
      });
      return data?.[0] || null;
    },
    enabled: (tier === 'age' || tier === 'full') && !!profile?.age_range,
    staleTime: 60000,
  });

  if (!user) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 space-y-2"
    >
      {/* Unlocked insights */}
      {tier !== 'none' && cityData && cityData.demo_total > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/10">
          <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          <span className="text-[11px] text-foreground/80">
            In <span className="font-semibold">{profile?.city}</span>: {choice === 'A' ? cityData.demo_percent_a : cityData.demo_percent_b}% chose your pick
          </span>
        </div>
      )}

      {(tier === 'age' || tier === 'full') && ageData && ageData.demo_total > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/10">
          <Users className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          <span className="text-[11px] text-foreground/80">
            Ages <span className="font-semibold">{profile?.age_range}</span>: {choice === 'A' ? ageData.demo_percent_a : ageData.demo_percent_b}% agree with you
          </span>
        </div>
      )}

      {tier === 'full' && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/15">
          <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          <span className="text-[11px] text-foreground/80 font-medium">
            Full taste insights unlocked! Check your profile →
          </span>
        </div>
      )}

      {/* Next unlock teaser */}
      {nextUnlock && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50">
          <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          <span className="text-[10px] text-muted-foreground">
            <Flame className="w-3 h-3 inline text-primary mr-0.5" />
            {nextUnlock.daysNeeded} more day{nextUnlock.daysNeeded !== 1 ? 's' : ''} to unlock <span className="font-semibold">{nextUnlock.label}</span>
          </span>
        </div>
      )}
    </motion.div>
  );
}
