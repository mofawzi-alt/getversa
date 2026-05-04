import { useMemo, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { ArrowLeft, Share2, Trophy, Zap, AlertTriangle, Flame } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diffToSunday = day; // Sunday = 0, so diff is just the day number
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - diffToSunday);
  sunday.setHours(0, 0, 0, 0);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  saturday.setHours(23, 59, 59, 999);
  return { start: sunday, end: saturday };
}

function formatDate(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface WeeklyPoll {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  image_a_url: string | null;
  image_b_url: string | null;
  category: string | null;
  totalVotes: number;
  percentA: number;
  percentB: number;
  winner: string;
  winnerPct: number;
  spread: number;
}

function ShareableResultCard({ poll, rank, badge }: { poll: WeeklyPoll; rank?: number; badge?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generateImage = useCallback(async (): Promise<Blob | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const W = 1080, H = 1920;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0a0a0a');
    grad.addColorStop(0.5, '#111');
    grad.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let y = 0; y < H; y += 60) { ctx.fillRect(0, y, W, 1); }

    let y = 200;
    if (badge) {
      ctx.font = 'bold 36px system-ui';
      ctx.fillStyle = '#f59e0b';
      ctx.textAlign = 'center';
      ctx.fillText(badge, W / 2, y);
      y += 60;
    }
    if (rank) {
      ctx.font = 'bold 120px system-ui';
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillText(`#${rank}`, W / 2, y + 80);
      y += 120;
    }

    ctx.font = 'bold 52px system-ui';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    const words = poll.question.split(' ');
    let lines: string[] = [];
    let line = '';
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (ctx.measureText(t).width > W - 160) { lines.push(line); line = w; } else { line = t; }
    }
    if (line) lines.push(line);
    for (const l of lines) { ctx.fillText(l, W / 2, y); y += 66; }

    y += 40;
    ctx.font = 'bold 72px system-ui';
    ctx.fillStyle = poll.percentA >= poll.percentB ? '#22c55e' : '#f59e0b';
    ctx.fillText(poll.option_a, W / 2, y);
    y += 50;
    ctx.font = 'bold 96px system-ui';
    ctx.fillText(`${poll.percentA}%`, W / 2, y);
    y += 60;
    ctx.font = '36px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('vs', W / 2, y);
    y += 60;
    ctx.font = 'bold 72px system-ui';
    ctx.fillStyle = poll.percentB > poll.percentA ? '#22c55e' : '#f59e0b';
    ctx.fillText(poll.option_b, W / 2, y);
    y += 50;
    ctx.font = 'bold 96px system-ui';
    ctx.fillText(`${poll.percentB}%`, W / 2, y);
    y += 80;

    ctx.font = '32px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText(`${poll.totalVotes.toLocaleString()} votes`, W / 2, y);

    ctx.font = 'bold 48px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('VERSA', W / 2, H - 80);
    ctx.font = '24px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillText('This Week on Versa', W / 2, H - 40);

    return new Promise(r => canvas.toBlob(r, 'image/png'));
  }, [poll, rank, badge]);

  const handleShare = useCallback(async () => {
    try {
      const blob = await generateImage();
      if (!blob) { toast.error('Failed to generate image'); return; }
      const file = new File([blob], 'versa-weekly.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'This Week on Versa', text: `📊 ${poll.question}`, files: [file] });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'versa-weekly.png'; a.click();
        URL.revokeObjectURL(url);
        toast.success('Image downloaded!');
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') toast.error('Failed to share');
    }
  }, [generateImage, poll.question]);

  return (
    <>
      <canvas ref={canvasRef} className="hidden" />
      <button onClick={handleShare} className="p-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
        <Share2 className="h-4 w-4" />
      </button>
    </>
  );
}

export default function WeeklyTopResults() {
  const navigate = useNavigate();
  const { start, end } = getWeekRange();

  const { data: weeklyPolls, isLoading } = useQuery({
    queryKey: ['weekly-top-results', start.toISOString()],
    queryFn: async () => {
      // Get all votes from this week
      const { data: weekVotes } = await supabase
        .from('votes')
        .select('poll_id, choice')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (!weekVotes || weekVotes.length === 0) return [];

      // Aggregate votes per poll
      const pollMap = new Map<string, { votesA: number; votesB: number; total: number }>();
      weekVotes.forEach(v => {
        const entry = pollMap.get(v.poll_id) || { votesA: 0, votesB: 0, total: 0 };
        if (v.choice === 'A') entry.votesA++;
        else entry.votesB++;
        entry.total++;
        pollMap.set(v.poll_id, entry);
      });

      const pollIds = Array.from(pollMap.keys());
      const { data: polls } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, image_a_url, image_b_url, category')
        .in('id', pollIds);

      if (!polls) return [];

      return polls.map(p => {
        const stats = pollMap.get(p.id)!;
        const pctA = stats.total > 0 ? Math.round((stats.votesA / stats.total) * 100) : 50;
        const pctB = 100 - pctA;
        const winner = pctA >= pctB ? p.option_a : p.option_b;
        const winnerPct = Math.max(pctA, pctB);
        return {
          ...p,
          totalVotes: stats.total,
          percentA: pctA,
          percentB: pctB,
          winner,
          winnerPct,
          spread: Math.abs(pctA - pctB),
        } as WeeklyPoll;
      });
    },
    staleTime: 1000 * 60 * 10,
  });

  const sorted = useMemo(() => {
    if (!weeklyPolls) return { top10: [], mostDebated: null, biggestUpset: null };
    const byVotes = [...weeklyPolls].sort((a, b) => b.totalVotes - a.totalVotes);
    const top10 = byVotes.slice(0, 10);
    // Most debated = closest split (smallest spread, min 10 votes)
    const debatable = weeklyPolls.filter(p => p.totalVotes >= 10);
    const mostDebated = debatable.length > 0
      ? debatable.reduce((a, b) => a.spread < b.spread ? a : b)
      : null;
    // Biggest upset = highest win percentage where loser was expected to win (largest spread where winner has >70%)
    const upsets = weeklyPolls.filter(p => p.totalVotes >= 10 && p.winnerPct >= 65);
    const biggestUpset = upsets.length > 0
      ? upsets.reduce((a, b) => a.winnerPct > b.winnerPct ? a : b)
      : null;
    return { top10, mostDebated, biggestUpset };
  }, [weeklyPolls]);

  return (
    <AppLayout>
      <div className="min-h-screen pb-24 animate-slide-up">
        <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/50 px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-primary/10 text-primary">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-display font-bold">This Week on Versa</h1>
            <p className="text-xs text-muted-foreground">{formatDate(start)} — {formatDate(end)}</p>
          </div>
        </header>

        <div className="p-4 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : !weeklyPolls || weeklyPolls.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <p>No polls voted on this week yet.</p>
            </div>
          ) : (
            <>
              {/* Most Debated */}
              {sorted.mostDebated && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-amber-500" />
                      <span className="text-sm font-bold text-amber-500">Most Debated</span>
                    </div>
                    <ShareableResultCard poll={sorted.mostDebated} badge="⚡ Most Debated This Week" />
                  </div>
                  <p className="font-semibold text-sm mb-2">{sorted.mostDebated.question}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{sorted.mostDebated.option_a} {sorted.mostDebated.percentA}%</span>
                    <span>vs</span>
                    <span>{sorted.mostDebated.option_b} {sorted.mostDebated.percentB}%</span>
                    <span className="ml-auto">{sorted.mostDebated.totalVotes} votes</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden flex">
                    <div className="bg-primary h-full transition-all" style={{ width: `${sorted.mostDebated.percentA}%` }} />
                    <div className="bg-accent h-full transition-all" style={{ width: `${sorted.mostDebated.percentB}%` }} />
                  </div>
                </motion.div>
              )}

              {/* Biggest Upset */}
              {sorted.biggestUpset && sorted.biggestUpset.id !== sorted.mostDebated?.id && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl bg-gradient-to-br from-red-500/10 to-pink-500/10 border border-red-500/20 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      <span className="text-sm font-bold text-red-500">Biggest Upset</span>
                    </div>
                    <ShareableResultCard poll={sorted.biggestUpset} badge="🔥 Biggest Upset This Week" />
                  </div>
                  <p className="font-semibold text-sm mb-2">{sorted.biggestUpset.question}</p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-primary">{sorted.biggestUpset.winner} won with {sorted.biggestUpset.winnerPct}%</span>
                    <span className="ml-auto text-muted-foreground">{sorted.biggestUpset.totalVotes} votes</span>
                  </div>
                </motion.div>
              )}

              {/* Top 10 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="h-5 w-5 text-primary" />
                  <h2 className="font-display font-bold">Top 10 Most Voted</h2>
                </div>
                <div className="space-y-3">
                  {sorted.top10.map((poll, i) => (
                    <motion.div
                      key={poll.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="rounded-xl bg-card border border-border/50 p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <span className="text-2xl font-bold text-muted-foreground/30 font-display shrink-0">
                            {i + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm leading-tight mb-2">{poll.question}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                              {poll.category && (
                                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px]">{poll.category}</span>
                              )}
                              <span>{poll.totalVotes} votes</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className={poll.percentA >= poll.percentB ? 'font-bold text-primary' : 'text-muted-foreground'}>
                                {poll.option_a} {poll.percentA}%
                              </span>
                              <span className="text-muted-foreground">vs</span>
                              <span className={poll.percentB > poll.percentA ? 'font-bold text-accent' : 'text-muted-foreground'}>
                                {poll.option_b} {poll.percentB}%
                              </span>
                            </div>
                            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden flex">
                              <div className="bg-primary h-full" style={{ width: `${poll.percentA}%` }} />
                              <div className="bg-accent h-full" style={{ width: `${poll.percentB}%` }} />
                            </div>
                          </div>
                        </div>
                        <ShareableResultCard poll={poll} rank={i + 1} />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
