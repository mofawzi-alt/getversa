import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, TrendingUp, Activity, Calendar, Users } from 'lucide-react';
import { format, subDays, startOfDay, eachDayOfInterval, parseISO } from 'date-fns';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';

interface DailyStats {
  date: string;
  votes: number;
  polls: number;
  uniqueVoters: number;
}

export default function EngagementTrends() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['creator-engagement-trends', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const thirtyDaysAgo = subDays(new Date(), 30);
      
      // Get all polls by creator
      const { data: polls } = await supabase
        .from('polls')
        .select('id, created_at')
        .eq('created_by', user.id);

      if (!polls || polls.length === 0) {
        return { dailyStats: [], totalGrowth: 0, avgDailyVotes: 0 };
      }

      const pollIds = polls.map(p => p.id);

      // Get all votes on creator's polls in last 30 days
      const { data: votes } = await supabase
        .from('votes')
        .select('created_at, user_id')
        .in('poll_id', pollIds)
        .gte('created_at', thirtyDaysAgo.toISOString());

      // Create daily stats
      const days = eachDayOfInterval({
        start: thirtyDaysAgo,
        end: new Date(),
      });

      const dailyStats: DailyStats[] = days.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayStart = startOfDay(day);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

        const dayVotes = votes?.filter(v => {
          const voteDate = parseISO(v.created_at || '');
          return voteDate >= dayStart && voteDate < dayEnd;
        }) || [];

        const dayPolls = polls.filter(p => {
          const pollDate = parseISO(p.created_at || '');
          return pollDate >= dayStart && pollDate < dayEnd;
        });

        const uniqueVoters = new Set(dayVotes.map(v => v.user_id)).size;

        return {
          date: format(day, 'MMM dd'),
          votes: dayVotes.length,
          polls: dayPolls.length,
          uniqueVoters,
        };
      });

      // Calculate growth metrics
      const firstHalf = dailyStats.slice(0, 15);
      const secondHalf = dailyStats.slice(15);
      const firstHalfVotes = firstHalf.reduce((sum, d) => sum + d.votes, 0);
      const secondHalfVotes = secondHalf.reduce((sum, d) => sum + d.votes, 0);
      const totalGrowth = firstHalfVotes > 0 
        ? Math.round(((secondHalfVotes - firstHalfVotes) / firstHalfVotes) * 100) 
        : secondHalfVotes > 0 ? 100 : 0;

      const totalVotes = dailyStats.reduce((sum, d) => sum + d.votes, 0);
      const avgDailyVotes = Math.round(totalVotes / dailyStats.length);

      return {
        dailyStats,
        totalGrowth,
        avgDailyVotes,
        totalVotes,
        peakDay: dailyStats.reduce((max, d) => d.votes > max.votes ? d : max, dailyStats[0]),
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

  if (!data || data.dailyStats.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Activity className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No engagement data yet. Create polls to track trends.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">30-Day Votes</span>
            </div>
            <p className="text-2xl font-bold">{data.totalVotes?.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Growth Rate</span>
            </div>
            <p className={`text-2xl font-bold ${data.totalGrowth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {data.totalGrowth >= 0 ? '+' : ''}{data.totalGrowth}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-accent" />
              <span className="text-xs text-muted-foreground">Daily Avg</span>
            </div>
            <p className="text-2xl font-bold">{data.avgDailyVotes}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-orange-500" />
              <span className="text-xs text-muted-foreground">Peak Day</span>
            </div>
            <p className="text-lg font-bold">{data.peakDay?.date}</p>
            <p className="text-xs text-muted-foreground">{data.peakDay?.votes} votes</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="votes" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="votes">Votes</TabsTrigger>
          <TabsTrigger value="voters">Unique Voters</TabsTrigger>
          <TabsTrigger value="polls">Polls Created</TabsTrigger>
        </TabsList>

        <TabsContent value="votes">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Daily Votes (Last 30 Days)</CardTitle>
              <CardDescription>Track how voting activity changes over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.dailyStats}>
                    <defs>
                      <linearGradient id="voteGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="votes"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#voteGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="voters">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Unique Voters (Last 30 Days)</CardTitle>
              <CardDescription>How many different people are engaging</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.dailyStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="uniqueVoters"
                      stroke="hsl(var(--accent))"
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--accent))', strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="polls">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Polls Created (Last 30 Days)</CardTitle>
              <CardDescription>Your content creation frequency</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.dailyStats}>
                    <defs>
                      <linearGradient id="pollGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="polls"
                      stroke="hsl(var(--chart-3))"
                      strokeWidth={2}
                      fill="url(#pollGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
