import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, TrendingUp, TrendingDown, Minus, Download, Loader2, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

function getMonthRange(offset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function formatMonth(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

interface BrandStats {
  name: string;
  category: string;
  totalVotes: number;
  wins: number;
  losses: number;
  winRate: number;
  avgPct: number;
}

export default function MonthlyLeaderboard() {
  const [monthOffset, setMonthOffset] = useState(0);
  const { start: curStart, end: curEnd } = getMonthRange(monthOffset);
  const { start: prevStart, end: prevEnd } = getMonthRange(monthOffset - 1);

  const fetchMonthData = async (startDate: Date, endDate: Date) => {
    const { data: votes } = await supabase
      .from('votes')
      .select('poll_id, choice')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (!votes || votes.length === 0) return { pollStats: new Map(), brandStats: new Map<string, BrandStats>() };

    const pollMap = new Map<string, { votesA: number; votesB: number; total: number }>();
    votes.forEach(v => {
      const e = pollMap.get(v.poll_id) || { votesA: 0, votesB: 0, total: 0 };
      if (v.choice === 'A') e.votesA++; else e.votesB++;
      e.total++;
      pollMap.set(v.poll_id, e);
    });

    const pollIds = Array.from(pollMap.keys());
    const { data: polls } = await supabase
      .from('polls')
      .select('id, question, option_a, option_b, category')
      .in('id', pollIds);

    const brandStats = new Map<string, BrandStats>();
    const addBrand = (name: string, cat: string, votes: number, pct: number, won: boolean) => {
      const key = name.toLowerCase();
      const existing = brandStats.get(key) || { name, category: cat, totalVotes: 0, wins: 0, losses: 0, winRate: 0, avgPct: 0 };
      existing.totalVotes += votes;
      if (won) existing.wins++; else existing.losses++;
      existing.category = cat || existing.category;
      brandStats.set(key, existing);
    };

    polls?.forEach(p => {
      const stats = pollMap.get(p.id);
      if (!stats) return;
      const pctA = stats.total > 0 ? Math.round((stats.votesA / stats.total) * 100) : 50;
      const pctB = 100 - pctA;
      const cat = p.category || 'Other';
      addBrand(p.option_a, cat, stats.votesA, pctA, pctA >= pctB);
      addBrand(p.option_b, cat, stats.votesB, pctB, pctB > pctA);
    });

    brandStats.forEach((b, k) => {
      b.winRate = (b.wins + b.losses) > 0 ? Math.round((b.wins / (b.wins + b.losses)) * 100) : 0;
      b.avgPct = b.totalVotes > 0 ? Math.round(b.totalVotes / (b.wins + b.losses)) : 0;
    });

    return {
      pollStats: pollMap,
      brandStats,
      polls: polls || [],
    };
  };

  const { data: currentMonth, isLoading } = useQuery({
    queryKey: ['monthly-leaderboard', curStart.toISOString()],
    queryFn: () => fetchMonthData(curStart, curEnd),
    staleTime: 1000 * 60 * 10,
  });

  const { data: prevMonth } = useQuery({
    queryKey: ['monthly-leaderboard', prevStart.toISOString()],
    queryFn: () => fetchMonthData(prevStart, prevEnd),
    staleTime: 1000 * 60 * 10,
  });

  const analysis = useMemo(() => {
    if (!currentMonth?.brandStats) return null;

    const brands = Array.from(currentMonth.brandStats.values());
    const topByVotes = [...brands].sort((a, b) => b.totalVotes - a.totalVotes).slice(0, 10);

    // Top brand per category
    const categoryTop = new Map<string, BrandStats>();
    brands.forEach(b => {
      const existing = categoryTop.get(b.category);
      if (!existing || b.winRate > existing.winRate || (b.winRate === existing.winRate && b.totalVotes > existing.totalVotes)) {
        categoryTop.set(b.category, b);
      }
    });

    // Preference shifts vs previous month
    const shifts: { name: string; change: number; direction: 'up' | 'down' | 'stable' }[] = [];
    if (prevMonth?.brandStats) {
      brands.forEach(b => {
        const prev = prevMonth.brandStats.get(b.name.toLowerCase());
        if (prev && (prev.wins + prev.losses) >= 2) {
          const change = b.winRate - prev.winRate;
          if (Math.abs(change) >= 3) {
            shifts.push({ name: b.name, change, direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable' });
          }
        }
      });
      shifts.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
    }

    // Top 10 polls by votes
    const topPolls = currentMonth.polls
      ? [...currentMonth.polls]
          .map(p => {
            const s = currentMonth.pollStats.get(p.id);
            return { ...p, total: s?.total || 0, pctA: s && s.total > 0 ? Math.round((s.votesA / s.total) * 100) : 50 };
          })
          .sort((a, b) => b.total - a.total)
          .slice(0, 10)
      : [];

    return { topByVotes, categoryTop: Array.from(categoryTop.entries()), shifts, topPolls };
  }, [currentMonth, prevMonth]);

  const exportPDF = () => {
    if (!analysis) return;
    const doc = new jsPDF('p', 'mm', 'a4');
    const W = doc.internal.pageSize.getWidth();
    let y = 20;

    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('Versa Monthly Leaderboard', W / 2, y, { align: 'center' });
    y += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    doc.text(formatMonth(curStart), W / 2, y, { align: 'center' });
    y += 15;

    // Top polls
    doc.setTextColor(0);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Top 10 Polls by Votes', 15, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    analysis.topPolls.forEach((p, i) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(`${i + 1}. ${p.question} — ${p.total} votes (${p.option_a} ${p.pctA}% vs ${p.option_b} ${100 - p.pctA}%)`, 15, y, { maxWidth: W - 30 });
      y += 7;
    });
    y += 10;

    // Top brand per category
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Top Brand per Category', 15, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    analysis.categoryTop.forEach(([cat, brand]) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(`${cat}: ${brand.name} — ${brand.winRate}% win rate (${brand.totalVotes} votes)`, 15, y);
      y += 7;
    });
    y += 10;

    // Shifts
    if (analysis.shifts.length > 0) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Preference Shifts vs Last Month', 15, y);
      y += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      analysis.shifts.slice(0, 15).forEach(s => {
        if (y > 270) { doc.addPage(); y = 20; }
        const arrow = s.direction === 'up' ? '↑' : s.direction === 'down' ? '↓' : '→';
        doc.text(`${arrow} ${s.name}: ${s.change > 0 ? '+' : ''}${s.change}% win rate`, 15, y);
        y += 7;
      });
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(160);
    doc.text(`Generated by Versa — ${new Date().toLocaleDateString()}`, W / 2, 285, { align: 'center' });

    doc.save(`versa-monthly-leaderboard-${formatMonth(curStart).replace(' ', '-')}.pdf`);
    toast.success('PDF exported!');
  };

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" /> Monthly Leaderboard
          </h2>
          <p className="text-sm text-muted-foreground">B2B performance report</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setMonthOffset(o => o - 1)}>← Prev</Button>
          <span className="text-sm font-medium">{formatMonth(curStart)}</span>
          <Button variant="outline" size="sm" onClick={() => setMonthOffset(o => Math.min(o + 1, 0))} disabled={monthOffset >= 0}>Next →</Button>
        </div>
      </div>

      <Button onClick={exportPDF} className="gap-2" disabled={!analysis}>
        <Download className="h-4 w-4" /> Export PDF Report
      </Button>

      {!analysis || analysis.topPolls.length === 0 ? (
        <p className="text-center text-muted-foreground py-10">No data for this month.</p>
      ) : (
        <>
          {/* Top 10 Polls */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Trophy className="h-4 w-4 text-amber-500" /> Top 10 Polls</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {analysis.topPolls.map((p, i) => (
                <div key={p.id} className="flex items-start gap-3 text-sm">
                  <span className="text-lg font-bold text-muted-foreground/40 w-6 text-right shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium leading-tight">{p.question}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span>{p.total} votes</span>
                      <span>•</span>
                      <span className={p.pctA >= 50 ? 'text-primary font-medium' : ''}>{p.option_a} {p.pctA}%</span>
                      <span>vs</span>
                      <span className={p.pctA < 50 ? 'text-accent font-medium' : ''}>{p.option_b} {100 - p.pctA}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Top Brand per Category */}
          <Card>
            <CardHeader><CardTitle className="text-base">🏆 Top Brand per Category</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {analysis.categoryTop.map(([cat, brand]) => (
                <div key={cat} className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/30">
                  <div>
                    <span className="text-xs text-muted-foreground">{cat}</span>
                    <p className="font-semibold">{brand.name}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-primary font-bold">{brand.winRate}%</span>
                    <p className="text-xs text-muted-foreground">{brand.totalVotes} votes</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Preference Shifts */}
          {analysis.shifts.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">📊 Preference Shifts vs Last Month</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {analysis.shifts.slice(0, 15).map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      {s.direction === 'up' ? <TrendingUp className="h-4 w-4 text-green-500" /> :
                       s.direction === 'down' ? <TrendingDown className="h-4 w-4 text-red-500" /> :
                       <Minus className="h-4 w-4 text-muted-foreground" />}
                      <span className="font-medium">{s.name}</span>
                    </div>
                    <span className={`font-bold ${s.direction === 'up' ? 'text-green-500' : s.direction === 'down' ? 'text-red-500' : 'text-muted-foreground'}`}>
                      {s.change > 0 ? '+' : ''}{s.change}%
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
