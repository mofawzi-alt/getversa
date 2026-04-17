import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Flame } from 'lucide-react';
import CountdownTimer from '@/components/poll/CountdownTimer';
import PollOptionImage from '@/components/poll/PollOptionImage';

interface ClosingSoonPoll {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  image_a_url: string | null;
  image_b_url: string | null;
  ends_at: string;
  totalVotes: number;
}

interface ClosingSoonStripProps {
  polls: ClosingSoonPoll[];
}

/**
 * Horizontal scroll on home — polls expiring in <6h, ordered by soonest expiry.
 * Renders nothing when there are no qualifying polls.
 */
export default function ClosingSoonStrip({ polls }: ClosingSoonStripProps) {
  const navigate = useNavigate();
  if (polls.length === 0) return null;

  return (
    <section className="mb-3">
      <div className="px-3 flex items-center gap-2 mb-2">
        <Flame className="h-3.5 w-3.5 text-destructive fill-destructive/30" />
        <span className="text-xs font-display font-bold text-foreground uppercase tracking-wider">
          Closing Soon
        </span>
        <span className="text-[10px] text-muted-foreground">
          · {polls.length} {polls.length === 1 ? 'poll' : 'polls'}
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto px-3 scrollbar-hide pb-2">
        {polls.map((poll, i) => (
          <motion.button
            key={poll.id}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.04, 0.2) }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate(`/browse?filter=live&pollId=${poll.id}`)}
            className="shrink-0 w-[180px] rounded-2xl overflow-hidden border border-destructive/30 bg-card shadow-sm text-left"
          >
            <div className="relative" style={{ aspectRatio: '4/5' }}>
              <div className="absolute inset-0 flex">
                <div className="w-1/2 h-full relative overflow-hidden">
                  <PollOptionImage
                    imageUrl={poll.image_a_url}
                    option={poll.option_a}
                    question={poll.question}
                    side="A"
                    maxLogoSize="55%"
                    loading="lazy"
                  />
                </div>
                <div className="w-1/2 h-full relative overflow-hidden">
                  <PollOptionImage
                    imageUrl={poll.image_b_url}
                    option={poll.option_b}
                    question={poll.question}
                    side="B"
                    maxLogoSize="55%"
                    loading="lazy"
                  />
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute top-2 left-2">
                <CountdownTimer endsAt={poll.ends_at} size="xs" />
              </div>
              <div className="absolute bottom-2 left-2 right-2">
                <p className="text-xs font-bold text-white leading-snug line-clamp-2 drop-shadow-md">
                  {poll.question}
                </p>
                <p className="text-[10px] text-white/70 mt-0.5">
                  {poll.totalVotes.toLocaleString()} votes
                </p>
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </section>
  );
}
