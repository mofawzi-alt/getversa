import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Search, Activity, TrendingUp, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import { format } from 'date-fns';

const PAGE_SIZE = 20;

type SortField = 'votes' | 'created_at' | 'question';
type SortDir = 'asc' | 'desc';

export default function ActivePollsMonitor() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expiryFilter, setExpiryFilter] = useState('all');
  const [batchFilter, setBatchFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [sortField, setSortField] = useState<SortField>('votes');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Fetch all active polls (lightweight – no vote counts yet)
  const { data: polls, isLoading: loadingPolls } = useQuery({
    queryKey: ['monitor-active-polls'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, category, created_at, image_a_url, image_b_url, expiry_type, ends_at, batch_slot, is_hot_take, target_age_range, target_gender, weight_score')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  // Fetch vote counts for all active polls via RPC (batched)
  const pollIds = useMemo(() => polls?.map(p => p.id) || [], [polls]);

  const { data: voteResults } = useQuery({
    queryKey: ['monitor-vote-results', pollIds.length],
    queryFn: async () => {
      if (pollIds.length === 0) return new Map();
      const map = new Map<string, { total_votes: number; votes_a: number; votes_b: number; percent_a: number; percent_b: number }>();
      // Batch in chunks of 100 to stay safe
      for (let i = 0; i < pollIds.length; i += 100) {
        const batch = pollIds.slice(i, i + 100);
        const { data } = await supabase.rpc('get_poll_results', { poll_ids: batch });
        data?.forEach((r: any) => map.set(r.poll_id, r));
      }
      return map;
    },
    enabled: pollIds.length > 0,
    staleTime: 60_000,
  });

  // Extract categories
  const categories = useMemo(() => {
    if (!polls) return [];
    const set = new Set(polls.map(p => p.category).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [polls]);

  // Filter + sort
  const processedPolls = useMemo(() => {
    if (!polls) return [];
    let list = [...polls];

    // Category filter
    if (categoryFilter !== 'all') {
      list = list.filter(p => p.category === categoryFilter);
    }
    if (expiryFilter !== 'all') {
      list = list.filter(p => (p as any).expiry_type === expiryFilter);
    }
    if (batchFilter !== 'all') {
      list = list.filter(p => ((p as any).batch_slot || 'none') === batchFilter);
    }

    // Search
    if (search.trim()) {
      const term = search.toLowerCase();
      list = list.filter(p =>
        p.question.toLowerCase().includes(term) ||
        p.option_a.toLowerCase().includes(term) ||
        p.option_b.toLowerCase().includes(term) ||
        (p.category && p.category.toLowerCase().includes(term))
      );
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'votes') {
        const va = voteResults?.get(a.id)?.total_votes || 0;
        const vb = voteResults?.get(b.id)?.total_votes || 0;
        cmp = va - vb;
      } else if (sortField === 'created_at') {
        cmp = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      } else {
        cmp = a.question.localeCompare(b.question);
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return list;
  }, [polls, categoryFilter, expiryFilter, batchFilter, search, sortField, sortDir, voteResults]);

  const totalPages = Math.ceil(processedPolls.length / PAGE_SIZE);
  const pagedPolls = processedPolls.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Stats
  const totalVotes = useMemo(() => {
    if (!voteResults) return 0;
    let sum = 0;
    voteResults.forEach(v => { sum += v.total_votes; });
    return sum;
  }, [voteResults]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
    setPage(0);
  };

  if (loadingPolls) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-primary">{polls?.length || 0}</p>
            <p className="text-[11px] text-muted-foreground">Active Polls</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-primary">{totalVotes.toLocaleString()}</p>
            <p className="text-[11px] text-muted-foreground">Total Votes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-primary">{categories.length}</p>
            <p className="text-[11px] text-muted-foreground">Categories</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search polls..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={categoryFilter} onValueChange={v => { setCategoryFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[130px] h-9 text-xs">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Expiry & Batch filters */}
      <div className="flex gap-2">
        <Select value={expiryFilter} onValueChange={v => { setExpiryFilter(v); setPage(0); }}>
          <SelectTrigger className="flex-1 h-9 text-xs">
            <SelectValue placeholder="Expiry" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All expiry types</SelectItem>
            <SelectItem value="evergreen">Evergreen</SelectItem>
            <SelectItem value="trending">Trending (48h)</SelectItem>
            <SelectItem value="campaign">Campaign</SelectItem>
          </SelectContent>
        </Select>
        <Select value={batchFilter} onValueChange={v => { setBatchFilter(v); setPage(0); }}>
          <SelectTrigger className="flex-1 h-9 text-xs">
            <SelectValue placeholder="Batch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All batches</SelectItem>
            <SelectItem value="none">None (immediate)</SelectItem>
            <SelectItem value="morning">Morning</SelectItem>
            <SelectItem value="afternoon">Afternoon</SelectItem>
            <SelectItem value="evening">Evening</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sort buttons */}
      <div className="flex gap-1.5 flex-wrap">
        {[
          { field: 'votes' as SortField, label: 'Most Voted' },
          { field: 'created_at' as SortField, label: 'Newest' },
          { field: 'question' as SortField, label: 'A-Z' },
        ].map(({ field, label }) => (
          <Button
            key={field}
            variant={sortField === field ? 'default' : 'outline'}
            size="sm"
            className="text-xs h-7 gap-1"
            onClick={() => toggleSort(field)}
          >
            {label}
            {sortField === field && (
              <ArrowUpDown className="h-3 w-3" />
            )}
          </Button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground self-center">
          {processedPolls.length} results
        </span>
      </div>

      {/* Poll list */}
      <div className="space-y-2">
        {pagedPolls.map((poll, i) => {
          const result = voteResults?.get(poll.id);
          const votes = result?.total_votes || 0;
          const maxVotes = voteResults ? Math.max(...Array.from(voteResults.values()).map(v => v.total_votes), 1) : 1;
          const pctA = result?.percent_a || 0;
          const pctB = result?.percent_b || 0;
          const rank = processedPolls.indexOf(poll) + 1;

          return (
            <Card key={poll.id} className="animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-xs font-bold text-muted-foreground shrink-0 mt-0.5">#{rank}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-tight line-clamp-2">{poll.question}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {poll.category && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{poll.category}</Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{poll.expiry_type}</Badge>
                      {(poll as any).batch_slot && (poll as any).batch_slot !== 'none' && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">📦 {(poll as any).batch_slot}</Badge>
                      )}
                      {(poll as any).is_hot_take && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">🔥 Hot</Badge>
                      )}
                      {poll.target_age_range && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{poll.target_age_range}</Badge>
                      )}
                      {poll.target_gender && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{poll.target_gender}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-primary">{votes.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">votes</p>
                  </div>
                </div>

                {/* A vs B bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="truncate max-w-[45%] font-medium">{poll.option_a}</span>
                    <span className="truncate max-w-[45%] font-medium text-right">{poll.option_b}</span>
                  </div>
                  <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                    {votes > 0 ? (
                      <>
                        <div className="bg-primary transition-all" style={{ width: `${pctA}%` }} />
                        <div className="bg-primary/40 transition-all" style={{ width: `${pctB}%` }} />
                      </>
                    ) : (
                      <div className="bg-muted w-full" />
                    )}
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{pctA}%</span>
                    <span className="text-[10px]">
                      {poll.created_at && format(new Date(poll.created_at), 'MMM d, yyyy')}
                    </span>
                    <span>{pctB}%</span>
                  </div>
                </div>

                {/* Relative bar */}
                <Progress value={(votes / maxVotes) * 100} className="h-1" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
            className="h-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
            className="h-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
