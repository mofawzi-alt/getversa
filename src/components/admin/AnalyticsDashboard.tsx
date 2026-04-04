import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, BarChart3, Users, Globe, Calendar, TrendingUp, Trophy, Activity, Eye, Zap, Clock } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, AreaChart, Area,
} from 'recharts';
import { format, subDays, parseISO, startOfDay, differenceInDays } from 'date-fns';

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(210, 80%, 55%)',
  'hsl(340, 75%, 55%)',
  'hsl(45, 90%, 50%)',
  'hsl(160, 60%, 45%)',
];

const GENDER_COLORS: Record<string, string> = {
  'Male': 'hsl(210, 80%, 55%)',
  'Female': 'hsl(340, 75%, 55%)',
  'Prefer not to say': 'hsl(var(--muted-foreground))',
  'Unknown': 'hsl(var(--muted-foreground) / 0.5)',
};

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  color: 'hsl(var(--foreground))',
  fontSize: '12px',
};

interface DashboardData {
  totalPolls: number;
  totalVotes: number;
  totalUsers: number;
  uniqueVoters: number;
  avgVotesPerPoll: number;
  avgVotesPerUser: number;
  retentionRate: number;
  dailyVotes: { date: string; votes: number; users: number }[];
  weeklyGrowth: { week: string; polls: number; votes: number; newUsers: number }[];
  genderBreakdown: { name: string; value: number }[];
  ageBreakdown: { name: string; value: number }[];
  countryBreakdown: { name: string; value: number }[];
  topPolls: { question: string; optionA: string; optionB: string; votes: number; winner: string; winPercent: number }[];
  categoryPerformance: { category: string; polls: number; votes: number; avgVotes: number }[];
  peakHours: { hour: string; votes: number }[];
}

export default function AnalyticsDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-dashboard'],
    queryFn: async (): Promise<DashboardData | null> => {
      const [
        { data: polls },
        { data: votes },
        { data: users },
      ] = await Promise.all([
        supabase.from('polls').select('id, question, option_a, option_b, category, created_at'),
        supabase.from('votes').select('id, poll_id, user_id, choice, created_at'),
        supabase.from('users').select('id, gender, age_range, country, created_at'),
      ]);

      if (!polls || !votes || !users) return null;

      // Basic counts
      const totalPolls = polls.length;
      const totalVotes = votes.length;
      const totalUsers = users.length;
      const uniqueVoterIds = new Set(votes.map(v => v.user_id));
      const uniqueVoters = uniqueVoterIds.size;

      // Vote counts per user for retention
      const userVoteCounts = new Map<string, number>();
      votes.forEach(v => userVoteCounts.set(v.user_id, (userVoteCounts.get(v.user_id) || 0) + 1));
      const returningVoters = Array.from(userVoteCounts.values()).filter(c => c >= 2).length;
      const retentionRate = uniqueVoters > 0 ? Math.round((returningVoters / uniqueVoters) * 100) : 0;

      // Daily votes (last 30 days)
      const dailyMap = new Map<string, { votes: number; users: Set<string> }>();
      const thirtyDaysAgo = subDays(new Date(), 30);
      votes.forEach(v => {
        if (!v.created_at) return;
        const date = parseISO(v.created_at);
        if (date < thirtyDaysAgo) return;
        const key = format(date, 'MMM dd');
        if (!dailyMap.has(key)) dailyMap.set(key, { votes: 0, users: new Set() });
        const entry = dailyMap.get(key)!;
        entry.votes++;
        entry.users.add(v.user_id);
      });
      // Fill in missing days
      const dailyVotes: DashboardData['dailyVotes'] = [];
      for (let i = 29; i >= 0; i--) {
        const d = format(subDays(new Date(), i), 'MMM dd');
        const entry = dailyMap.get(d);
        dailyVotes.push({ date: d, votes: entry?.votes || 0, users: entry?.users.size || 0 });
      }

      // Weekly growth (last 8 weeks)
      const weeklyGrowth: DashboardData['weeklyGrowth'] = [];
      for (let w = 7; w >= 0; w--) {
        const weekStart = subDays(new Date(), (w + 1) * 7);
        const weekEnd = subDays(new Date(), w * 7);
        const label = format(weekStart, 'MMM dd');
        const weekPolls = polls.filter(p => {
          const d = parseISO(p.created_at || '');
          return d >= weekStart && d < weekEnd;
        }).length;
        const weekVotes = votes.filter(v => {
          const d = parseISO(v.created_at || '');
          return d >= weekStart && d < weekEnd;
        }).length;
        const weekNewUsers = users.filter(u => {
          const d = parseISO(u.created_at || '');
          return d >= weekStart && d < weekEnd;
        }).length;
        weeklyGrowth.push({ week: label, polls: weekPolls, votes: weekVotes, newUsers: weekNewUsers });
      }

      // Demographics
      const genderMap = new Map<string, number>();
      const ageMap = new Map<string, number>();
      const countryMap = new Map<string, number>();
      users.forEach(u => {
        genderMap.set(u.gender || 'Unknown', (genderMap.get(u.gender || 'Unknown') || 0) + 1);
        ageMap.set(u.age_range || 'Unknown', (ageMap.get(u.age_range || 'Unknown') || 0) + 1);
        countryMap.set(u.country || 'Unknown', (countryMap.get(u.country || 'Unknown') || 0) + 1);
      });

      const toChartData = (map: Map<string, number>) =>
        Array.from(map.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 8);

      // Top polls by votes
      const pollVoteMap = new Map<string, { a: number; b: number }>();
      votes.forEach(v => {
        if (!pollVoteMap.has(v.poll_id)) pollVoteMap.set(v.poll_id, { a: 0, b: 0 });
        const entry = pollVoteMap.get(v.poll_id)!;
        if (v.choice === 'A') entry.a++; else entry.b++;
      });
      const topPolls = polls
        .map(p => {
          const counts = pollVoteMap.get(p.id) || { a: 0, b: 0 };
          const total = counts.a + counts.b;
          const winner = counts.a >= counts.b ? p.option_a : p.option_b;
          const winPercent = total > 0 ? Math.round((Math.max(counts.a, counts.b) / total) * 100) : 0;
          return { question: p.question, optionA: p.option_a, optionB: p.option_b, votes: total, winner, winPercent };
        })
        .sort((a, b) => b.votes - a.votes)
        .slice(0, 10);

      // Category performance
      const catMap = new Map<string, { polls: number; votes: number }>();
      polls.forEach(p => {
        const cat = p.category || 'Uncategorized';
        if (!catMap.has(cat)) catMap.set(cat, { polls: 0, votes: 0 });
        catMap.get(cat)!.polls++;
      });
      votes.forEach(v => {
        const poll = polls.find(p => p.id === v.poll_id);
        const cat = poll?.category || 'Uncategorized';
        if (catMap.has(cat)) catMap.get(cat)!.votes++;
      });
      const categoryPerformance = Array.from(catMap.entries())
        .map(([category, { polls: p, votes: v }]) => ({
          category, polls: p, votes: v, avgVotes: p > 0 ? Math.round(v / p) : 0,
        }))
        .sort((a, b) => b.votes - a.votes);

      // Peak hours
      const hourCounts = new Array(24).fill(0);
      votes.forEach(v => {
        if (!v.created_at) return;
        hourCounts[parseISO(v.created_at).getHours()]++;
      });
      const peakHours = hourCounts.map((votes, i) => ({
        hour: format(new Date().setHours(i, 0, 0, 0), 'ha'),
        votes,
      }));

      return {
        totalPolls, totalVotes, totalUsers, uniqueVoters,
        avgVotesPerPoll: totalPolls > 0 ? Math.round(totalVotes / totalPolls) : 0,
        avgVotesPerUser: uniqueVoters > 0 ? Math.round(totalVotes / uniqueVoters) : 0,
        retentionRate,
        dailyVotes, weeklyGrowth,
        genderBreakdown: toChartData(genderMap),
        ageBreakdown: toChartData(ageMap),
        countryBreakdown: toChartData(countryMap),
        topPolls, categoryPerformance, peakHours,
      };
    },
    staleTime: 120000,
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
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No analytics data yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard icon={BarChart3} label="Total Polls" value={data.totalPolls} color="text-primary" />
        <MetricCard icon={Activity} label="Total Votes" value={data.totalVotes.toLocaleString()} color="text-green-500" />
        <MetricCard icon={Users} label="Total Users" value={data.totalUsers} color="text-blue-500" />
        <MetricCard icon={TrendingUp} label="Retention" value={`${data.retentionRate}%`} color="text-yellow-500" subtitle="come back" />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-primary">{data.avgVotesPerPoll}</p>
            <p className="text-xs text-muted-foreground">Avg votes/poll</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-primary">{data.avgVotesPerUser}</p>
            <p className="text-xs text-muted-foreground">Avg votes/user</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-primary">{data.uniqueVoters}</p>
            <p className="text-xs text-muted-foreground">Active voters</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Votes Trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Daily Activity (Last 30 Days)
          </CardTitle>
          <CardDescription>Votes and unique users per day</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.dailyVotes}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval={4} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area type="monotone" dataKey="votes" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" strokeWidth={2} name="Votes" />
                <Area type="monotone" dataKey="users" stroke="hsl(var(--accent))" fill="hsl(var(--accent) / 0.15)" strokeWidth={2} name="Unique Users" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Growth */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Weekly Growth (Last 8 Weeks)
          </CardTitle>
          <CardDescription>New polls, votes, and user signups per week</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.weeklyGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="votes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Votes" />
                <Bar dataKey="newUsers" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name="New Users" />
                <Bar dataKey="polls" fill="hsl(210, 80%, 55%)" radius={[4, 4, 0, 0]} name="Polls" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Demographics Row */}
      <div className="grid md:grid-cols-3 gap-4">
        <DemoPieChart title="Gender" icon={Users} data={data.genderBreakdown} colorMap={GENDER_COLORS} />
        <DemoPieChart title="Age Range" icon={Calendar} data={data.ageBreakdown} />
        <DemoPieChart title="Country" icon={Globe} data={data.countryBreakdown} />
      </div>

      {/* Peak Hours */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Peak Activity Hours
          </CardTitle>
          <CardDescription>When users are most active</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.peakHours}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} interval={2} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, 'Votes']} />
                <Bar dataKey="votes" radius={[3, 3, 0, 0]}>
                  {data.peakHours.map((entry, i) => {
                    const maxVotes = Math.max(...data.peakHours.map(h => h.votes));
                    const isPeak = entry.votes >= maxVotes * 0.7;
                    return <Cell key={i} fill={isPeak ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.25)'} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Category Performance */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Category Performance
          </CardTitle>
          <CardDescription>Engagement across categories</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.categoryPerformance.map((cat, i) => {
              const maxVotes = data.categoryPerformance[0]?.votes || 1;
              return (
                <div key={cat.category} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{cat.category}</span>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{cat.polls} polls</span>
                      <span className="font-semibold text-foreground">{cat.votes.toLocaleString()} votes</span>
                    </div>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(cat.votes / maxVotes) * 100}%`,
                        backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">~{cat.avgVotes} avg votes/poll</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Top Polls */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-500" />
            Top Performing Polls
          </CardTitle>
          <CardDescription>Most voted polls across all categories</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.topPolls.map((poll, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50">
                <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 ${
                  i === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                  i === 1 ? 'bg-gray-400/20 text-gray-400' :
                  i === 2 ? 'bg-orange-600/20 text-orange-600' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{poll.optionA} vs {poll.optionB}</p>
                  <p className="text-xs text-muted-foreground truncate">{poll.question}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold">{poll.votes.toLocaleString()}</p>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {poll.winner.length > 12 ? poll.winner.slice(0, 12) + '…' : poll.winner}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{poll.winPercent}%</span>
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

function MetricCard({ icon: Icon, label, value, color, subtitle }: {
  icon: any; label: string; value: string | number; color: string; subtitle?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-2xl font-bold">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function DemoPieChart({ title, icon: Icon, data, colorMap }: {
  title: string; icon: any; data: { name: string; value: number }[]; colorMap?: Record<string, string>;
}) {
  if (data.length === 0) return null;

  const getColor = (name: string, index: number) =>
    colorMap?.[name] || CHART_COLORS[index % CHART_COLORS.length];

  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={65}
                paddingAngle={3}
                dataKey="value"
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={getColor(entry.name, i)} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-1 mt-1">
          {data.slice(0, 5).map((d, i) => (
            <div key={d.name} className="flex items-center gap-1 text-[10px]">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getColor(d.name, i) }} />
              <span className="text-muted-foreground truncate max-w-[60px]">{d.name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
