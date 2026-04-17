import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { useLiveVoterCount } from '@/hooks/useLiveVoterCount';

/**
 * Compact strip rendered just below the hero vote card.
 * "X people voted in the last hour" — refreshes every 60s.
 */
export default function LiveVoterCount() {
  const { data: count = 0 } = useLiveVoterCount();
  if (count < 5) return null; // hide when feed is quiet to avoid awkward small numbers

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-center gap-1.5 mt-2"
    >
      <motion.span
        animate={{ scale: [1, 1.25, 1], opacity: [1, 0.5, 1] }}
        transition={{ duration: 1.6, repeat: Infinity }}
        className="h-1.5 w-1.5 rounded-full bg-destructive"
      />
      <Users className="h-3 w-3 text-muted-foreground" />
      <span className="text-[11px] text-muted-foreground">
        <span className="font-bold text-foreground tabular-nums">{count.toLocaleString()}</span>{' '}
        {count === 1 ? 'person' : 'people'} voted in the last hour
      </span>
    </motion.div>
  );
}
