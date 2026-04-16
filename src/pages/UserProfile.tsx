import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { ArrowLeft, Flame, Zap, Users, BarChart3, Heart, Trophy, Award, Lock, UserPlus } from 'lucide-react';
import { useFollows } from '@/hooks/useFollows';
import { useFriends } from '@/hooks/useFriends';
import { useVerifiedUser } from '@/hooks/useVerifiedUsers';
import VerifiedBadge from '@/components/VerifiedBadge';
import { Button } from '@/components/ui/button';
import PersonalityTypeCard from '@/components/profile/PersonalityTypeCard';
import PersonalityCompatibility from '@/components/profile/PersonalityCompatibility';
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
        .limit(6);
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

        {/* Profile Card */}
        <div className="glass rounded-3xl p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent mx-auto mb-4 flex items-center justify-center">
            <span className="text-3xl font-display font-bold text-primary-foreground">
              {profileData?.username?.[0]?.toUpperCase() || '?'}
            </span>
          </div>
          
          <div className="flex items-center justify-center gap-1.5">
            <h2 className="text-xl font-display font-bold text-foreground">
              @{profileData?.username || 'user'}
            </h2>
            {isVerified && <VerifiedBadge size="lg" />}
          </div>
          {isVerified && verifiedCategory && (
            <p className="text-xs text-blue-500 font-medium mt-1">{verifiedCategory}</p>
          )}

          {/* Follow button for non-own profiles */}
          {user && !isOwnProfile && targetId && (
            <Button
              variant={isFollowing(targetId) ? 'outline' : 'default'}
              size="sm"
              className="mt-3 rounded-full px-6"
              onClick={() => toggleFollow(targetId)}
            >
              {isFollowing(targetId) ? 'Following' : 'Follow'}
            </Button>
          )}

          {/* Follower / Following counts */}
          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold text-foreground">{followerCount}</span>
              <span className="text-[10px] text-muted-foreground">Followers</span>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold text-foreground">{followingCount}</span>
              <span className="text-[10px] text-muted-foreground">Following</span>
            </div>
          </div>
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

        {/* Compare Votes CTA — friends only */}
        {canViewFullProfile && !isOwnProfile && targetId && (
          <Button
            variant="outline"
            className="w-full rounded-xl gap-2"
            onClick={() => navigate(`/friends/${targetId}/compare`)}
          >
            <Heart className="h-4 w-4" />
            Compare votes with @{profileData?.username}
          </Button>
        )}

        {/* Personality Type — friends only */}
        {canViewFullProfile && targetId && <PersonalityTypeCard userId={targetId} />}

        {/* Taste Patterns */}
        {canViewFullProfile && patterns.length > 0 && (
          <div className="glass rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Voting Patterns</span>
            </div>
            {patterns.map((p, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <p className="text-sm text-foreground/80">{p}</p>
              </div>
            ))}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="glass rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-foreground">{voteCount}</div>
            <div className="text-[10px] text-muted-foreground">Votes</div>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <Flame className="h-4 w-4 text-warning" />
              <span className="text-xl font-bold text-foreground">{profileData?.current_streak || 0}</span>
            </div>
            <div className="text-[10px] text-muted-foreground">Streak</div>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-xl font-bold text-foreground">{minorityCount}</span>
            </div>
            <div className="text-[10px] text-muted-foreground">Minority</div>
          </div>
        </div>

        {/* Leaderboard Rank */}
        {rankInfo?.rank && (
          <button
            onClick={() => navigate('/leaderboard')}
            className="w-full glass rounded-2xl p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors"
          >
            <div className="h-10 w-10 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
              <Trophy className="h-5 w-5 text-amber-500" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Global Rank</div>
              <div className="text-base font-bold text-foreground">
                #{rankInfo.rank} <span className="text-xs font-normal text-muted-foreground">of {rankInfo.total}</span>
              </div>
            </div>
            <span className="text-xs font-semibold text-primary">View →</span>
          </button>
        )}

        {/* Earned Badges */}
        {earnedBadges.length > 0 && (
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Award className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Badges Earned · {earnedBadges.length}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {earnedBadges.slice(0, 8).map((b) => (
                <div
                  key={b.badge_id}
                  className="flex flex-col items-center text-center"
                  title={b.badge_description}
                >
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-1">
                    <Award className="h-6 w-6 text-primary" />
                  </div>
                  <span className="text-[9px] font-semibold text-foreground line-clamp-2 leading-tight">
                    {b.badge_name}
                  </span>
                </div>
              ))}
            </div>
            {earnedBadges.length > 8 && (
              <p className="text-[10px] text-muted-foreground text-center mt-3">
                +{earnedBadges.length - 8} more
              </p>
            )}
          </div>
        )}

        {/* Top Categories */}
        {topCategories.length > 0 && (
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Votes Most In</span>
            </div>
            <div className="flex gap-2">
              {topCategories.map((cat, i) => (
                <span key={i} className="px-3 py-1.5 rounded-full bg-primary/10 text-xs font-medium text-primary">
                  {cat}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recent Voted Polls */}
        {recentVotes.length > 0 && (
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
        {user && !isOwnProfile && targetId && (
          <PersonalityCompatibility targetUserId={targetId} targetUsername={profileData?.username} />
        )}

        {/* Agreement Score */}
        {compatScore !== null && compatScore !== undefined && !isOwnProfile && (
          <div className="glass rounded-2xl p-4 border border-primary/20 bg-primary/5 space-y-3">
            <p className="text-sm text-center text-foreground">
              You and <span className="font-bold">@{profileData?.username}</span> agree{' '}
              <span className="text-lg font-bold text-primary">{compatScore}%</span> of the time
            </p>
            <Button
              variant="outline"
              className="w-full rounded-xl gap-2"
              onClick={() => navigate('/compare')}
            >
              <Heart className="h-4 w-4" />
              Compare Votes
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}