import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFriends } from '@/hooks/useFriends';
import UserAvatar from '@/components/UserAvatar';
import {
  ArrowLeft, Search, Heart, Users, Loader2,
  ChevronRight, BarChart3, Trophy
} from 'lucide-react';

interface CategoryMatch {
  category: string;
  shared: number;
  matched: number;
  percent: number;
}

export default function Compare() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { friends, loadingFriends } = useFriends();
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');

  const selectedFriend = friends.find(f => f.friend_id === selectedFriendId);

  // Current user's avatar
  const { data: myProfile } = useQuery({
    queryKey: ['my-profile-avatar', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .rpc('get_public_profiles', { user_ids: [user.id] });
      if (error) throw error;
      return data?.[0] || null;
    },
    enabled: !!user,
  });

  // Fetch shared vote history with categories
  const { data: sharedVotes = [], isLoading: loadingVotes } = useQuery({
    queryKey: ['compare-shared-votes', user?.id, selectedFriendId],
    queryFn: async () => {
      if (!user || !selectedFriendId) return [];
      // Get shared votes
      const { data: votes, error } = await supabase
        .rpc('get_shared_vote_history', {
          user_a: user.id,
          user_b: selectedFriendId,
        });
      if (error) throw error;
      if (!votes || votes.length === 0) return [];

      // Get poll categories for these polls
      const pollIds = votes.map((v: any) => v.poll_id);
      const { data: polls } = await supabase
        .from('polls')
        .select('id, category')
        .in('id', pollIds);

      const categoryMap = new Map<string, string>();
      (polls || []).forEach((p: any) => {
        if (p.category) categoryMap.set(p.id, p.category);
      });

      return votes.map((v: any) => ({
        ...v,
        category: categoryMap.get(v.poll_id) || 'Other',
      }));
    },
    enabled: !!user && !!selectedFriendId,
  });

  // Overall score
  const overallScore = useMemo(() => {
    if (sharedVotes.length === 0) return null;
    const matched = sharedVotes.filter((v: any) => v.is_match).length;
    return Math.round((matched / sharedVotes.length) * 100);
  }, [sharedVotes]);

  // Category breakdown
  const categoryBreakdown = useMemo((): CategoryMatch[] => {
    if (sharedVotes.length === 0) return [];
    const map = new Map<string, { shared: number; matched: number }>();
    sharedVotes.forEach((v: any) => {
      const cat = v.category || 'Other';
      const entry = map.get(cat) || { shared: 0, matched: 0 };
      entry.shared++;
      if (v.is_match) entry.matched++;
      map.set(cat, entry);
    });
    return Array.from(map.entries())
      .map(([category, { shared, matched }]) => ({
        category,
        shared,
        matched,
        percent: Math.round((matched / shared) * 100),
      }))
      .filter(c => c.shared >= 2) // Only show categories with 2+ shared votes
      .sort((a, b) => b.percent - a.percent);
  }, [sharedVotes]);

  const filteredFriends = friends.filter(f =>
    !filterText || f.friend_username?.toLowerCase().includes(filterText.toLowerCase())
  );

  const getBarColor = (pct: number) => {
    if (pct >= 80) return 'bg-green-500';
    if (pct >= 60) return 'bg-primary';
    if (pct >= 40) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  const getScoreEmoji = (pct: number) => {
    if (pct >= 90) return '🔥';
    if (pct >= 75) return '💫';
    if (pct >= 50) return '🤝';
    if (pct >= 25) return '😬';
    return '💥';
  };

  // Friend selection view
  if (!selectedFriendId) {
    return (
      <AppLayout>
        <div className="p-4 space-y-4 animate-slide-up">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-display font-bold">Compare</h1>
              <p className="text-xs text-muted-foreground">Pick a friend to compare votes</p>
            </div>
          </div>

          {/* Crew Compare entry */}
          <button
            onClick={() => navigate('/compare/group')}
            className="w-full glass rounded-2xl p-4 flex items-center gap-3 text-left hover:bg-primary/5 transition-colors border border-primary/20"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Crew Compare</p>
              <p className="text-xs text-muted-foreground truncate">
                Battle two groups of friends or vibe-check one crew
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>

          {/* Search filter */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter friends..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="pl-10"
            />
          </div>

          {loadingFriends ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredFriends.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">
                {friends.length === 0 ? 'No friends yet' : 'No match'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {friends.length === 0
                  ? 'Add friends first to compare voting patterns'
                  : 'Try a different search'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFriends.map((f) => (
                <button
                  key={f.friend_id}
                  className="w-full glass rounded-xl p-4 flex items-center gap-3 hover:bg-secondary/50 transition-colors text-left"
                  onClick={() => setSelectedFriendId(f.friend_id)}
                >
                  <UserAvatar
                    url={f.friend_avatar_url}
                    username={f.friend_username}
                    className="w-10 h-10"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">@{f.friend_username}</h3>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Heart className="h-3 w-3" />
                      {f.compatibility_score !== null ? `${f.compatibility_score}% compatible` : 'No data yet'}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </div>
      </AppLayout>
    );
  }

  // Comparison results view
  return (
    <AppLayout>
      <div className="p-4 space-y-6 animate-slide-up">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedFriendId(null)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-display font-bold">Compare</h1>
        </div>

        {/* Overall Score Card */}
        <div className="glass rounded-3xl p-6 text-center">
          <div className="flex justify-center items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-gradient-primary flex items-center justify-center">
              <span className="text-lg font-bold text-primary-foreground">You</span>
            </div>
            <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
              <Heart className="h-8 w-8 text-white fill-current" />
              <div className="absolute -bottom-2 bg-background px-2 py-0.5 rounded-full border border-border">
                <span className="text-sm font-bold">
                  {loadingVotes ? '...' : overallScore !== null ? `${overallScore}%` : '—'}
                </span>
              </div>
            </div>
            <UserAvatar
              url={selectedFriend?.friend_avatar_url}
              username={selectedFriend?.friend_username}
              className="w-14 h-14"
            />
          </div>

          <h2 className="text-lg font-semibold">
            You & @{selectedFriend?.friend_username}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {loadingVotes
              ? 'Crunching numbers...'
              : sharedVotes.length === 0
                ? 'No shared votes yet — vote on more polls!'
                : `Based on ${sharedVotes.length} shared poll${sharedVotes.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Category Breakdown */}
        {loadingVotes ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : categoryBreakdown.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">Category Breakdown</h3>
            </div>

            {categoryBreakdown.map((cat) => (
              <div key={cat.category} className="glass rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{cat.category}</span>
                  <span className="text-sm font-bold">
                    {cat.percent}% {getScoreEmoji(cat.percent)}
                  </span>
                </div>
                <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${getBarColor(cat.percent)}`}
                    style={{ width: `${cat.percent}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {cat.matched}/{cat.shared} votes matched
                </p>
              </div>
            ))}
          </div>
        ) : sharedVotes.length > 0 ? (
          <div className="glass rounded-2xl p-6 text-center">
            <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              Not enough data per category yet. Keep voting!
            </p>
          </div>
        ) : null}

        {/* Quick link to full comparison */}
        {selectedFriendId && sharedVotes.length > 0 && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate(`/friends/${selectedFriendId}`)}
          >
            View Full Vote History
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </AppLayout>
  );
}
