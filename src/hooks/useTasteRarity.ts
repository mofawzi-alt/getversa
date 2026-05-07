import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Calculates how "rare" a user's taste is by checking how often
 * they vote with the minority (<50%) vs majority.
 * Returns a percentile: "rarer than X% of users"
 */
export function useTasteRarity() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['taste-rarity', user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Get user's recent votes
      const { data: votes } = await supabase
        .from('votes')
        .select('poll_id, choice')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!votes || votes.length < 10) return null;

      const pollIds = votes.map(v => v.poll_id);
      const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: pollIds });
      if (!results?.length) return null;

      const resultsMap = new Map(results.map((r: any) => [r.poll_id, r]));

      // Calculate how many times user voted with minority
      let minorityCount = 0;
      let validCount = 0;

      for (const vote of votes) {
        const r = resultsMap.get(vote.poll_id) as any;
        if (!r || r.total_votes < 10) continue;
        validCount++;
        const userPct = vote.choice === 'A' ? r.percent_a : r.percent_b;
        if (userPct < 50) minorityCount++;
      }

      if (validCount < 10) return null;

      // Minority ratio (0-1). Higher = more unique taste
      const minorityRatio = minorityCount / validCount;

      // Convert to percentile. Average user has ~30-40% minority votes.
      // Map to a "rarer than X%" scale
      // 0% minority = rarer than 10% (very mainstream)
      // 50% minority = rarer than 95% (very contrarian)
      const rarityPct = Math.round(Math.min(98, Math.max(5, minorityRatio * 180 + 10)));

      return {
        rarityPct,
        minorityRatio: Math.round(minorityRatio * 100),
        totalAnalyzed: validCount,
        label: rarityPct >= 85 ? 'Ultra Rare' :
               rarityPct >= 70 ? 'Rare' :
               rarityPct >= 50 ? 'Uncommon' :
               rarityPct >= 30 ? 'Common' : 'Mainstream',
      };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
  });
}
