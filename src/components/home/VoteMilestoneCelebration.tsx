import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

const VOTE_MILESTONES: { count: number; message: string }[] = [
  { count: 10, message: "Your voice is being heard 👀 10 votes in" },
  { count: 50, message: "You've voted 50 times 🔥 Your taste profile is taking shape" },
  { count: 100, message: "100 votes 💯 You're officially a Versa regular" },
  { count: 250, message: "Top voter 👑 250 votes — you're shaping what MENA thinks" },
];

const SEEN_KEY = 'versa_vote_milestones_seen';

function getSeenMilestones(): number[] {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch { return []; }
}

function markMilestoneSeen(count: number) {
  const seen = getSeenMilestones();
  if (!seen.includes(count)) {
    seen.push(count);
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  }
}

export function checkVoteMilestone(totalVotes: number): { count: number; message: string } | null {
  const seen = getSeenMilestones();
  for (const m of VOTE_MILESTONES) {
    if (totalVotes >= m.count && !seen.includes(m.count)) {
      return m;
    }
  }
  return null;
}

interface Props {
  milestone: { count: number; message: string };
  open: boolean;
  onClose: () => void;
}

export default function VoteMilestoneCelebration({ milestone, open, onClose }: Props) {
  useEffect(() => {
    if (open) {
      markMilestoneSeen(milestone.count);
      const timer = setTimeout(onClose, 2000);
      return () => clearTimeout(timer);
    }
  }, [open, milestone.count, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed top-16 left-0 right-0 z-[9999] mx-auto w-[calc(100vw-2rem)] max-w-sm px-4"
          onClick={onClose}
        >
          <div className="rounded-2xl bg-gradient-to-r from-primary/90 to-accent/90 backdrop-blur-md border border-primary/30 px-5 py-4 shadow-xl text-center">
            <p className="text-primary-foreground font-display font-bold text-sm leading-snug break-words">
              {milestone.message}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
