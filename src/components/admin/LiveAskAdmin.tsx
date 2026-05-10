import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Loader2, Eye, Ban, Trash2, MessageCircleQuestion,
  ChevronLeft, ChevronRight, ExternalLink, ImageIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatDistanceToNow } from 'date-fns';

const PAGE_SIZE = 10;

type LiveAskStatus = 'active' | 'finalized' | 'rejected' | 'all';

interface LiveAsk {
  id: string;
  asker_id: string;
  photo_url: string;
  question: string;
  option_a: string;
  option_b: string;
  target_gender: string | null;
  target_age_ranges: string[] | null;
  target_cities: string[] | null;
  target_countries: string[] | null;
  status: string;
  vote_count: number;
  votes_a: number;
  votes_b: number;
  reveal_at: string;
  finalized_at: string | null;
  is_paid: boolean;
  credits_charged: number;
  created_at: string;
  asker_username?: string;
  asker_avatar_url?: string;
}

export default function LiveAskAdmin() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<LiveAskStatus>('all');
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: liveAsks = [], isLoading } = useQuery({
    queryKey: ['admin-live-asks', tab],
    queryFn: async () => {
      let q = supabase
        .from('live_asks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (tab !== 'all') {
        q = q.eq('status', tab);
      }

      const { data, error } = await q;
      if (error) throw error;

      const asks = (data || []) as LiveAsk[];
      if (asks.length === 0) return asks;

      // Fetch asker usernames
      const userIds = [...new Set(asks.map((a) => a.asker_id))];
      const { data: usersData } = await supabase
        .from('users')
        .select('id, username, avatar_url')
        .in('id', userIds);

      const userMap = new Map(
        (usersData || []).map((u: any) => [u.id, { username: u.username, avatar_url: u.avatar_url }])
      );

      return asks.map((a) => ({
        ...a,
        asker_username: userMap.get(a.asker_id)?.username || 'Unknown',
        asker_avatar_url: userMap.get(a.asker_id)?.avatar_url || '',
      }));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('live_asks')
        .update({ status: 'rejected' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Live Ask rejected');
      qc.invalidateQueries({ queryKey: ['admin-live-asks'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to reject'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('live_asks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Live Ask deleted');
      qc.invalidateQueries({ queryKey: ['admin-live-asks'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to delete'),
  });

  const totalPages = Math.ceil(liveAsks.length / PAGE_SIZE);
  const paged = liveAsks.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const statusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'closed':
        return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'finalized':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'rejected':
        return 'bg-red-500/10 text-red-600 border-red-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageCircleQuestion className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Live Ask — User Polls</h2>
        <span className="ml-auto text-xs text-muted-foreground font-medium">
          {liveAsks.length} total
        </span>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v as LiveAskStatus); setPage(0); }}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="all" className="text-xs px-3 py-1.5">All</TabsTrigger>
          <TabsTrigger value="active" className="text-xs px-3 py-1.5">Active</TabsTrigger>
          <TabsTrigger value="finalized" className="text-xs px-3 py-1.5">Finalized</TabsTrigger>
          <TabsTrigger value="rejected" className="text-xs px-3 py-1.5">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="space-y-3 mt-3">
          {paged.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              No Live Asks found
            </div>
          )}
          {paged.map((ask) => (
            <Card key={ask.id} className="overflow-hidden">
              <CardContent className="p-3 space-y-3">
                {/* Header row */}
                <div className="flex items-start gap-3">
                  {/* Photo thumbnail */}
                  <button
                    onClick={() => setExpandedId(expandedId === ask.id ? null : ask.id)}
                    className="shrink-0 w-16 h-16 rounded-xl bg-muted overflow-hidden flex items-center justify-center relative"
                  >
                    {ask.photo_url ? (
                      <img
                        src={ask.photo_url}
                        alt="Live Ask"
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(() => {
                        const windowClosed = new Date(ask.reveal_at).getTime() <= Date.now();
                        const displayStatus =
                          ask.status === 'active' && windowClosed ? 'closed' : ask.status;
                        return (
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColor(displayStatus)}`}>
                            {displayStatus}
                          </Badge>
                        );
                      })()}
                      {ask.is_paid && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          Paid ({ask.credits_charged} cr)
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(ask.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm font-semibold leading-snug mt-1 line-clamp-2">{ask.question}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ask.option_a} <span className="opacity-50">vs</span> {ask.option_b}
                    </p>
                  </div>
                </div>

                {/* Expanded detail */}
                {expandedId === ask.id && (
                  <div className="space-y-2 pt-1 border-t border-border">
                    {ask.photo_url && (
                      <img
                        src={ask.photo_url}
                        alt="Live Ask full"
                        className="w-full rounded-xl max-h-64 object-contain bg-muted"
                      />
                    )}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-muted p-2">
                        <p className="text-lg font-bold">{ask.vote_count}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Votes</p>
                      </div>
                      <div className="rounded-lg bg-primary/5 p-2">
                        <p className="text-lg font-bold text-primary">{ask.votes_a}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">{ask.option_a}</p>
                      </div>
                      <div className="rounded-lg bg-primary/5 p-2">
                        <p className="text-lg font-bold text-primary">{ask.votes_b}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">{ask.option_b}</p>
                      </div>
                    </div>
                    {ask.target_gender && (
                      <p className="text-xs text-muted-foreground">
                        Target: {ask.target_gender}
                        {ask.target_age_ranges?.length ? ` • ${ask.target_age_ranges.join(', ')}` : ''}
                        {ask.target_countries?.length ? ` • ${ask.target_countries.join(', ')}` : ''}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      By: <span className="font-semibold text-foreground">@{ask.asker_username}</span>
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <a
                    href={`/live-ask/${ask.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-primary"
                  >
                    <Eye className="h-3.5 w-3.5" /> View <ExternalLink className="h-3 w-3" />
                  </a>
                  <div className="flex-1" />
                  {ask.status !== 'rejected' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1"
                      onClick={() => rejectMutation.mutate(ask.id)}
                      disabled={rejectMutation.isPending}
                    >
                      {rejectMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Ban className="h-3 w-3" />
                      )}
                      Reject
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs gap-1 text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm('Permanently delete this Live Ask?')) {
                        deleteMutation.mutate(ask.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
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
            onClick={() => setPage((p) => p + 1)}
            className="h-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
