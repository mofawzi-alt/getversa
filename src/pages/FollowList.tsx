import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { ArrowLeft } from 'lucide-react';
import VerifiedBadge from '@/components/VerifiedBadge';

type Tab = 'followers' | 'following';

export default function FollowList() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const initialTab = (params.get('tab') as Tab) || 'followers';
  const [tab, setTab] = useState<Tab>(initialTab);

  const targetId = userId || user?.id;

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['follow-list', targetId, tab],
    queryFn: async () => {
      if (!targetId) return [];
      const column = tab === 'followers' ? 'follower_id' : 'following_id';
      const filterCol = tab === 'followers' ? 'following_id' : 'follower_id';

      const { data: rels, error } = await supabase
        .from('follows')
        .select(`${column}, created_at`)
        .eq(filterCol, targetId)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const ids = (rels || []).map((r: any) => r[column]);
      if (ids.length === 0) return [];

      const { data: users } = await supabase
        .from('users')
        .select('id, username, avatar_url, verified_public_figure')
        .in('id', ids);
      return users || [];
    },
    enabled: !!targetId,
  });

  const setActive = (t: Tab) => {
    setTab(t);
    setParams({ tab: t });
  };

  return (
    <AppLayout>
      <div className="p-4 space-y-4 animate-slide-up">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-display font-bold">Connections</h1>
        </div>

        <div className="flex border-b border-border">
          {(['followers', 'following'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setActive(t)}
              className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
                tab === t ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="text-center text-sm text-muted-foreground py-8">Loading…</p>
        ) : list.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            {tab === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
          </p>
        ) : (
          <ul className="space-y-2">
            {list.map((u: any) => (
              <li key={u.id}>
                <button
                  onClick={() => navigate(`/user/${u.id}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:bg-accent/30 transition-colors"
                >
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center">
                      <span className="text-sm font-bold text-primary-foreground">
                        {u.username?.[0]?.toUpperCase() || '?'}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium">@{u.username || 'user'}</span>
                    {u.verified_public_figure && <VerifiedBadge size="sm" />}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppLayout>
  );
}
