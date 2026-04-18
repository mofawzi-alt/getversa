import { supabase } from '@/integrations/supabase/client';
import { localDateKey } from './pulseTime';

type Field = 'cards_viewed' | 'vote_taps' | 'share_taps';

/**
 * Tracks story interactions in the story_views table.
 * Best-effort: failures are swallowed to avoid breaking UX.
 */
export async function trackStoryEvent(
  topic: string,
  field: Field | null = null,
  opts: { completed?: boolean; userId?: string | null } = {}
) {
  try {
    const userId = opts.userId ?? (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return;
    const view_date = localDateKey();

    // Try to find existing row
    const { data: existing } = await supabase
      .from('story_views' as any)
      .select('id, cards_viewed, vote_taps, share_taps')
      .eq('user_id', userId)
      .eq('topic', topic)
      .eq('view_date', view_date)
      .maybeSingle();

    if (!existing) {
      const insertPayload: any = {
        user_id: userId,
        topic,
        view_date,
        cards_viewed: field === 'cards_viewed' ? 1 : 0,
        vote_taps: field === 'vote_taps' ? 1 : 0,
        share_taps: field === 'share_taps' ? 1 : 0,
        completed: opts.completed ?? false,
      };
      await supabase.from('story_views' as any).insert(insertPayload);
      return;
    }

    const row = existing as any;
    const updatePayload: any = { updated_at: new Date().toISOString() };
    if (field) updatePayload[field] = (row[field] || 0) + 1;
    if (opts.completed) updatePayload.completed = true;

    await supabase.from('story_views' as any).update(updatePayload).eq('id', row.id);
  } catch (e) {
    // Swallow analytics errors
    console.debug('trackStoryEvent failed', e);
  }
}

export async function hasViewedToday(topic: string, userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const view_date = localDateKey();
  const { data } = await supabase
    .from('story_views' as any)
    .select('id, completed')
    .eq('user_id', userId)
    .eq('topic', topic)
    .eq('view_date', view_date)
    .maybeSingle();
  return !!data;
}
