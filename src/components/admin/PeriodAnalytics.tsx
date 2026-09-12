import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, CalendarIcon, Users, Activity, BarChart3, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth,
  startOfYear, endOfYear, startOfWeek, endOfWeek,
} from 'date-fns';

type PresetKey = 'today' | 'yesterday' | 'week' | 'last7' | 'month' | 'last30' | 'year' | 'custom';

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This week' },
  { key: 'last7', label: 'Last 7 days' },
  { key: 'month', label: 'This month' },
  { key: 'last30', label: 'Last 30 days' },
  { key: 'year', label: 'This year' },
];

function rangeForPreset(key: PresetKey): { from: Date; to: Date } {
  const now = new Date();
  switch (key) {
    case 'today': return { from: startOfDay(now), to: endOfDay(now) };
    case 'yesterday': return { from: startOfDay(subDays(now, 1)), to: endOfDay(subDays(now, 1)) };
    case 'week': return { from: startOfWeek(now, { weekStartsOn: 6 }), to: endOfWeek(now, { weekStartsOn: 6 }) };
    case 'last7': return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case 'month': return { from: startOfMonth(now), to: endOfMonth(now) };
    case 'last30': return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case 'year': return { from: startOfYear(now), to: endOfYear(now) };
    default: return { from: startOfDay(now), to: endOfDay(now) };
  }
}

export default function PeriodAnalytics() {
  const [preset, setPreset] = useState<PresetKey>('today');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  const range = useMemo(() => {
    if (preset === 'custom' && customFrom) {
      return { from: startOfDay(customFrom), to: endOfDay(customTo || customFrom) };
    }
    return rangeForPreset(preset);
  }, [preset, customFrom, customTo]);

  const fromISO = range.from.toISOString();
  const toISO = range.to.toISOString();

  const { data, isLoading } = useQuery({
    queryKey: ['period-analytics', fromISO, toISO],
    queryFn: async () => {
      const [pollsRes, votesRes, usersRes] = await Promise.all([
        supabase
          .from('polls')
          .select('id, question, option_a, option_b, category, is_active, created_at')
          .gte('created_at', fromISO)
          .lte('created_at', toISO)
          .order('created_at', { ascending: false }),
        supabase
          .from('votes')
          .select('id, poll_id, user_id, choice, created_at')
          .gte('created_at', fromISO)
          .lte('created_at', toISO),
        supabase.rpc('admin_list_users_full', { _limit: 100000, _offset: 0 }),
      ]);

      const polls = pollsRes.data || [];
      const votes = votesRes.data || [];
      const users = usersRes.data || [];

      const userMap = new Map(users.map((u: any) => [u.id, u]));

      // votes per poll in range (includes polls created earlier)
      const votesPerPoll = new Map<string, number>();
      const perUser = new Map<string, { votes: number; last: string }>();
      votes.forEach(v => {
        votesPerPoll.set(v.poll_id, (votesPerPoll.get(v.poll_id) || 0) + 1);
        const cur = perUser.get(v.user_id);
        if (!cur || (v.created_at && v.created_at > cur.last)) {
          perUser.set(v.user_id, { votes: (cur?.votes || 0) + 1, last: v.created_at || cur?.last || '' });
        } else {
          cur.votes++;
        }
      });

      const voters = Array.from(perUser.entries())
        .map(([id, info]) => {
          const u: any = userMap.get(id);
          return {
            id,
            username: u?.username || u?.email || 'Unknown user',
            email: u?.email || '',
            gender: u?.gender || '',
            city: u?.city_of_residence || u?.city || '',
            votes: info.votes,
            last: info.last,
          };
        })
        .sort((a, b) => b.votes - a.votes);

      const pollRows = polls.map(p => ({
        id: p.id,
        question: p.question,
        matchup: `${p.option_a} vs ${p.option_b}`,
        category: p.category || 'Uncategorized',
        isActive: p.is_active,
        created_at: p.created_at,
        votes: votesPerPoll.get(p.id) || 0,
      }));

      return {
        pollsSent: polls.length,
        activePolls: polls.filter(p => p.is_active).length,
        totalVotes: votes.length,
        voters,
        pollRows,
      };
    },
    staleTime: 60000,
  });

  const exportVoters = () => {
    if (!data) return;
    const rows = [
      ['Username', 'Email', 'Gender', 'City', 'Votes in period', 'Last vote'],
      ...data.voters.map(v => [
        v.username, v.email, v.gender, v.city, String(v.votes),
        v.last ? format(new Date(v.last), 'yyyy-MM-dd HH:mm') : '',
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `voters-${format(range.from, 'yyyyMMdd')}-${format(range.to, 'yyyyMMdd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Range picker */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-primary" />
            Pick a period
          </CardTitle>
          <CardDescription>
            {format(range.from, 'MMM d, yyyy')} – {format(range.to, 'MMM d, yyyy')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(p => (
              <Button
                key={p.key}
                size="sm"
                variant={preset === p.key ? 'default' : 'outline'}
                className="text-xs"
                onClick={() => setPreset(p.key)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn('text-xs justify-start', !customFrom && 'text-muted-foreground')}
                >
                  <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                  {customFrom ? format(customFrom, 'MMM d, yyyy') : 'Custom start'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customFrom}
                  onSelect={(d) => { setCustomFrom(d); setPreset('custom'); }}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn('text-xs justify-start', !customTo && 'text-muted-foreground')}
                >
                  <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                  {customTo ? format(customTo, 'MMM d, yyyy') : 'Custom end'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customTo}
                  onSelect={(d) => { setCustomTo(d); setPreset('custom'); }}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {isLoading || !data ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metric icon={BarChart3} label="Polls sent" value={data.pollsSent} />
            <Metric icon={BarChart3} label="Still live" value={data.activePolls} />
            <Metric icon={Activity} label="Votes" value={data.totalVotes.toLocaleString()} />
            <Metric icon={Users} label="People voted" value={data.voters.length} />
          </div>

          {/* Polls in period */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Polls sent in this period</CardTitle>
              <CardDescription>{data.pollsSent} polls</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.pollRows.length === 0 && (
                <p className="text-sm text-muted-foreground">No polls went live in this period.</p>
              )}
              {data.pollRows.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.matchup}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.question}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{p.category}</Badge>
                      {p.isActive && <Badge className="text-[10px] px-1.5 py-0">Live</Badge>}
                      <span className="text-[10px] text-muted-foreground">
                        {p.created_at ? format(new Date(p.created_at), 'MMM d, HH:mm') : ''}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">{p.votes.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">votes</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Voters */}
          <Card>
            <CardHeader className="pb-2 flex-row items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">Who voted</CardTitle>
                <CardDescription>{data.voters.length} people voted in this period</CardDescription>
              </div>
              <Button size="sm" variant="outline" className="text-xs" onClick={exportVoters}>
                <Download className="h-3.5 w-3.5 mr-1" />
                CSV
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.voters.length === 0 && (
                <p className="text-sm text-muted-foreground">Nobody voted in this period.</p>
              )}
              {data.voters.map(v => (
                <div key={v.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/40">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{v.username}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {[v.gender, v.city].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{v.votes}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {v.last ? format(new Date(v.last), 'MMM d, HH:mm') : ''}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="h-4 w-4 text-primary" />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
