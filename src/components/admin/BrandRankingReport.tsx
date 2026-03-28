import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, Trophy, Medal, Download } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface OptionStat {
  name: string;
  totalVotes: number;
  wins: number;
  losses: number;
  matchups: number;
  winRate: number;
  imageUrl: string | null;
}

export default function BrandRankingReport() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const { data: categories } = useQuery({
    queryKey: ['ranking-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('polls')
        .select('category')
        .not('category', 'is', null)
        .eq('is_active', true);
      if (error) throw error;
      const unique = [...new Set(data?.map(p => p.category).filter(Boolean) as string[])];
      return unique.sort();
    },
  });

  const { data: rankings, isLoading } = useQuery({
    queryKey: ['option-rankings', selectedCategory],
    queryFn: async () => {
      let query = supabase
        .from('polls')
        .select('id, option_a, option_b, image_a_url, image_b_url, question')
        .eq('is_active', true);

      if (selectedCategory !== 'all') {
        query = query.eq('category', selectedCategory);
      }

      const { data: polls, error } = await query.limit(500);
      if (error) throw error;
      if (!polls || polls.length === 0) return [];

      const pollIds = polls.map(p => p.id);
      const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: pollIds });
      const resultsMap = new Map(results?.map((r: any) => [r.poll_id, r]) || []);

      const optionMap = new Map<string, OptionStat>();

      const ensure = (name: string, img: string | null) => {
        if (!optionMap.has(name)) {
          optionMap.set(name, { name, totalVotes: 0, wins: 0, losses: 0, matchups: 0, winRate: 0, imageUrl: img });
        }
      };

      for (const poll of polls) {
        ensure(poll.option_a, poll.image_a_url);
        ensure(poll.option_b, poll.image_b_url);

        const r = resultsMap.get(poll.id) as any;
        if (!r || r.total_votes === 0) continue;

        const a = optionMap.get(poll.option_a)!;
        const b = optionMap.get(poll.option_b)!;

        a.totalVotes += r.votes_a;
        b.totalVotes += r.votes_b;
        a.matchups++;
        b.matchups++;

        if (r.votes_a > r.votes_b) { a.wins++; b.losses++; }
        else if (r.votes_b > r.votes_a) { b.wins++; a.losses++; }
      }

      for (const o of optionMap.values()) {
        o.winRate = o.matchups > 0 ? Math.round((o.wins / o.matchups) * 100) : 0;
      }

      return Array.from(optionMap.values()).sort((a, b) => b.totalVotes - a.totalVotes);
    },
    staleTime: 1000 * 60 * 5,
  });

  const maxVotes = rankings?.[0]?.totalVotes || 1;

  const getMedalIcon = (rank: number) => {
    if (rank === 0) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (rank === 1) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-amber-700" />;
    return <span className="w-5 h-5 flex items-center justify-center text-xs font-bold text-muted-foreground">#{rank + 1}</span>;
  };

  const exportCSV = () => {
    if (!rankings || rankings.length === 0) return;
    let csv = "Rank,Name,Total Votes,Wins,Losses,Win Rate %,Matchups\n";
    rankings.forEach((item, i) => {
      csv += `${i + 1},"${item.name}",${item.totalVotes},${item.wins},${item.losses},${item.winRate},${item.matchups}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const cat = selectedCategory === 'all' ? 'all-categories' : selectedCategory.toLowerCase().replace(/\s+/g, '-');
    link.download = `versa-rankings-${cat}-${new Date().toISOString().split('T')[0]}.csv`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    setTimeout(() => {
      document.body.removeChild(link);
      window.open(url, '_blank', 'noopener,noreferrer');
    }, 200);
    toast.success('Rankings exported');
  };

  return (
    <div className="space-y-4">
      {/* Category selector + export */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories?.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {rankings && rankings.length > 0 && (
          <Button variant="outline" size="icon" onClick={exportCSV} title="Export CSV">
            <Download className="h-4 w-4" />
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !rankings || rankings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No poll data available for this category.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Option Rankings
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {selectedCategory === 'all' ? 'All categories' : selectedCategory} · {rankings.length} options across polls
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {rankings.map((item, i) => (
              <div
                key={item.name}
                className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border/40 animate-fade-in"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="shrink-0">{getMedalIcon(i)}</div>

                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="w-10 h-10 rounded-lg object-cover border border-border/60 shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                    {item.name.charAt(0)}
                  </div>
                )}

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm truncate">{item.name}</span>
                    <span className="text-xs font-bold text-primary shrink-0 ml-2">{item.totalVotes.toLocaleString()} votes</span>
                  </div>
                  <Progress value={(item.totalVotes / maxVotes) * 100} className="h-2" />
                  <div className="flex gap-3 text-[11px] text-muted-foreground">
                    <span className="text-green-600 font-medium">{item.wins}W</span>
                    <span className="text-destructive font-medium">{item.losses}L</span>
                    <span>Win rate: {item.winRate}%</span>
                    <span>{item.matchups} matchups</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
