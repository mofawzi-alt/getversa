import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PollCard } from '@/types/poll';

const PAGE_SIZE = 40;

const POLL_SELECT =
  'id, question, subtitle, option_a, option_b, image_a_url, image_b_url, category, created_at, starts_at, ends_at, weight_score, target_gender, target_age_range, target_country, target_countries, option_a_tag, option_b_tag, tags, is_hot_take';

const isVideoUrl = (url?: string | null) =>
  !!url && /\.(mp4|webm|mov)(\?|$)/i.test(url);

/**
 * Paginated, infinite-scroll feed of every active live poll.
 * Used as the secondary "deep" source for the Live Debates section on Home
 * so the feed never repeats — it just loads the next 40 polls.
 */
export function useLiveDebateFeed(enabled: boolean = true) {
  return useInfiniteQuery({
    queryKey: ['live-debate-feed-infinite'],
    initialPageParam: 0,
    enabled,
    staleTime: 1000 * 60,
    queryFn: async ({ pageParam }) => {
      const now = new Date().toISOString();
      const from = (pageParam as number) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: rawPolls, error } = await supabase
        .from('polls')
        .select(POLL_SELECT)
        .eq('is_active', true)
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .or(`ends_at.is.null,ends_at.gt.${now}`)
        .order('weight_score', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      const polls = (rawPolls || []).filter(
        (p) => !isVideoUrl(p.image_a_url) && !isVideoUrl(p.image_b_url) && p.image_a_url && p.image_b_url,
      );

      if (polls.length === 0) {
        return { polls: [] as PollCard[], nextPage: undefined as number | undefined };
      }

      const ids = polls.map((p) => p.id);
      const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: ids });
      const resultsMap = new Map<string, any>((results || []).map((r: any) => [r.poll_id, r]));

      const enriched: PollCard[] = polls.map((p) => {
        const r = resultsMap.get(p.id);
        const total = (r?.total_votes as number) || 0;
        const votesA = (r?.votes_a as number) || 0;
        const votesB = (r?.votes_b as number) || 0;
        const pctA = total > 0 ? Math.round((votesA / total) * 100) : 50;
        return {
          ...(p as any),
          totalVotes: total,
          percentA: pctA,
          percentB: 100 - pctA,
          votesA,
          votesB,
          recentVotes: 0,
          _recentVoterIds: [] as string[],
        };
      });

      return {
        polls: enriched,
        nextPage: (rawPolls || []).length === PAGE_SIZE ? (pageParam as number) + 1 : undefined,
      };
    },
    getNextPageParam: (last) => last.nextPage,
  });
}
