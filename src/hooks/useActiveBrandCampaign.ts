import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ActiveBrandCampaign {
  id: string;
  name: string;
  brand_name: string | null;
  brand_logo_url: string | null;
  description: string | null;
  release_at: string | null;
  expires_at: string | null;
  total_polls: number;
  unvoted_polls: number;
  poll_ids: string[];
}

const MAX_CAROUSEL_CAMPAIGNS = 3;

/**
 * Returns up to 3 active brand campaigns (with unvoted polls) for the carousel banner,
 * sorted by most unvoted polls first. Excludes 'hero_only' campaigns.
 */
export function useActiveBrandCampaigns() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['active-brand-campaigns', user?.id],
    queryFn: async (): Promise<ActiveBrandCampaign[]> => {
      const now = new Date().toISOString();

      const { data: campaigns, error } = await supabase
        .from('poll_campaigns')
        .select('id, name, brand_name, brand_logo_url, description, release_at, expires_at, is_active, visibility_mode')
        .eq('is_active', true)
        .neq('visibility_mode', 'hero_only')
        .or(`release_at.is.null,release_at.lte.${now}`)
        .or(`expires_at.is.null,expires_at.gte.${now}`);

      if (error || !campaigns || campaigns.length === 0) return [];

      const results = await Promise.all(
        campaigns.map(async (c) => {
          const { data: links } = await supabase
            .from('campaign_polls')
            .select('poll_id')
            .eq('campaign_id', c.id);

          const pollIds = (links || []).map((l) => l.poll_id);
          if (pollIds.length === 0) return null;

          let votedIds: string[] = [];
          if (user) {
            const { data: votes } = await supabase
              .from('votes')
              .select('poll_id')
              .eq('user_id', user.id)
              .in('poll_id', pollIds);
            votedIds = (votes || []).map((v) => v.poll_id);
          }

          const unvoted = pollIds.filter((id) => !votedIds.includes(id));

          return {
            id: c.id,
            name: c.name,
            brand_name: c.brand_name,
            brand_logo_url: c.brand_logo_url,
            description: c.description,
            release_at: c.release_at,
            expires_at: c.expires_at,
            total_polls: pollIds.length,
            unvoted_polls: unvoted.length,
            poll_ids: pollIds,
          } as ActiveBrandCampaign;
        })
      );

      const valid = results.filter((r): r is ActiveBrandCampaign => r !== null && r.unvoted_polls > 0);
      valid.sort((a, b) => b.unvoted_polls - a.unvoted_polls);
      return valid.slice(0, MAX_CAROUSEL_CAMPAIGNS);
    },
    staleTime: 60_000,
  });
}

/**
 * Backward-compatible single-campaign hook (returns the top campaign).
 */
export function useActiveBrandCampaign() {
  const query = useActiveBrandCampaigns();
  return {
    ...query,
    data: query.data?.[0] ?? null,
  };
}
