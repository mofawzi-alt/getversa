import { supabase } from '@/integrations/supabase/client';
import { resolvePollMediaUrl, getOptimizedPollImageSrc } from '@/lib/pollImages';

/**
 * Preloads the first N active poll images so the home feed has zero gray
 * placeholders on cold-start (especially in the iOS App Store build where
 * WKWebView starts with an empty image cache).
 *
 * Fire-and-forget: never throws, never blocks UI.
 */
let started = false;

const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|ogg)(\?|#|$)/i;

export function preloadFeedImages(limit = 6) {
  if (started) return;
  started = true;

  // Defer slightly so it doesn't compete with the initial paint / auth boot.
  setTimeout(async () => {
    try {
      const { data } = await supabase
        .from('polls')
        .select('image_a_url, image_b_url')
        .eq('is_active', true)
        .order('weight_score', { ascending: false, nullsFirst: false })
        .limit(limit);

      if (!Array.isArray(data)) return;

      const urls = new Set<string>();
      for (const row of data) {
        if (row?.image_a_url) urls.add(row.image_a_url);
        if (row?.image_b_url) urls.add(row.image_b_url);
      }

      urls.forEach((rawUrl) => {
        try {
          const url = resolvePollMediaUrl(rawUrl) || rawUrl;
          if (VIDEO_EXTENSIONS.test(url)) {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.muted = true;
            video.playsInline = true;
            video.src = url;
            video.load();
            return;
          }

          const img = new Image();
          // decoding=async lets the browser warm cache without blocking.
          img.decoding = 'async';
          img.loading = 'eager';
          img.src = url;
        } catch {
          /* best-effort */
        }
      });
    } catch {
      /* best-effort — preloading must never break boot */
    }
  }, 300);
}
