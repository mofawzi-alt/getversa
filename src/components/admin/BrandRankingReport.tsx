import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Trophy, TrendingUp, Medal } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface BrandStat {
  name: string;
  totalVotes: number;
  wins: number;
  losses: number;
  matchups: number;
  winRate: number;
  imageUrl: string | null;
}

export default function BrandRankingReport() {
  const { data: brands, isLoading } = useQuery({
    queryKey: ['brand-ranking-report'],
    queryFn: async () => {
      // Fetch all brand polls
      const { data: polls, error } = await supabase
        .from('polls')
        .select('id, option_a, option_b, image_a_url, image_b_url')
        .eq('question', 'Which dessert brand do you prefer?')
        .eq('poll_type', 'seasonal')
        .eq('is_active', true);

      if (error) throw error;
      if (!polls || polls.length === 0) return [];

      const pollIds = polls.map(p => p.id);
      const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: pollIds });
      const resultsMap = new Map(results?.map((r: any) => [r.poll_id, r]) || []);

      // Aggregate per brand
      const brandMap = new Map<string, BrandStat>();

      const ensureBrand = (name: string, imageUrl: string | null) => {
        if (!brandMap.has(name)) {
          brandMap.set(name, { name, totalVotes: 0, wins: 0, losses: 0, matchups: 0, winRate: 0, imageUrl });
        }
      };

      for (const poll of polls) {
        ensureBrand(poll.option_a, poll.image_a_url);
        ensureBrand(poll.option_b, poll.image_b_url);

        const r = resultsMap.get(poll.id) as any;
        if (!r || r.total_votes === 0) continue;

        const brandA = brandMap.get(poll.option_a)!;
        const brandB = brandMap.get(poll.option_b)!;

        brandA.totalVotes += r.votes_a;
        brandB.totalVotes += r.votes_b;
        brandA.matchups++;
        brandB.matchups++;

        if (r.votes_a > r.votes_b) {
          brandA.wins++;
          brandB.losses++;
        } else if (r.votes_b > r.votes_a) {
          brandB.wins++;
          brandA.losses++;
        }
      }

      // Calculate win rates
      for (const b of brandMap.values()) {
        b.winRate = b.matchups > 0 ? Math.round((b.wins / b.matchups) * 100) : 0;
      }

      return Array.from(brandMap.values()).sort((a, b) => b.totalVotes - a.totalVotes);
    },
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!brands || brands.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No brand poll data available yet.
        </CardContent>
      </Card>
    );
  }

  const maxVotes = brands[0]?.totalVotes || 1;

  const getMedalIcon = (rank: number) => {
    if (rank === 0) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (rank === 1) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-amber-700" />;
    return <span className="w-5 h-5 flex items-center justify-center text-xs font-bold text-muted-foreground">#{rank + 1}</span>;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Brand Popularity Ranking
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Based on total votes received across all matchups
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {brands.map((brand, i) => (
            <div
              key={brand.name}
              className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border/40 animate-fade-in"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* Rank */}
              <div className="shrink-0">{getMedalIcon(i)}</div>

              {/* Logo */}
              {brand.imageUrl ? (
                <img
                  src={brand.imageUrl}
                  alt={brand.name}
                  className="w-10 h-10 rounded-lg object-cover border border-border/60 shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                  {brand.name.charAt(0)}
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm truncate">{brand.name}</span>
                  <span className="text-xs font-bold text-primary shrink-0 ml-2">
                    {brand.totalVotes.toLocaleString()} votes
                  </span>
                </div>
                <Progress value={(brand.totalVotes / maxVotes) * 100} className="h-2" />
                <div className="flex gap-3 text-[11px] text-muted-foreground">
                  <span className="text-green-600 font-medium">{brand.wins}W</span>
                  <span className="text-destructive font-medium">{brand.losses}L</span>
                  <span>Win rate: {brand.winRate}%</span>
                  <span>{brand.matchups} matchups</span>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
