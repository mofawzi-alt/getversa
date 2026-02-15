import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

interface VoteProgressIndicatorProps {
  voteCount: number;
  target?: number;
}

export default function VoteProgressIndicator({ voteCount, target = 5 }: VoteProgressIndicatorProps) {
  const progress = Math.min(voteCount / target, 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-3 mt-1 mb-1 flex items-center gap-2.5 px-3 py-2 rounded-xl bg-primary/5 border border-primary/15"
    >
      <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold text-foreground">
            {voteCount}/{target} votes to unlock Explore Mode
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="h-full rounded-full bg-gradient-primary"
          />
        </div>
      </div>
    </motion.div>
  );
}
