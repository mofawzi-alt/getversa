import { motion } from 'framer-motion';
import { Swords } from 'lucide-react';

interface ControversialBadgeProps {
  percentA: number;
  percentB: number;
  totalVotes: number;
  /** Minimum total votes before showing the badge */
  minVotes?: number;
}

/** Shows a pulsing badge when a poll has a near 50/50 split */
export default function ControversialBadge({ percentA, percentB, totalVotes, minVotes = 10 }: ControversialBadgeProps) {
  const spread = Math.abs(percentA - percentB);
  const isControversial = totalVotes >= minVotes && spread <= 8;

  if (!isControversial) return null;

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="absolute top-3 right-3 z-20 flex items-center gap-1 px-2.5 py-1 rounded-full bg-destructive/90 shadow-lg"
    >
      <Swords className="w-3.5 h-3.5 text-white" />
      <span className="text-[10px] font-extrabold text-white tracking-wide uppercase">50/50</span>
    </motion.div>
  );
}
