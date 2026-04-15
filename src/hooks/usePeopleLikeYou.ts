import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PeopleLikeYouResult {
  text: string;
  percent: number;
}

/**
 * Returns "80% of people your age picked A" style insight.
 * Only shows when there's enough data and a meaningful signal.
 */
export function usePeopleLikeYou(
  pollId: string,
  choice: 'A' | 'B',
  optionA: string,
  optionB: string
) {
  const { profile } = useAuth();
  const ageRange = profile?.age_range;

  return useQuery<PeopleLikeYouResult | null>({
    queryKey: ['people-like-you', pollId, ageRange, choice],
    queryFn: async () => {
      if (!ageRange) return null;
      const { data } = await supabase.rpc('get_demographic_poll_result', {
        p_poll_id: pollId,
        p_age_range: ageRange,
      });
      const row = data?.[0];
      if (!row || row.demo_total < 3) return null;

      const agePercent = choice === 'A' ? row.demo_percent_a : row.demo_percent_b;
      const overallPercent = choice === 'A' ? row.percent_a : row.percent_b;
      const diff = Math.abs(agePercent - overallPercent);

      // Only show if meaningful difference or strong signal
      if (diff < 5 && agePercent < 55) return null;

      const chosenOption = choice === 'A' ? optionA : optionB;
      return {
        text: `${agePercent}% of ${ageRange} picked ${chosenOption}`,
        percent: agePercent,
      };
    },
    enabled: !!pollId && !!ageRange,
    staleTime: 60000,
  });
}
