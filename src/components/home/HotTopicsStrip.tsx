import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { useHotTopics } from '@/hooks/useHotTopics';
import { getPollDisplayImageSrc } from '@/lib/pollImages';

/**
 * Pinned "Hot right now" rail at the very top of Home.
 * Ranked by votes in the last 6 hours; refreshes with pull-to-refresh.
 */
export default function HotTopicsStrip() {
  const navigate = useNavigate();
  const { data: hot = [], isLoading } = useHotTopics(10);

  if (isLoading || hot.length === 0) return null;

  return (
    <div className="mb-2">
      <div className="flex items-center gap-1.5 px-3 mb-1.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        <h2 className="text-[13px] font-extrabold uppercase tracking-wide text-foreground">Hot right now</h2>
        <span className="text-[10px] font-medium text-muted-foreground">updates live</span>
      </div>

      <div className="flex gap-2.5 overflow-x-auto px-3 pb-1 scrollbar-hide">
        {hot.map((p, i) => {
          const img =
            getPollDisplayImageSrc({ imageUrl: p.image_a_url, option: p.option_a, question: p.question, side: 'A' }) ||
            getPollDisplayImageSrc({ imageUrl: p.image_b_url, option: p.option_b, question: p.question, side: 'B' });

          return (
            <motion.button
              key={p.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => navigate(`/poll/${p.id}`)}
              className="relative shrink-0 w-[132px] rounded-2xl overflow-hidden border border-border bg-card text-left shadow-sm active:scale-[0.98] transition"
            >
              <div className="relative h-[92px] bg-muted overflow-hidden">
                {img ? (
                  <img src={img} alt={p.question} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-primary/10" />
                )}
                <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-foreground shadow">
                  <Flame className="h-2.5 w-2.5" />
                  {p.recentVotes}
                </span>
              </div>
              <p className="px-2 py-1.5 text-[11px] font-semibold leading-snug text-foreground line-clamp-2">
                {p.question}
              </p>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
