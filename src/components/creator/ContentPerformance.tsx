import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, TrendingUp, TrendingDown, Award, BarChart3, Tag, Flame } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const CATEGORY_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

interface PollPerformance {
  id: string;
  question: string;
  category: string | null;
  voteCount: number;
  optionAPercent: number;
  optionBPercent: number;
  option_a: string;
  option_b: string;
  engagementRate: number;
  created_at: string;
}

interface CategoryStats {
  name: string;
  pollCount: number;
  totalVotes: number;
  avgVotes: number;
}

export default function ContentPerformance() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['creator-content-performance', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      // Get all polls by creator with vote counts
      const { data: polls } = await supabase
        .from('polls')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (!polls || polls.length === 0) {
        return { polls: [], categories: [], topPerformer: null, worstPerformer: null };
      }

      // Get vote details for each poll
      const pollsWithStats: PollPerformance[] = await Promise.all(
        polls.map(async (poll) => {
          const { data: votes } = await supabase
            .from('votes')
            .select('choice')
            .eq('poll_id', poll.id);

          const voteCount = votes?.length || 0;
          const optionAVotes = votes?.filter(v => v.choice === 'A').length || 0;
          const optionAPercent = voteCount > 0 ? Math.round((optionAVotes / voteCount) * 100) : 50;

          return {
            id: poll.id,
            question: poll.question,
            category: poll.category,
            option_a: poll.option_a,
            option_b: poll.option_b,
            voteCount,
            optionAPercent,
            optionBPercent: 100 - optionAPercent,
            engagementRate: Math.min(100, voteCount * 2), // Simplified engagement metric
            created_at: poll.created_at,
          };
        })
      );

      // Category breakdown
      const categoryMap = new Map<string, CategoryStats>();
      pollsWithStats.forEach(poll => {
        const cat = poll.category || 'Uncategorized';
        const existing = categoryMap.get(cat) || { name: cat, pollCount: 0, totalVotes: 0, avgVotes: 0 };
        existing.pollCount++;
        existing.totalVotes += poll.voteCount;
        categoryMap.set(cat, existing);
      });

      const categories = Array.from(categoryMap.values())
        .map(cat => ({ ...cat, avgVotes: Math.round(cat.totalVotes / cat.pollCount) }))
        .sort((a, b) => b.totalVotes - a.totalVotes);

      // Find top and worst performers
      const sortedByVotes = [...pollsWithStats].sort((a, b) => b.voteCount - a.voteCount);
      const topPerformer = sortedByVotes[0] || null;
      const worstPerformer = sortedByVotes.length > 1 ? sortedByVotes[sortedByVotes.length - 1] : null;

      return {
        polls: pollsWithStats,
        categories,
        topPerformer,
        worstPerformer,
      };
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data || data.polls.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No polls yet. Create polls to see performance analytics.</p>
        </CardContent>
      </Card>
    );
  }

  const maxVotes = Math.max(...data.polls.map(p => p.voteCount), 1);

  return (
    <div className="space-y-6">
      {/* Top & Worst Performers */}
      <div className="grid md:grid-cols-2 gap-4">
        {data.topPerformer && (
          <Card className="bg-gradient-to-br from-green-500/10 via-background to-green-500/5 border-green-500/20">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-green-500" />
                <CardTitle className="text-base text-green-600 dark:text-green-400">Top Performer</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="font-medium line-clamp-2 mb-2">{data.topPerformer.question}</p>
              <div className="flex items-center gap-4">
                <Badge variant="secondary" className="bg-green-500/20 text-green-700 dark:text-green-300">
                  {data.topPerformer.voteCount} votes
                </Badge>
                {data.topPerformer.category && (
                  <Badge variant="outline">{data.topPerformer.category}</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {data.worstPerformer && (
          <Card className="bg-gradient-to-br from-orange-500/10 via-background to-orange-500/5 border-orange-500/20">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-orange-500" />
                <CardTitle className="text-base text-orange-600 dark:text-orange-400">Needs Attention</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="font-medium line-clamp-2 mb-2">{data.worstPerformer.question}</p>
              <div className="flex items-center gap-4">
                <Badge variant="secondary" className="bg-orange-500/20 text-orange-700 dark:text-orange-300">
                  {data.worstPerformer.voteCount} votes
                </Badge>
                {data.worstPerformer.category && (
                  <Badge variant="outline">{data.worstPerformer.category}</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Category Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            Performance by Category
          </CardTitle>
          <CardDescription>See which topics resonate most with your audience</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.categories}
                    dataKey="totalVotes"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {data.categories.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`${value} votes`, 'Total']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {data.categories.map((cat, index) => (
                <div key={cat.name} className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{cat.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {cat.pollCount} polls · {cat.avgVotes} avg votes
                    </p>
                  </div>
                  <span className="text-sm font-bold">{cat.totalVotes}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Poll Rankings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            Poll Rankings
          </CardTitle>
          <CardDescription>All your polls ranked by engagement</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.polls.slice(0, 10).map((poll, index) => (
              <div key={poll.id} className="space-y-2">
                <div className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-bold shrink-0">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium line-clamp-1">{poll.question}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span>{poll.voteCount} votes</span>
                      {poll.category && (
                        <>
                          <span>·</span>
                          <Badge variant="outline" className="text-xs px-1.5 py-0">
                            {poll.category}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-9">
                  <div className="flex-1 h-2 rounded-full overflow-hidden bg-muted">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-accent transition-all"
                      style={{ width: `${(poll.voteCount / maxVotes) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
