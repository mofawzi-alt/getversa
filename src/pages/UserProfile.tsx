import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { ArrowLeft, Flame, Zap, Users, BarChart3, Sparkles } from 'lucide-react';
import { useFollows } from '@/hooks/useFollows';
import { useVerifiedUser } from '@/hooks/useVerifiedUsers';
import VerifiedBadge from '@/components/VerifiedBadge';
import { Button } from '@/components/ui/button';

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
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isFollowing, toggleFollow } = useFollows();
  const { isVerified, category: verifiedCategory } = useVerifiedUser(userId);
  const isOwnProfile = user?.id === userId;

  // Public profile data
  const { data: profileData } = useQuery({
    queryKey: ['public-profile', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase.rpc('get_public_profiles', { user_ids: [userId] });
      return data?.[0] || null;
    },
    enabled: !!userId,
  });

  // Vote count
  const { data: voteCount = 0 } = useQuery({
    queryKey: ['public-vote-count', userId],
    queryFn: async () => {
      if (!userId) return 0;
      const { count } = await supabase.from('votes').select('id', { count: 'exact' }).eq('user_id', userId);
      return count || 0;
    },
    enabled: !!userId,
  });

  // Voting traits for archetype
  const { data: traits = [] } = useQuery({
    queryKey: ['public-traits', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase.rpc('get_user_voting_traits', { p_user_id: userId });
      return (data || []) as { tag: string; vote_count: number }[];
    },
    enabled: !!userId,
  });

  // Top categories
  const { data: topCategories = [] } = useQuery({
    queryKey: ['public-top-categories', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase.from('votes').select('category').eq('user_id', userId).not('category', 'is', null);
      if (!data) return [];
      const counts: Record<string, number> = {};
      data.forEach(v => { if (v.category) counts[v.category] = (counts[v.category] || 0) + 1; });
      return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([cat]) => cat);
    },
    enabled: !!userId,
  });

  // Minority vote count (votes where user was in minority)
  const { data: minorityCount = 0 } = useQuery({
    queryKey: ['public-minority', userId],
    queryFn: async () => {
      if (!userId) return 0;
      // Get user's votes with poll results
      const { data: userVotes } = await supabase.from('votes').select('poll_id, choice').eq('user_id', userId);
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
    enabled: !!userId,
  });

  // Compatibility score (only for logged-in users viewing someone else)
  const { data: compatScore } = useQuery({
    queryKey: ['compat-score', user?.id, userId],
    queryFn: async () => {
      if (!user?.id || !userId || user.id === userId) return null;
      const { data } = await supabase.rpc('get_compatibility_score', { user_a: user.id, user_b: userId });
      return data as number | null;
    },
    enabled: !!user?.id && !!userId && user?.id !== userId,
  });

  // Follower / following counts
  const { data: followerCount = 0 } = useQuery({
    queryKey: ['public-follower-count', userId],
    queryFn: async () => {
      if (!userId) return 0;
      const { count } = await supabase.from('follows').select('id', { count: 'exact' }).eq('following_id', userId);
      return count || 0;
    },
    enabled: !!userId,
  });

  const { data: followingCount = 0 } = useQuery({
    queryKey: ['public-following-count', userId],
    queryFn: async () => {
      if (!userId) return 0;
      const { count } = await supabase.from('follows').select('id', { count: 'exact' }).eq('follower_id', userId);
      return count || 0;
    },
    enabled: !!userId,
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
          {user && !isOwnProfile && userId && (
            <Button
              variant={isFollowing(userId) ? 'outline' : 'default'}
              size="sm"
              className="mt-3 rounded-full px-6"
              onClick={() => toggleFollow(userId)}
            >
              {isFollowing(userId) ? 'Following' : 'Follow'}
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

        {/* Taste Archetype */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Taste Identity</span>
          </div>
          <h3 className="text-2xl font-display font-bold text-foreground">{archetype.name}</h3>
          <p className="text-sm text-muted-foreground mt-1">{archetype.description}</p>
        </div>

        {/* Taste Patterns */}
        {patterns.length > 0 && (
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

        {/* Agreement Score */}
        {compatScore !== null && compatScore !== undefined && !isOwnProfile && (
          <div className="glass rounded-2xl p-4 border border-primary/20 bg-primary/5">
            <p className="text-sm text-center text-foreground">
              You and <span className="font-bold">@{profileData?.username}</span> agree{' '}
              <span className="text-lg font-bold text-primary">{compatScore}%</span> of the time
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}