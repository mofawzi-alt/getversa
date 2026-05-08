import { useNavigate } from 'react-router-dom';
import { Trophy, Users, ArrowRight, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import PollOptionImage from '@/components/poll/PollOptionImage';
import ShareVerdictCard from './ShareVerdictCard';
import ShareToStoryButton from '@/components/stories/ShareToStoryButton';

export interface Verdict {
  poll_id: string;
  question: string;
  option_a: string;
  option_b: string;
  image_a_url: string | null;
  image_b_url: string | null;
  winner_side: 'A' | 'B';
  winner_label: string;
  winner_pct: number;
  loser_pct: number;
  total_votes: number;
  real_votes?: number;
  baseline_active?: boolean;
  reason: string;
  viewer_line: string | null;
}

function AnimatedPct({ value, delay = 0 }: { value: number; delay?: number }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.4, type: 'spring', damping: 12 }}
      className="tabular-nums"
    >
      {value}%
    </motion.span>
  );
}

export default function VerdictCard({ verdict }: { verdict: Verdict }) {
  const navigate = useNavigate();
  const winSideA = verdict.winner_side === 'A';
  const landslide = verdict.winner_pct >= 70;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl overflow-hidden bg-card border border-border shadow-md w-full min-w-0"
    >
      {/* Header — verdict announcement */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/8 to-transparent" />
        <div className="relative p-4 pb-3">
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-1.5 mb-2"
          >
            <div className="h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center">
              <Trophy className="h-2.5 w-2.5 text-primary" />
            </div>
            <span className="text-[10px] uppercase tracking-widest text-primary font-bold">Egypt voted</span>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-2xl font-display font-black leading-tight break-words"
          >
            Pick <span className="text-primary">{verdict.winner_label}</span>
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center gap-2 mt-2"
          >
            <span className="text-sm font-bold text-foreground">{verdict.winner_pct}%</span>
            <span className="text-xs text-muted-foreground">of Egyptians agree</span>
            <span className="text-muted-foreground/40">·</span>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              <span>{verdict.total_votes.toLocaleString()} votes</span>
            </div>
            {landslide && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary/10 text-[9px] font-bold text-primary uppercase">
                <TrendingUp className="h-2.5 w-2.5" /> Landslide
              </span>
            )}
          </motion.div>
        </div>
      </div>

      {/* Images — larger with overlay stats */}
      <div className="grid grid-cols-2 aspect-[16/10] relative">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className={`relative ${winSideA ? '' : 'grayscale-[60%] opacity-60'} transition-all`}
        >
          <PollOptionImage
            imageUrl={verdict.image_a_url}
            option={verdict.option_a}
            question={verdict.question}
            side="A"
            variant="browse"
            loading="lazy"
          />
          {/* Option label overlay */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2.5 pt-6">
            <p className="text-[11px] font-bold text-white truncate">{verdict.option_a}</p>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
          className={`relative ${!winSideA ? '' : 'grayscale-[60%] opacity-60'} transition-all`}
        >
          <PollOptionImage
            imageUrl={verdict.image_b_url}
            option={verdict.option_b}
            question={verdict.question}
            side="B"
            variant="browse"
            loading="lazy"
          />
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2.5 pt-6">
            <p className="text-[11px] font-bold text-white truncate">{verdict.option_b}</p>
          </div>
        </motion.div>

        {/* Animated percentage pills */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-between px-3 pointer-events-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, type: 'spring', damping: 12 }}
            className={`px-2.5 py-1 rounded-lg text-xs font-extrabold shadow-lg ${winSideA ? 'bg-primary text-primary-foreground' : 'bg-white/90 text-foreground/70'}`}
          >
            <AnimatedPct value={winSideA ? verdict.winner_pct : verdict.loser_pct} delay={0.7} />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.65, type: 'spring', damping: 12 }}
            className={`px-2.5 py-1 rounded-lg text-xs font-extrabold shadow-lg ${!winSideA ? 'bg-primary text-primary-foreground' : 'bg-white/90 text-foreground/70'}`}
          >
            <AnimatedPct value={!winSideA ? verdict.winner_pct : verdict.loser_pct} delay={0.75} />
          </motion.div>
        </div>

        {/* VS divider */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5, type: 'spring' }}
            className="h-7 w-7 rounded-full bg-background border-2 border-border flex items-center justify-center shadow-md"
          >
            <span className="text-[9px] font-black text-muted-foreground">VS</span>
          </motion.div>
        </div>
      </div>

      {/* Reason + viewer line + actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="p-4 space-y-3"
      >
        {verdict.reason && (
          <p className="text-sm leading-relaxed text-foreground">{verdict.reason}</p>
        )}
        {verdict.viewer_line && (
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/5 border border-primary/10">
            <Users className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-xs text-foreground font-medium">{verdict.viewer_line}</span>
          </div>
        )}
        {verdict.baseline_active && (
          <p className="text-[10px] text-muted-foreground/70 italic flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live — growing daily
          </p>
        )}
        <div className="space-y-2 pt-1">
          <button
            onClick={() => navigate(`/poll/${verdict.poll_id}`)}
            className="w-full h-11 rounded-full bg-foreground text-background text-sm font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition shadow-sm"
          >
            Cast your vote
            <ArrowRight className="h-4 w-4" />
          </button>
          <ShareVerdictCard verdict={verdict} />
          <ShareToStoryButton
            storyType="poll_result"
            content={{
              poll_id: verdict.poll_id,
              question: verdict.question,
              option_a: verdict.option_a,
              option_b: verdict.option_b,
              pct_a: winSideA ? verdict.winner_pct : verdict.loser_pct,
              pct_b: winSideA ? verdict.loser_pct : verdict.winner_pct,
              total_votes: verdict.total_votes,
              winning_option: verdict.winner_label,
              winning_pct: verdict.winner_pct,
              image_a_url: verdict.image_a_url,
              image_b_url: verdict.image_b_url,
            }}
            imageUrl={winSideA ? verdict.image_a_url : verdict.image_b_url}
            variant="compact"
            className="w-full justify-center"
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
