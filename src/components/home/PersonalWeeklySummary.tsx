import { useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Share2, Trophy, Target, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

export default function PersonalWeeklySummary() {
  const { user, profile } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { start, end } = getWeekRange();

  const { data: summary } = useQuery({
    queryKey: ['personal-weekly-summary', user?.id, start.toISOString()],
    queryFn: async () => {
      if (!user) return null;

      // Get user's votes this week
      const { data: myVotes } = await supabase
        .from('votes')
        .select('poll_id, choice')
        .eq('user_id', user.id)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (!myVotes || myVotes.length === 0) return null;

      const pollIds = myVotes.map(v => v.poll_id);
      const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: pollIds });
      const { data: polls } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b')
        .in('id', pollIds);

      const resultsMap = new Map(results?.map((r: any) => [r.poll_id, r]) || []);
      const pollsMap = new Map(polls?.map(p => [p.id, p]) || []);

      let majority = 0;
      let minority = 0;
      let biggestUpset: { question: string; winnerPct: number } | null = null;

      myVotes.forEach(v => {
        const r = resultsMap.get(v.poll_id) as any;
        const p = pollsMap.get(v.poll_id);
        if (!r || !p) return;

        const myPct = v.choice === 'A' ? r.percent_a : r.percent_b;
        if (myPct > 50) majority++;
        else if (myPct < 50) minority++;

        // Track most surprising = when user was most in the minority
        if (myPct < 50) {
          const loserPct = myPct;
          if (!biggestUpset || loserPct < (100 - biggestUpset.winnerPct)) {
            biggestUpset = { question: p.question, winnerPct: 100 - loserPct };
          }
        }
      });

      return {
        totalVoted: myVotes.length,
        majority,
        minority,
        biggestUpset,
      };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
  });

  const generateImage = useCallback(async (): Promise<Blob | null> => {
    if (!summary || !canvasRef.current) return null;
    const canvas = canvasRef.current;
    const W = 1080, H = 1920;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0a0a0a');
    grad.addColorStop(0.5, '#111');
    grad.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    for (let y = 0; y < H; y += 60) {
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(0, y, W, 1);
    }

    let y = 300;
    ctx.font = 'bold 40px system-ui';
    ctx.fillStyle = '#f59e0b';
    ctx.textAlign = 'center';
    ctx.fillText('YOUR WEEK ON VERSA', W / 2, y);
    y += 80;

    ctx.font = 'bold 160px system-ui';
    ctx.fillStyle = '#fff';
    ctx.fillText(`${summary.totalVoted}`, W / 2, y + 60);
    y += 100;
    ctx.font = '36px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('polls voted', W / 2, y);
    y += 100;

    ctx.font = 'bold 48px system-ui';
    ctx.fillStyle = '#22c55e';
    ctx.fillText(`${summary.majority} majority`, W / 2, y);
    y += 60;
    ctx.fillStyle = '#f59e0b';
    ctx.fillText(`${summary.minority} minority`, W / 2, y);
    y += 100;

    if (summary.biggestUpset) {
      ctx.font = 'bold 32px system-ui';
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillText('Most Surprising', W / 2, y);
      y += 50;
      ctx.font = '28px system-ui';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      const q = summary.biggestUpset.question;
      ctx.fillText(q.length > 40 ? q.slice(0, 40) + '…' : q, W / 2, y);
    }

    ctx.font = 'bold 48px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('VERSA', W / 2, H - 80);
    ctx.font = '24px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillText('Your Weekly Summary', W / 2, H - 40);

    return new Promise(r => canvas.toBlob(r, 'image/png'));
  }, [summary]);

  const handleShare = useCallback(async () => {
    try {
      const blob = await generateImage();
      if (!blob) { toast.error('Failed to generate'); return; }
      const file = new File([blob], 'versa-weekly-summary.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'My Week on Versa', files: [file] });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'versa-weekly-summary.png'; a.click();
        URL.revokeObjectURL(url);
        toast.success('Image downloaded!');
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') toast.error('Failed to share');
    }
  }, [generateImage]);

  if (!user || !summary || summary.totalVoted === 0) return null;

  return (
    <>
      <canvas ref={canvasRef} className="hidden" />
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl bg-card border border-border/60 px-3 py-2.5 flex items-center gap-3"
      >
        <div className="flex items-center gap-1.5 shrink-0">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-xs font-display font-bold text-primary">Week</span>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground flex-1 min-w-0">
          <span>📊 <span className="font-bold text-foreground">{summary.totalVoted}</span> voted</span>
          <span className="text-muted-foreground/30">·</span>
          <span>✅ <span className="font-bold text-foreground">{summary.majority}</span></span>
          <span className="text-muted-foreground/30">·</span>
          <span>🎯 <span className="font-bold text-foreground">{summary.minority}</span></span>
          {summary.biggestUpset && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <span className="truncate">🤯 {summary.biggestUpset.question.length > 20 ? summary.biggestUpset.question.slice(0, 20) + '…' : summary.biggestUpset.question}</span>
            </>
          )}
        </div>

        <button onClick={handleShare} className="p-1.5 rounded-full hover:bg-muted/50 text-muted-foreground shrink-0">
          <Share2 className="h-3.5 w-3.5" />
        </button>
      </motion.div>
    </>
  );
}
