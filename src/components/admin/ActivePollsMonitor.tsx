import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Search, ChevronLeft, ChevronRight, ArrowUpDown, Check, Archive, ImageOff } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const PAGE_SIZE = 20;

type SortField = 'votes' | 'created_at' | 'question';
type SortDir = 'asc' | 'desc';
type AuditFilter = 'all' | 'needs_image_fix' | 'not_reviewed' | 'archived';

export default function ActivePollsMonitor() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [auditFilter, setAuditFilter] = useState<AuditFilter>('all');
  const [page, setPage] = useState(0);
  const [sortField, setSortField] = useState<SortField>('votes');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Fetch ALL polls (active + archived) so audit filters work against the full library
  const { data: polls, isLoading: loadingPolls } = useQuery({
    queryKey: ['monitor-audit-polls'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, category, created_at, image_a_url, image_b_url, expiry_type, ends_at, batch_slot, is_hot_take, target_age_range, target_gender, weight_score, is_active, is_archived, is_reviewed, needs_image_fix')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  const pollIds = useMemo(() => polls?.map(p => p.id) || [], [polls]);

  const { data: voteResults } = useQuery({
    queryKey: ['monitor-vote-results', pollIds.length],
    queryFn: async () => {
      if (pollIds.length === 0) return new Map();
      const map = new Map<string, { total_votes: number; votes_a: number; votes_b: number; percent_a: number; percent_b: number }>();
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

  const categories = useMemo(() => {
    if (!polls) return [];
    const set = new Set(polls.map(p => p.category).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [polls]);

  // Counter bar stats — computed against full library
  const counts = useMemo(() => {
    if (!polls) return { active: 0, archived: 0, needsFix: 0, reviewed: 0, notReviewed: 0 };
    let active = 0, archived = 0, needsFix = 0, reviewed = 0, notReviewed = 0;
    for (const p of polls) {
      if ((p as any).is_archived) archived++;
      else if (p.is_active) active++;
      if ((p as any).needs_image_fix) needsFix++;
      if ((p as any).is_reviewed) reviewed++; else notReviewed++;
    }
    return { active, archived, needsFix, reviewed, notReviewed };
  }, [polls]);

  // Filter + sort
  const processedPolls = useMemo(() => {
    if (!polls) return [];
    let list = [...polls];

    // Audit filter (primary)
    if (auditFilter === 'archived') {
      list = list.filter(p => (p as any).is_archived);
    } else if (auditFilter === 'needs_image_fix') {
      list = list.filter(p => (p as any).needs_image_fix && !(p as any).is_archived);
    } else if (auditFilter === 'not_reviewed') {
      list = list.filter(p => !(p as any).is_reviewed && !(p as any).is_archived);
    } else {
      // 'all' = exclude archived by default
      list = list.filter(p => !(p as any).is_archived);
    }

    if (categoryFilter !== 'all') {
      list = list.filter(p => p.category === categoryFilter);
    }

    if (search.trim()) {
      const term = search.toLowerCase();
      list = list.filter(p =>
        p.question.toLowerCase().includes(term) ||
        p.option_a.toLowerCase().includes(term) ||
        p.option_b.toLowerCase().includes(term) ||
        (p.category && p.category.toLowerCase().includes(term))
      );
    }

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
  }, [polls, categoryFilter, auditFilter, search, sortField, sortDir, voteResults]);

  const totalPages = Math.max(1, Math.ceil(processedPolls.length / PAGE_SIZE));
  const pagedPolls = processedPolls.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortField(field); setSortDir('desc'); }
    setPage(0);
  };

  // Optimistic audit action
  const runAction = async (
    pollId: string,
    action: 'keep' | 'archive' | 'fix_image',
  ) => {
    setBusyId(pollId);
    const patch: Record<string, any> =
      action === 'keep' ? { is_reviewed: true, is_archived: false }
      : action === 'archive' ? { is_archived: true }
      : { needs_image_fix: true };

    // Optimistic local update
    qc.setQueryData(['monitor-audit-polls'], (old: any[] | undefined) =>
      old?.map(p => p.id === pollId ? { ...p, ...patch } : p) || old
    );

    const { error } = await supabase.from('polls').update(patch).eq('id', pollId);
    setBusyId(null);
    if (error) {
      toast.error(`Failed: ${error.message}`);
      qc.invalidateQueries({ queryKey: ['monitor-audit-polls'] });
      return;
    }
    toast.success(
      action === 'keep' ? 'Marked as reviewed' :
      action === 'archive' ? 'Archived — removed from feed' :
      'Flagged for image fix',
      { duration: 1200 }
    );
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
      {/* Counter bar */}
      <div className="grid grid-cols-5 gap-1.5">
        <Card><CardContent className="p-2 text-center">
          <p className="text-lg font-bold text-primary">{counts.active}</p>
          <p className="text-[9px] text-muted-foreground leading-tight">Active</p>
        </CardContent></Card>
        <Card><CardContent className="p-2 text-center">
          <p className="text-lg font-bold text-muted-foreground">{counts.archived}</p>
          <p className="text-[9px] text-muted-foreground leading-tight">Archived</p>
        </CardContent></Card>
        <Card><CardContent className="p-2 text-center">
          <p className="text-lg font-bold text-orange-500">{counts.needsFix}</p>
          <p className="text-[9px] text-muted-foreground leading-tight">Needs Fix</p>
        </CardContent></Card>
        <Card><CardContent className="p-2 text-center">
          <p className="text-lg font-bold text-green-600">{counts.reviewed}</p>
          <p className="text-[9px] text-muted-foreground leading-tight">Reviewed</p>
        </CardContent></Card>
        <Card><CardContent className="p-2 text-center">
          <p className="text-lg font-bold text-amber-600">{counts.notReviewed}</p>
          <p className="text-[9px] text-muted-foreground leading-tight">To Review</p>
        </CardContent></Card>
      </div>

      {/* Audit filter buttons */}
      <div className="flex gap-1.5 flex-wrap">
        {([
          { v: 'all', label: 'All polls' },
          { v: 'not_reviewed', label: 'Not reviewed' },
          { v: 'needs_image_fix', label: 'Needs image fix' },
          { v: 'archived', label: 'Archived' },
        ] as { v: AuditFilter; label: string }[]).map(({ v, label }) => (
          <Button
            key={v}
            variant={auditFilter === v ? 'default' : 'outline'}
            size="sm"
            className="text-xs h-7"
            onClick={() => { setAuditFilter(v); setPage(0); }}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Search + category */}
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
          <SelectTrigger className="w-[140px] h-9 text-xs">
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

      {/* Sort */}
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
            {sortField === field && <ArrowUpDown className="h-3 w-3" />}
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
          const pctA = result?.percent_a || 0;
          const pctB = result?.percent_b || 0;
          const rank = processedPolls.indexOf(poll) + 1;
          const isReviewed = (poll as any).is_reviewed;
          const needsFix = (poll as any).needs_image_fix;
          const isArchived = (poll as any).is_archived;
          const busy = busyId === poll.id;

          return (
            <Card key={poll.id} className="animate-fade-in" style={{ animationDelay: `${i * 20}ms` }}>
              <CardContent className="p-3 space-y-2">
                {/* Header row with thumbnails */}
                <div className="flex items-start gap-2">
                  <span className="text-xs font-bold text-muted-foreground shrink-0 mt-0.5 w-6">#{rank}</span>

                  {/* Thumbnails */}
                  <div className="flex gap-1 shrink-0">
                    <Thumb url={poll.image_a_url} label="A" />
                    <Thumb url={poll.image_b_url} label="B" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-tight line-clamp-2">{poll.question}</p>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {poll.category && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{poll.category}</Badge>
                      )}
                      {isReviewed && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-green-600 hover:bg-green-600">✓ Reviewed</Badge>
                      )}
                      {needsFix && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-orange-500 hover:bg-orange-500">⚠ Fix Image</Badge>
                      )}
                      {isArchived && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">📦 Archived</Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-primary">{votes.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">votes</p>
                  </div>
                </div>

                {/* A/B labels + bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="truncate max-w-[45%] font-medium">{poll.option_a}</span>
                    <span className="truncate max-w-[45%] font-medium text-right">{poll.option_b}</span>
                  </div>
                  <div className="flex h-1.5 rounded-full overflow-hidden bg-muted">
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
                    <span>{poll.created_at && format(new Date(poll.created_at), 'MMM d, yyyy')}</span>
                    <span>{pctB}%</span>
                  </div>
                </div>

                {/* Bulk action toolbar */}
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => runAction(poll.id, 'keep')}
                    className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white gap-1"
                  >
                    <Check className="h-3.5 w-3.5" /> Keep
                  </Button>
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => runAction(poll.id, 'archive')}
                    className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white gap-1"
                  >
                    <Archive className="h-3.5 w-3.5" /> Archive
                  </Button>
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => runAction(poll.id, 'fix_image')}
                    className="h-8 text-xs bg-orange-500 hover:bg-orange-600 text-white gap-1"
                  >
                    <ImageOff className="h-3.5 w-3.5" /> Fix Image
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {pagedPolls.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">No polls match the current filters.</p>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="h-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="h-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function Thumb({ url, label }: { url: string | null; label: string }) {
  const isVideo = url && /\.(mp4|webm|mov|ogg)(\?|$)/i.test(url);
  return (
    <div className="relative w-[80px] h-[80px] rounded-md overflow-hidden bg-muted shrink-0 border border-border">
      {url ? (
        isVideo ? (
          <video src={url} className="w-full h-full object-cover" muted playsInline />
        ) : (
          <img src={url} alt={`Option ${label}`} className="w-full h-full object-cover" loading="lazy" />
        )
      ) : (
        <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
          No img
        </div>
      )}
      <span className="absolute top-0.5 left-0.5 bg-black/60 text-white text-[9px] font-bold px-1 rounded">
        {label}
      </span>
    </div>
  );
}
