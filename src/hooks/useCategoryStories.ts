import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { VERSA_CATEGORIES } from '@/lib/categoryMeta';
import { localDateKey } from '@/lib/pulseTime';

export type CategoryStoryData = {
  category: string;
  poll: {
    id: string;
    question: string;
    option_a: string;
    option_b: string;
    image_a_url: string | null;
    image_b_url: string | null;
    category: string | null;
  };
  tally: { a: number; b: number; total: number };
};

/**
 * Fetches the top voted active poll per Versa category in the last 24 hours.
 * Returns one entry per category that has activity.
 */
export function useCategoryStories() {
  return useQuery({
    queryKey: ['category-stories', localDateKey()],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

      // Fetch all active polls
      const { data: polls } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, image_a_url, image_b_url, category')
        .eq('is_active', true)
        .limit(500);

      if (!polls?.length) return [];

      // Fetch recent votes
      const pollIds = polls.map((p: any) => p.id);
      const { data: votes } = await supabase
        .from('votes')
        .select('poll_id, choice')
        .in('poll_id', pollIds)
        .gte('created_at', since)
        .limit(5000);

      // Tally votes per poll
      const tally = new Map<string, { a: number; b: number; total: number }>();
      for (const v of (votes || []) as any[]) {
        const t = tally.get(v.poll_id) || { a: 0, b: 0, total: 0 };
        if (v.choice === 'A') t.a++;
        else if (v.choice === 'B') t.b++;
        else continue;
        t.total++;
        tally.set(v.poll_id, t);
      }

      // Group polls by category (case-insensitive match to VERSA_CATEGORIES)
      const catMap = new Map<string, typeof polls>();
      for (const p of polls as any[]) {
        const catLower = (p.category || '').trim().toLowerCase();
        for (const vc of VERSA_CATEGORIES) {
          if (catLower === vc.toLowerCase()) {
            const list = catMap.get(vc) || [];
            list.push(p);
            catMap.set(vc, list);
            break;
          }
        }
      }

      // Pick top voted poll per category
      const results: CategoryStoryData[] = [];
      for (const cat of VERSA_CATEGORIES) {
        const catPolls = catMap.get(cat);
        if (!catPolls?.length) continue;

        const ranked = catPolls
          .map((p: any) => ({ poll: p, t: tally.get(p.id) || { a: 0, b: 0, total: 0 } }))
          .filter((x: any) => x.t.total > 0)
          .sort((a: any, b: any) => b.t.total - a.t.total);

        if (ranked.length === 0) continue;

        const pick = ranked[0];
        results.push({
          category: cat,
          poll: pick.poll,
          tally: pick.t,
        });
      }

      return results;
    },
    staleTime: 5 * 60 * 1000,
  });
}

const HIDDEN_CATS_KEY = 'versa_hidden_story_categories';

export function getHiddenCategories(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_CATS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

export function setHiddenCategories(hidden: Set<string>) {
  localStorage.setItem(HIDDEN_CATS_KEY, JSON.stringify([...hidden]));
}
