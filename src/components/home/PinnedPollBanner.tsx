import { motion } from 'framer-motion';
import { Pin, X, Users, Radio } from 'lucide-react';
import { usePinnedPoll } from '@/hooks/usePinnedPoll';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

function AnimatedNum({ value }: { value: number }) {
  return <span>{value.toLocaleString()}</span>;
}

export default function PinnedPollBanner() {
  const { pinnedPollData, genderSplit, isAdminFeatured, isPinned, unpinPoll } = usePinnedPoll();
  const navigate = useNavigate();

  if (!isPinned || !pinnedPollData) return null;

  const poll = pinnedPollData;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="mx-3 mb-2 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-accent/5 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
        <div className="flex items-center gap-1.5">
          {isAdminFeatured ? (
            <span className="text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/15 px-2 py-0.5 rounded-full">
              ⭐ Featured Debate
            </span>
          ) : (
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Pin className="h-3 w-3" /> Pinned
            </span>
          )}
          {/* LIVE badge */}
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="flex items-center gap-1 bg-destructive/15 text-destructive px-1.5 py-0.5 rounded-full"
          >
            <Radio className="h-2.5 w-2.5" />
            <span className="text-[8px] font-bold uppercase">Live</span>
          </motion.div>
        </div>
        {!isAdminFeatured && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              unpinPoll.mutate(undefined, { onSuccess: () => toast.success('Unpinned') });
            }}
            className="p-1 rounded-full hover:bg-muted/50 text-muted-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Content */}
      <div
        className="px-3 pb-3 cursor-pointer"
        onClick={() => navigate(`/live-debate?pollId=${poll.id}`)}
      >
        <p className="text-sm font-display font-bold text-foreground leading-tight mb-2">
          {poll.question}
        </p>

        {/* Percentage bars */}
        <div className="space-y-1.5 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-foreground w-8 text-right">{poll.percentA}%</span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-option-a rounded-full"
                initial={{ width: '50%' }}
                animate={{ width: `${poll.percentA}%` }}
                transition={{ duration: 0.7 }}
              />
            </div>
            <span className="text-[10px] font-medium text-muted-foreground truncate max-w-[80px]">{poll.option_a}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-foreground w-8 text-right">{poll.percentB}%</span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-option-b rounded-full"
                initial={{ width: '50%' }}
                animate={{ width: `${poll.percentB}%` }}
                transition={{ duration: 0.7 }}
              />
            </div>
            <span className="text-[10px] font-medium text-muted-foreground truncate max-w-[80px]">{poll.option_b}</span>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Users className="h-3 w-3" />
            <AnimatedNum value={poll.totalVotes} /> votes
          </span>
          {genderSplit && (
            <span className="text-[10px] text-muted-foreground">
              👨 {genderSplit.maleA}% A · 👩 {genderSplit.femaleA}% A
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
