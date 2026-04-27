import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { EditorialCard, EditorialStoryType } from '@/lib/editorialStoryTypes';

export type EditorialStory = {
  id: string;
  story_type: EditorialStoryType;
  source: 'manual' | 'auto';
  status: 'draft' | 'published' | 'expired';
  headline: string;
  cards: EditorialCard;
  poll_id: string | null;
  cta_poll_id: string | null;
  total_real_votes: number;
  publish_at: string | null;
  expires_at: string | null;
  views: number;
  completions: number;
  vote_taps: number;
  card_dropoff: Record<string, number>;
  created_at: string;
};

/** Fetch published editorial stories for the home stories row. */
export function useEditorialStories() {
  return useQuery({
    queryKey: ['editorial-stories-published'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('editorial_stories')
        .select('*')
        .eq('status', 'published')
        .lte('publish_at', new Date().toISOString())
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('publish_at', { ascending: false });
      if (error) throw error;
      // One per type — newest published wins
      const seen = new Set<string>();
      const out: EditorialStory[] = [];
      for (const row of (data || []) as EditorialStory[]) {
        if (seen.has(row.story_type)) continue;
        seen.add(row.story_type);
        out.push(row);
      }
      return out;
    },
    staleTime: 60 * 1000,
  });
}

export async function trackEditorialEvent(
  storyId: string,
  event: 'view' | 'complete' | 'vote_tap' | 'dropoff',
  cardIndex?: number,
) {
  try {
    await (supabase as any).rpc('track_editorial_story_event', {
      p_story_id: storyId,
      p_event: event,
      p_card_index: cardIndex ?? null,
    });
  } catch { /* analytics best-effort */ }
}
