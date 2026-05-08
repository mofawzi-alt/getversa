import { useNavigate } from 'react-router-dom';
import { Trophy, Users, ArrowRight, TrendingUp, BarChart3, Target } from 'lucide-react';
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

/* ═══════════════════════════════════════════ */
/* DECIDE variant — punchy, emotional, fast   */
/* ═══════════════════════════════════════════ */
function DecideVerdictCard({ verdict }: { verdict: Verdict }) {
  const navigate = useNavigate();
  const winSideA = verdict.winner_side === 'A';
  const landslide = verdict.winner_pct >= 70;
  const closeFight = verdict.winner_pct <= 55;

  const badge = landslide ? '🔥 LANDSLIDE' : closeFight ? '⚡ CLOSE CALL' : '✅ CLEAR PICK';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, type: 'spring', damping: 14 }}
      className="rounded-2xl overflow-hidden bg-card border-2 border-primary/20 shadow-lg w-full min-w-0"
    >
      {/* Badge strip */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.15, type: 'spring' }}
        className="bg-primary/5 px-4 py-1.5 flex items-center justify-between"
      >
        <span className="text-[11px] font-black tracking-wide">{badge}</span>
        <span className="text-[10px] font-bold text-muted-foreground">{verdict.total_votes.toLocaleString()} votes</span>
      </motion.div>

      {/* Big verdict */}
      <div className="px-4 pt-3 pb-2">
        <motion.p
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', damping: 10, stiffness: 200 }}
          className="text-3xl font-display font-black leading-none break-words"
        >
          <span className="text-primary">{verdict.winner_label}</span>
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="text-sm font-bold text-foreground/60 mt-1"
        >
          {verdict.winner_pct}% of Egypt chose this
        </motion.p>
      </div>

      {/* Images with dramatic contrast */}
      <div className="grid grid-cols-2 aspect-[16/10] relative">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className={`relative ${winSideA ? 'ring-2 ring-inset ring-primary/40' : 'grayscale-[70%] opacity-50'} transition-all`}
        >
          <PollOptionImage imageUrl={verdict.image_a_url} option={verdict.option_a} question={verdict.question} side="A" variant="browse" loading="lazy" />
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2.5 pt-6">
            <p className="text-[11px] font-bold text-white truncate">{verdict.option_a}</p>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className={`relative ${!winSideA ? 'ring-2 ring-inset ring-primary/40' : 'grayscale-[70%] opacity-50'} transition-all`}
        >
          <PollOptionImage imageUrl={verdict.image_b_url} option={verdict.option_b} question={verdict.question} side="B" variant="browse" loading="lazy" />
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2.5 pt-6">
            <p className="text-[11px] font-bold text-white truncate">{verdict.option_b}</p>
          </div>
        </motion.div>

        {/* Big animated percentage pills */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-between px-3 pointer-events-none">
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, type: 'spring', damping: 10 }}
            className={`px-3 py-1.5 rounded-xl text-sm font-black shadow-xl ${winSideA ? 'bg-primary text-primary-foreground scale-110' : 'bg-white/80 text-foreground/50 text-xs'}`}
          >
            <AnimatedPct value={winSideA ? verdict.winner_pct : verdict.loser_pct} delay={0.6} />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.55, type: 'spring', damping: 10 }}
            className={`px-3 py-1.5 rounded-xl text-sm font-black shadow-xl ${!winSideA ? 'bg-primary text-primary-foreground scale-110' : 'bg-white/80 text-foreground/50 text-xs'}`}
          >
            <AnimatedPct value={!winSideA ? verdict.winner_pct : verdict.loser_pct} delay={0.65} />
          </motion.div>
        </div>

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <motion.div
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.4, type: 'spring' }}
            className="h-7 w-7 rounded-full bg-background border-2 border-primary/20 flex items-center justify-center shadow-lg"
          >
            <span className="text-[9px] font-black text-primary">VS</span>
          </motion.div>
        </div>
      </div>

      {/* Quick reason + CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="p-4 space-y-3"
      >
        {verdict.reason && (
          <p className="text-sm leading-snug text-foreground font-semibold">{verdict.reason}</p>
        )}
        {verdict.viewer_line && (
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.85, type: 'spring' }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/5 border border-primary/15"
          >
            <Users className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-xs text-foreground font-bold">{verdict.viewer_line}</span>
          </motion.div>
        )}
        <div className="space-y-2 pt-1">
          <button
            onClick={() => navigate(`/poll/${verdict.poll_id}`)}
            className="w-full h-11 rounded-full bg-primary text-primary-foreground text-sm font-black flex items-center justify-center gap-1.5 active:scale-[0.97] transition shadow-md"
          >
            Cast your vote
            <ArrowRight className="h-4 w-4" />
          </button>
          <ShareVerdictCard verdict={verdict} />
          <ShareToStoryButton
            storyType="poll_result"
            content={{
              poll_id: verdict.poll_id, question: verdict.question,
              option_a: verdict.option_a, option_b: verdict.option_b,
              pct_a: winSideA ? verdict.winner_pct : verdict.loser_pct,
              pct_b: winSideA ? verdict.loser_pct : verdict.winner_pct,
              total_votes: verdict.total_votes, winning_option: verdict.winner_label,
              winning_pct: verdict.winner_pct,
              image_a_url: verdict.image_a_url, image_b_url: verdict.image_b_url,
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

/* ═══════════════════════════════════════════════════ */
/* RESEARCH variant — structured, analytical, clean   */
/* ═══════════════════════════════════════════════════ */
function ResearchVerdictCard({ verdict }: { verdict: Verdict }) {
  const navigate = useNavigate();
  const winSideA = verdict.winner_side === 'A';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl overflow-hidden bg-card border border-border shadow-sm w-full min-w-0"
    >
      {/* Clean header */}
      <div className="px-4 pt-4 pb-3 border-b border-border/50">
        <div className="flex items-center gap-2 mb-2.5">
          <div className="h-6 w-6 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <BarChart3 className="h-3 w-3 text-blue-500" />
          </div>
          <span className="text-[10px] uppercase tracking-widest text-blue-500 font-bold">Public Sentiment Analysis</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{verdict.question}</p>
      </div>

      {/* Side-by-side comparison — clean bars */}
      <div className="p-4 space-y-3">
        <div className="space-y-2">
          {/* Option A */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[12px]">
              <span className={`font-semibold ${winSideA ? 'text-foreground' : 'text-muted-foreground'}`}>{verdict.option_a}</span>
              <span className={`font-bold tabular-nums ${winSideA ? 'text-blue-600' : 'text-muted-foreground'}`}>
                {winSideA ? verdict.winner_pct : verdict.loser_pct}%
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${winSideA ? verdict.winner_pct : verdict.loser_pct}%` }}
                transition={{ delay: 0.4, duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
                className={`h-full rounded-full ${winSideA ? 'bg-blue-500' : 'bg-muted-foreground/30'}`}
              />
            </div>
          </div>
          {/* Option B */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[12px]">
              <span className={`font-semibold ${!winSideA ? 'text-foreground' : 'text-muted-foreground'}`}>{verdict.option_b}</span>
              <span className={`font-bold tabular-nums ${!winSideA ? 'text-blue-600' : 'text-muted-foreground'}`}>
                {!winSideA ? verdict.winner_pct : verdict.loser_pct}%
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${!winSideA ? verdict.winner_pct : verdict.loser_pct}%` }}
                transition={{ delay: 0.5, duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
                className={`h-full rounded-full ${!winSideA ? 'bg-blue-500' : 'bg-muted-foreground/30'}`}
              />
            </div>
          </div>
        </div>

        {/* Sample size */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1">
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span className="font-semibold">n = {verdict.total_votes.toLocaleString()}</span>
          </div>
          {verdict.baseline_active && (
            <div className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Active — sample growing</span>
            </div>
          )}
        </div>
      </div>

      {/* Reason as finding */}
      {verdict.reason && (
        <div className="px-4 pb-3">
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
            <p className="text-[10px] uppercase tracking-wider font-bold text-blue-500 mb-1">Key Finding</p>
            <p className="text-[13px] text-foreground leading-relaxed">{verdict.reason}</p>
          </div>
        </div>
      )}

      {/* Viewer line */}
      {verdict.viewer_line && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted/50 border border-border/50">
            <Target className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground font-medium">{verdict.viewer_line}</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 pb-4 space-y-2">
        <button
          onClick={() => navigate(`/poll/${verdict.poll_id}`)}
          className="w-full h-10 rounded-full bg-foreground/90 text-background text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
        >
          Vote on this poll
          <ArrowRight className="h-4 w-4" />
        </button>
        <ShareVerdictCard verdict={verdict} />
      </div>
    </motion.div>
  );
}

export default function VerdictCard({ verdict, variant = 'decide' }: { verdict: Verdict; variant?: 'decide' | 'research' }) {
  if (variant === 'research') return <ResearchVerdictCard verdict={verdict} />;
  return <DecideVerdictCard verdict={verdict} />;
}
