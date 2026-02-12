import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Clock, Zap, Sun, Moon, TrendingUp } from 'lucide-react';
import { format, parseISO, differenceInMinutes, getHours } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  Cell,
} from 'recharts';

interface ResponseTimeData {
  hourlyDistribution: { hour: string; votes: number; label: string }[];
  avgResponseTime: number;
  fastestResponse: number;
  peakHours: { start: number; end: number };
  votingSpeed: { timeRange: string; count: number; percentage: number }[];
}

export default function ResponseTimeAnalytics() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['response-time-analytics', user?.id],
    queryFn: async (): Promise<ResponseTimeData | null> => {
      if (!user) throw new Error('Not authenticated');

      // Get creator's polls
      const { data: polls } = await supabase
        .from('polls')
        .select('id, created_at')
        .eq('created_by', user.id);

      if (!polls || polls.length === 0) return null;

      const pollIds = polls.map(p => p.id);
      const pollCreationMap = new Map(polls.map(p => [p.id, p.created_at]));

      // Get all votes
      const { data: votes } = await supabase
        .from('votes')
        .select('poll_id, created_at')
        .in('poll_id', pollIds);

      if (!votes || votes.length === 0) return null;

      // Calculate hourly distribution
      const hourCounts = new Array(24).fill(0);
      const responseTimes: number[] = [];

      votes.forEach(vote => {
        const voteTime = parseISO(vote.created_at || '');
        const hour = getHours(voteTime);
        hourCounts[hour]++;

        // Calculate response time (minutes since poll creation)
        const pollCreated = pollCreationMap.get(vote.poll_id);
        if (pollCreated) {
          const responseTime = differenceInMinutes(voteTime, parseISO(pollCreated));
          if (responseTime >= 0) {
            responseTimes.push(responseTime);
          }
        }
      });

      const hourlyDistribution = hourCounts.map((count, i) => ({
        hour: i.toString().padStart(2, '0'),
        votes: count,
        label: format(new Date().setHours(i, 0, 0, 0), 'ha'),
      }));

      // Find peak hours (consecutive 3-hour window with most votes)
      let maxSum = 0;
      let peakStart = 0;
      for (let i = 0; i < 24; i++) {
        const sum = hourCounts[i] + hourCounts[(i + 1) % 24] + hourCounts[(i + 2) % 24];
        if (sum > maxSum) {
          maxSum = sum;
          peakStart = i;
        }
      }

      // Calculate voting speed distribution
      const speedBuckets = [
        { label: '< 1 hour', max: 60 },
        { label: '1-6 hours', max: 360 },
        { label: '6-24 hours', max: 1440 },
        { label: '1-3 days', max: 4320 },
        { label: '3+ days', max: Infinity },
      ];

      const votingSpeed = speedBuckets.map((bucket, i) => {
        const prevMax = i > 0 ? speedBuckets[i - 1].max : 0;
        const count = responseTimes.filter(t => t > prevMax && t <= bucket.max).length;
        return {
          timeRange: bucket.label,
          count,
          percentage: Math.round((count / responseTimes.length) * 100),
        };
      });

      const avgResponseTime = responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0;

      const fastestResponse = responseTimes.length > 0
        ? Math.min(...responseTimes)
        : 0;

      return {
        hourlyDistribution,
        avgResponseTime,
        fastestResponse,
        peakHours: { start: peakStart, end: (peakStart + 2) % 24 },
        votingSpeed,
      };
    },
    enabled: !!user,
  });

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
    return `${Math.round(minutes / 1440)}d`;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No response time data yet. Create polls to track timing analytics.</p>
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
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Avg Response</span>
            </div>
            <p className="text-2xl font-bold">{formatTime(data.avgResponseTime)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span className="text-xs text-muted-foreground">Fastest Vote</span>
            </div>
            <p className="text-2xl font-bold">{formatTime(data.fastestResponse)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Sun className="h-4 w-4 text-orange-500" />
              <span className="text-xs text-muted-foreground">Peak Hours</span>
            </div>
            <p className="text-xl font-bold">
              {data.peakHours.start}:00 - {data.peakHours.end}:00
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Quick Votes</span>
            </div>
            <p className="text-2xl font-bold">{data.votingSpeed[0]?.percentage || 0}%</p>
            <p className="text-xs text-muted-foreground">within 1 hour</p>
          </CardContent>
        </Card>
      </div>

      {/* Hourly Distribution Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Best Time to Post
          </CardTitle>
          <CardDescription>When your audience is most active (24h distribution)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]" id="hourly-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.hourlyDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  interval={2}
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
                  formatter={(value: number) => [value, 'Votes']}
                />
                <Bar dataKey="votes" radius={[4, 4, 0, 0]}>
                  {data.hourlyDistribution.map((entry, index) => {
                    const hour = parseInt(entry.hour);
                    const isPeak = hour >= data.peakHours.start && hour <= data.peakHours.end;
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={isPeak ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.3)'}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            🌟 Peak hours highlighted — post during these times for maximum engagement
          </p>
        </CardContent>
      </Card>

      {/* Voting Speed Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Response Speed
          </CardTitle>
          <CardDescription>How quickly users vote after poll creation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3" id="speed-chart">
            {data.votingSpeed.map((bucket, i) => (
              <div key={bucket.timeRange}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{bucket.timeRange}</span>
                  <span className="font-medium">{bucket.count} votes ({bucket.percentage}%)</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${bucket.percentage}%`,
                      backgroundColor: i === 0
                        ? 'hsl(var(--primary))'
                        : i === 1
                          ? 'hsl(var(--accent))'
                          : 'hsl(var(--muted-foreground) / 0.5)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
