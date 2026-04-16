import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { ArrowLeft, Flame, Zap, Users, BarChart3, Heart, Trophy, Award, Lock, UserPlus } from 'lucide-react';
import { useFollows } from '@/hooks/useFollows';
import { useFriends } from '@/hooks/useFriends';
import { useVerifiedUser } from '@/hooks/useVerifiedUsers';
import VerifiedBadge from '@/components/VerifiedBadge';
import UserAvatar from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';

import PersonalityCompatibility from '@/components/profile/PersonalityCompatibility';
import { computePersonalityType } from '@/lib/personalityType';
import { getPollDisplayImageSrc, handlePollImageError } from '@/lib/pollImages';

// Derive a taste archetype from voting trait tags
function deriveArchetype(traits: { tag: string; vote_count: number }[]): { name: string; description: string } {
  if (!traits || traits.length === 0) return { name: 'The Explorer', description: 'Still discovering their preferences' };
  
  const top = traits[0]?.tag?.toLowerCase() || '';
  const archetypes: Record<string, { name: string; description: string }> = {
    'brand_oriented': { name: 'The Loyalist', description: 'Sticks with what they trust — consistency over novelty' },
    'convenience': { name: 'The Pragmatist', description: 'Values ease and efficiency above all else' },
    'price_sensitive': { name: 'The Strategist', description: 'Maximizes value in every decision' },
    'growth': { name: 'The Risk Taker', description: 'Chases new experiences and bold choices' },
    'premium': { name: 'The Connoisseur', description: 'Drawn to quality and craftsmanship' },
    'tradition': { name: 'The Classicist', description: 'Respects heritage and timeless choices' },
    'innovation': { name: 'The Trailblazer', description: 'Always first to embrace the new' },
    'experience': { name: 'The Adventurer', description: 'Values moments over material things' },
    'minimalist': { name: 'The Essentialist', description: 'Less is more — focused and intentional' },
    'local': { name: 'The Hometown Hero', description: 'Champions the local and the familiar' },
    'global': { name: 'The Globalist', description: 'Thinks big and embraces the world' },
    'health': { name: 'The Optimizer', description: 'Every choice is a step toward better living' },
  };
  
  return archetypes[top] || { name: 'The Independent', description: 'Votes with conviction — patterns all their own' };
}

// Generate pattern lines from traits
function derivePatterns(traits: { tag: string; vote_count: number }[]): string[] {
  if (!traits || traits.length < 2) return ['Still building their voting patterns'];
  
  const patterns: string[] = [];
  const tagSet = new Set(traits.map(t => t.tag?.toLowerCase()));
  
  if (tagSet.has('local') && !tagSet.has('global')) patterns.push('Leans local over international');
  else if (tagSet.has('global') && !tagSet.has('local')) patterns.push('Leans international over local');
  
  if (tagSet.has('experience') && !tagSet.has('price_sensitive')) patterns.push('Chooses experience over price');
  else if (tagSet.has('price_sensitive') && !tagSet.has('experience')) patterns.push('Values price over experience');
  
  if (tagSet.has('innovation')) patterns.push('Drawn to the new and untested');
  if (tagSet.has('tradition')) patterns.push('Respects the tried and true');
  if (tagSet.has('premium')) patterns.push('Gravitates toward quality over quantity');
  if (tagSet.has('convenience')) patterns.push('Prioritizes ease and efficiency');
  if (tagSet.has('growth')) patterns.push('Takes the bold choice more often');
  if (tagSet.has('brand_oriented')) patterns.push('Sticks with brands they know');
  
  return patterns.slice(0, 3);
}

export default function UserProfile() {
  const { userId, friendId } = useParams<{ userId: string; friendId: string }>();
  const targetId = userId || friendId;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isFollowing, toggleFollow } = useFollows();
  const { isFriend, sendRequest, sendingRequest, hasPendingRequest } = useFriends();
  const { isVerified, category: verifiedCategory } = useVerifiedUser(targetId);
  const isOwnProfile = user?.id === targetId;
  const canViewFullProfile = isOwnProfile || (targetId ? isFriend(targetId) : false);

  // Public profile data
  const { data: profileData } = useQuery({
    queryKey: ['public-profile', targetId],
    queryFn: async () => {
      if (!targetId) return null;
      const { data } = await supabase.rpc('get_public_profiles', { user_ids: [targetId] });
      return data?.[0] || null;
    },
    enabled: !!targetId,
  });

  // Vote count
  const { data: voteCount = 0 } = useQuery({
    queryKey: ['public-vote-count', targetId],
    queryFn: async () => {
      if (!targetId) return 0;
      const { count } = await supabase.from('votes').select('id', { count: 'exact' }).eq('user_id', targetId);
      return count || 0;
    },
    enabled: !!targetId,
  });

  // Voting traits for archetype
  const { data: traits = [] } = useQuery({
    queryKey: ['public-traits', targetId],
    queryFn: async () => {
      if (!targetId) return [];
      const { data } = await supabase.rpc('get_user_voting_traits', { p_user_id: targetId });
      return (data || []) as { tag: string; vote_count: number }[];
    },
    enabled: !!targetId,
  });

  // Top categories
  const { data: topCategories = [] } = useQuery({
    queryKey: ['public-top-categories', targetId],
    queryFn: async () => {
      if (!targetId) return [];
      const { data } = await supabase.from('votes').select('category').eq('user_id', targetId).not('category', 'is', null);
      if (!data) return [];
      const counts: Record<string, number> = {};
      data.forEach(v => { if (v.category) counts[v.category] = (counts[v.category] || 0) + 1; });
      return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([cat]) => cat);
    },
    enabled: !!targetId,
  });

  // Minority vote count (votes where user was in minority)
  const { data: minorityCount = 0 } = useQuery({
    queryKey: ['public-minority', targetId],
    queryFn: async () => {
      if (!targetId) return 0;
      // Get user's votes with poll results
      const { data: userVotes } = await supabase.from('votes').select('poll_id, choice').eq('user_id', targetId);
      if (!userVotes || userVotes.length === 0) return 0;
      
      const pollIds = userVotes.map(v => v.poll_id);
      const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: pollIds });
      if (!results) return 0;
      
      const resultMap = new Map(results.map((r: any) => [r.poll_id, r]));
      let minority = 0;
      userVotes.forEach(v => {
        const r = resultMap.get(v.poll_id) as any;
        if (!r) return;
        const userPercent = v.choice === 'A' ? r.percent_a : r.percent_b;
        if (userPercent < 40) minority++;
      });
      return minority;
    },
    enabled: !!targetId,
  });

  // Compatibility score (only for logged-in users viewing someone else)
  const { data: compatScore } = useQuery({
    queryKey: ['compat-score', user?.id, targetId],
    queryFn: async () => {
      if (!user?.id || !targetId || user.id === targetId) return null;
      const { data } = await supabase.rpc('get_compatibility_score', { user_a: user.id, user_b: targetId });
      return data as number | null;
    },
    enabled: !!user?.id && !!targetId && user?.id !== targetId,
  });

  // Follower / following counts
  const { data: followerCount = 0 } = useQuery({
    queryKey: ['public-follower-count', targetId],
    queryFn: async () => {
      if (!targetId) return 0;
      const { count } = await supabase.from('follows').select('id', { count: 'exact' }).eq('following_id', targetId);
      return count || 0;
    },
    enabled: !!targetId,
  });

  const { data: followingCount = 0 } = useQuery({
    queryKey: ['public-following-count', targetId],
    queryFn: async () => {
      if (!targetId) return 0;
      const { count } = await supabase.from('follows').select('id', { count: 'exact' }).eq('follower_id', targetId);
      return count || 0;
    },
    enabled: !!targetId,
  });

  // Earned badges
  const { data: earnedBadges = [] } = useQuery({
    queryKey: ['public-badges', targetId],
    queryFn: async () => {
      if (!targetId) return [];
      const { data } = await supabase.rpc('get_user_badge_count', { target_user_id: targetId });
      return (data || []) as { badge_id: string; badge_name: string; badge_description: string; earned_at: string }[];
    },
    enabled: !!targetId,
  });

  // Global leaderboard rank (by points)
  const { data: rankInfo } = useQuery({
    queryKey: ['public-rank', targetId],
    queryFn: async () => {
      if (!targetId) return null;
      const { data } = await supabase.rpc('get_leaderboard', { order_by: 'points', limit_count: 500 });
      if (!data) return null;
      const idx = (data as any[]).findIndex((u) => u.id === targetId);
      if (idx === -1) return { rank: null, total: data.length };
      return { rank: idx + 1, total: data.length };
    },
    enabled: !!targetId,
  });

  // Recent voted polls (for own profile or friends, show choice; otherwise just the poll)
  const { data: recentVotes = [] } = useQuery({
    queryKey: ['public-recent-votes', targetId, user?.id],
    queryFn: async () => {
      if (!targetId) return [];
      const { data: votes } = await supabase
        .from('votes')
        .select('poll_id, choice, created_at')
        .eq('user_id', targetId)
        .order('created_at', { ascending: false })
        .limit(9);
      if (!votes || votes.length === 0) return [];
      const pollIds = votes.map(v => v.poll_id);
      const { data: polls } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, image_a_url, image_b_url')
        .in('id', pollIds);
      if (!polls) return [];
      const pollMap = new Map(polls.map(p => [p.id, p]));
      return votes
        .map(v => {
          const poll = pollMap.get(v.poll_id);
          if (!poll) return null;
          return { ...poll, choice: v.choice };
        })
        .filter(Boolean) as Array<{ id: string; question: string; option_a: string; option_b: string; image_a_url: string | null; image_b_url: string | null; choice: string }>;
    },
    enabled: !!targetId,
  });

  const archetype = deriveArchetype(traits);
  const patterns = derivePatterns(traits);

  // Compact personality bio line (uses same engine as the big card)
  const personalityResult = computePersonalityType(traits, voteCount);
  const personalityBio = personalityResult.ready
    ? {
        emoji: personalityResult.emoji,
        name: personalityResult.name,
        tagline: personalityResult.description,
      }
    : null;

  // Realtime: refetch recent votes whenever this user casts a new vote
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!targetId) return;
    const channel = supabase
      .channel(`profile-votes-${targetId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'votes', filter: `user_id=eq.${targetId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['public-recent-votes', targetId] });
          queryClient.invalidateQueries({ queryKey: ['public-vote-count', targetId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [targetId, queryClient]);

  return (
    <AppLayout>
      <div className="p-4 space-y-5 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-secondary/50">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="text-lg font-display font-bold text-foreground">Profile</h1>
        </div>

        {/* Profile Card — IG bio style */}
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-4">
            <UserAvatar
              url={(profileData as any)?.avatar_url}
              username={profileData?.username}
              className="w-16 h-16"
              fallbackClassName="bg-gradient-to-br from-primary to-accent"
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-display font-bold text-foreground truncate">
                  @{profileData?.username || 'user'}
                </h2>
                {isVerified && <VerifiedBadge size="sm" />}
              </div>
              {isVerified && verifiedCategory && (
                <p className="text-[10px] text-blue-500 font-medium">{verifiedCategory}</p>
              )}

              {personalityBio && (
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug break-words">
                  <span className="mr-1">{personalityBio.emoji}</span>
                  <span className="font-semibold text-foreground">{personalityBio.name}</span>
                  <span className="mx-1.5 text-muted-foreground/50">·</span>
                  <span>{personalityBio.tagline}</span>
                </p>
              )}

              <div className="flex items-center gap-4 mt-2 text-[11px]">
                <span><span className="font-bold text-foreground">{voteCount}</span> <span className="text-muted-foreground">votes</span></span>
                <span><span className="font-bold text-foreground">{followerCount}</span> <span className="text-muted-foreground">followers</span></span>
                <span><span className="font-bold text-foreground">{followingCount}</span> <span className="text-muted-foreground">following</span></span>
              </div>
            </div>
          </div>

          {user && !isOwnProfile && targetId && (
            <Button
              variant={isFollowing(targetId) ? 'outline' : 'default'}
              size="sm"
              className="w-full rounded-full h-8 text-xs mt-3"
              onClick={() => toggleFollow(targetId)}
            >
              {isFollowing(targetId) ? 'Following' : 'Follow'}
            </Button>
          )}

          {/* Badges strip */}
          {canViewFullProfile && earnedBadges.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/40 flex items-center gap-2 overflow-x-auto scrollbar-hide">
              {earnedBadges.slice(0, 10).map((b) => (
                <div
                  key={b.badge_id}
                  className="flex flex-col items-center shrink-0 w-12"
                  title={`${b.badge_name} — ${b.badge_description}`}
                >
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                    <Award className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-[8px] font-medium text-muted-foreground line-clamp-1 mt-0.5 w-full text-center">
                    {b.badge_name.replace(' Expert', '')}
                  </span>
                </div>
              ))}
              {earnedBadges.length > 10 && (
                <span className="text-[10px] text-muted-foreground shrink-0 px-1">
                  +{earnedBadges.length - 10}
                </span>
              )}
            </div>
          )}

          {/* Voting Patterns + Rank strip */}
          {canViewFullProfile && (patterns.length > 0 || rankInfo?.rank) && (
            <div className="mt-2 pt-2 border-t border-border/40 flex items-center gap-2 overflow-x-auto scrollbar-hide">
              {rankInfo?.rank && (
                <button
                  onClick={() => navigate('/leaderboard')}
                  className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 hover:bg-amber-500/25 transition-colors"
                >
                  <Trophy className="h-3 w-3" />
                  <span className="text-[10px] font-bold">#{rankInfo.rank}</span>
                </button>
              )}
              {patterns.length > 0 && <BarChart3 className="h-3 w-3 text-primary shrink-0" />}
              {patterns.map((p, i) => (
                <span
                  key={i}
                  className="text-[10px] text-foreground/80 leading-snug shrink-0 px-2 py-0.5 rounded-full bg-muted/40"
                >
                  {p}
                </span>
              ))}
            </div>
          )}

          {canViewFullProfile && topCategories.length > 0 && (
            <div className="mt-2 flex items-center gap-2 overflow-x-auto scrollbar-hide">
              <Users className="h-3 w-3 text-primary shrink-0" />
              {topCategories.map((cat, i) => (
                <span
                  key={`cat-${i}`}
                  className="text-[10px] font-medium text-primary shrink-0 px-2 py-0.5 rounded-full bg-primary/10"
                >
                  {cat}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Personality Type */}
        {/* Friends-only gate for non-friends viewing someone else's profile */}
        {!canViewFullProfile && targetId && (
          <div className="glass rounded-2xl p-6 text-center space-y-3 border border-primary/20">
            <div className="w-12 h-12 rounded-full bg-primary/10 mx-auto flex items-center justify-center">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-display font-bold text-foreground">Friends only</h3>
              <p className="text-xs text-muted-foreground mt-1 px-4">
                Add @{profileData?.username || 'this user'} as a friend to see their badges, rank, voting patterns, and recent votes.
              </p>
            </div>
            {hasPendingRequest(targetId) ? (
              <Button variant="outline" className="rounded-full" disabled>
                Request sent
              </Button>
            ) : (
              <Button
                className="rounded-full gap-2"
                onClick={() => sendRequest(targetId)}
                disabled={sendingRequest}
              >
                <UserPlus className="h-4 w-4" />
                Add friend
              </Button>
            )}
          </div>
        )}

        {/* Compare Votes — friends only (compact strip with agreement score) */}
        {canViewFullProfile && !isOwnProfile && targetId && (
          <button
            onClick={() => navigate(`/friends/${targetId}/compare`)}
            className="w-full glass rounded-full px-3 py-1.5 flex items-center gap-2 border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
          >
            <Heart className="h-3.5 w-3.5 text-primary shrink-0" />
            {compatScore !== null && compatScore !== undefined ? (
              <span className="text-[11px] text-foreground flex-1 text-left truncate">
                You agree <span className="font-bold text-primary">{compatScore}%</span> with @{profileData?.username}
              </span>
            ) : (
              <span className="text-[11px] text-foreground flex-1 text-left truncate">
                Compare votes with @{profileData?.username}
              </span>
            )}
            <span className="text-[11px] font-semibold text-primary shrink-0">Compare →</span>
          </button>
        )}


        {/* Recent Voted Polls */}
        {canViewFullProfile && recentVotes.length > 0 && (
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Recent Votes
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {recentVotes.map((p) => {
                const showChoice = isOwnProfile;
                const chosenIsA = p.choice === 'A';
                const chosenLabel = chosenIsA ? p.option_a : p.option_b;
                const imgA = getPollDisplayImageSrc({ imageUrl: p.image_a_url, option: p.option_a, question: p.question, side: 'A' });
                const imgB = getPollDisplayImageSrc({ imageUrl: p.image_b_url, option: p.option_b, question: p.question, side: 'B' });
                return (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/poll/${p.id}`)}
                    className="relative rounded-xl overflow-hidden bg-muted active:scale-95 transition-transform"
                    style={{ aspectRatio: '4/5' }}
                  >
                    <div className="absolute inset-0 flex">
                      <div className="w-1/2 h-full overflow-hidden">
                        <img src={imgA} alt={p.option_a} className="w-full h-full object-cover" onError={(e) => handlePollImageError(e, { option: p.option_a, question: p.question, side: 'A' })} />
                      </div>
                      <div className="w-1/2 h-full overflow-hidden">
                        <img src={imgB} alt={p.option_b} className="w-full h-full object-cover" onError={(e) => handlePollImageError(e, { option: p.option_b, question: p.question, side: 'B' })} />
                      </div>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                    <div className="absolute bottom-1.5 left-1.5 right-1.5">
                      <p className="text-white text-[9px] font-bold leading-tight line-clamp-2 drop-shadow-lg">
                        {p.question}
                      </p>
                      {showChoice && (
                        <p className="text-white/90 text-[8px] mt-0.5 truncate">
                          Picked: <span className="font-semibold">{chosenLabel}</span>
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Personality Type Compatibility */}
        {canViewFullProfile && user && !isOwnProfile && targetId && (
          <PersonalityCompatibility targetUserId={targetId} targetUsername={profileData?.username} />
        )}

      </div>
    </AppLayout>
  );
}