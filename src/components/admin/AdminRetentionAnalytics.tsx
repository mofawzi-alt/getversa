import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Users, UserCheck, RefreshCcw, Award, TrendingUp } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface RetentionData {
  totalVoters: number;
  firstTimeVoters: number;
  returningVoters: number;
  loyalVoters: number;
  retentionRate: number;
  voterFrequency: { segment: string; count: number; percentage: number }[];
  cohortRetention: { votes: string; voters: number }[];
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export default function AdminRetentionAnalytics() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-voter-retention'],
    queryFn: async (): Promise<RetentionData | null> => {
      // Get all votes (platform-wide)
      const { data: votes } = await supabase
        .from('votes')
        .select('user_id');

      if (!votes || votes.length === 0) return null;

      // Count votes per user
      const userVoteCounts = new Map<string, number>();
      votes.forEach(vote => {
        userVoteCounts.set(vote.user_id, (userVoteCounts.get(vote.user_id) || 0) + 1);
      });

      const totalVoters = userVoteCounts.size;
      const firstTimeVoters = Array.from(userVoteCounts.values()).filter(c => c === 1).length;
      const returningVoters = Array.from(userVoteCounts.values()).filter(c => c >= 2 && c <= 4).length;
      const loyalVoters = Array.from(userVoteCounts.values()).filter(c => c >= 5).length;
      const retentionRate = totalVoters > 0 ? Math.round((returningVoters + loyalVoters) / totalVoters * 100) : 0;

      const frequencyBuckets = [
        { label: '1 vote', min: 1, max: 1 },
        { label: '2-3 votes', min: 2, max: 3 },
        { label: '4-6 votes', min: 4, max: 6 },
        { label: '7-10 votes', min: 7, max: 10 },
        { label: '10+ votes', min: 11, max: Infinity },
      ];

      const voterFrequency = frequencyBuckets.map(bucket => {
        const count = Array.from(userVoteCounts.values()).filter(
          c => c >= bucket.min && c <= bucket.max
        ).length;
        return {
          segment: bucket.label,
          count,
          percentage: Math.round((count / totalVoters) * 100),
        };
      });

      const cohortRetention = [
        { votes: 'All Voters', voters: totalVoters },
        { votes: '2+ Votes', voters: returningVoters + loyalVoters },
        { votes: '5+ Votes', voters: loyalVoters },
        { votes: '10+ Votes', voters: Array.from(userVoteCounts.values()).filter(c => c >= 10).length },
      ];

      return {
        totalVoters,
        firstTimeVoters,
        returningVoters,
        loyalVoters,
        retentionRate,
        voterFrequency,
        cohortRetention,
      };
    },
  });

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
          <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No retention data yet. Get more votes to see patterns.</p>
        </CardContent>
      </Card>
    );
  }

  const pieData = [
    { name: 'First-time', value: data.firstTimeVoters },
    { name: 'Returning', value: data.returningVoters },
    { name: 'Loyal', value: data.loyalVoters },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Total Voters</span>
            </div>
            <p className="text-2xl font-bold">{data.totalVoters}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">First-time</span>
            </div>
            <p className="text-2xl font-bold">{data.firstTimeVoters}</p>
            <p className="text-xs text-muted-foreground">
              {Math.round((data.firstTimeVoters / data.totalVoters) * 100)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCcw className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Returning</span>
            </div>
            <p className="text-2xl font-bold">{data.returningVoters}</p>
            <p className="text-xs text-muted-foreground">2-4 votes</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Award className="h-4 w-4 text-yellow-500" />
              <span className="text-xs text-muted-foreground">Loyal Fans</span>
            </div>
            <p className="text-2xl font-bold">{data.loyalVoters}</p>
            <p className="text-xs text-muted-foreground">5+ votes</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Platform Retention Rate</p>
              <p className="text-4xl font-bold">{data.retentionRate}%</p>
              <p className="text-xs text-muted-foreground mt-1">
                of voters come back for more polls
              </p>
            </div>
            <TrendingUp className="h-12 w-12 text-primary/50" />
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Voter Segments</CardTitle>
            <CardDescription>First-time vs returning vs loyal</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent, cx, cy, midAngle, outerRadius }) => {
                      const RADIAN = Math.PI / 180;
                      const radius = outerRadius + 25;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                      return (
                        <text 
                          x={x} 
                          y={y} 
                          fill="hsl(var(--foreground))"
                          textAnchor={x > cx ? 'start' : 'end'}
                          dominantBaseline="central"
                          className="text-xs font-medium"
                        >
                          {`${name} ${(percent * 100).toFixed(0)}%`}
                        </text>
                      );
                    }}
                    labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))',
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Retention Funnel</CardTitle>
            <CardDescription>How voters progress through engagement levels</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.cohortRetention} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis
                    type="category"
                    dataKey="votes"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="voters" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Voting Frequency Distribution</CardTitle>
          <CardDescription>How many times users vote on the platform</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.voterFrequency.map((bucket, i) => (
              <div key={bucket.segment}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{bucket.segment}</span>
                  <span className="font-medium">{bucket.count} voters ({bucket.percentage}%)</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${bucket.percentage}%`,
                      backgroundColor: COLORS[i % COLORS.length],
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
