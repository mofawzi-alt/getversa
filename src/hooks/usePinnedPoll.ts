import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function usePinnedPoll() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // User's personal pin
  const { data: userPin } = useQuery({
    queryKey: ['user-pinned-poll', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const now = new Date().toISOString();
      const { data } = await supabase
        .from('pinned_polls' as any)
        .select('*')
        .eq('user_id', user.id)
        .gte('expires_at', now)
        .maybeSingle();
      return data;
    },
    staleTime: 1000 * 30,
    enabled: !!user,
  });

  // Admin featured poll (global)
  const { data: featuredPoll } = useQuery({
    queryKey: ['featured-poll'],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from('featured_polls' as any)
        .select('*')
        .gte('expires_at', now)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 1000 * 30,
  });

  // The active pinned poll_id (user pin takes priority, then admin feature)
  const pinnedPollId = (userPin as any)?.poll_id || (featuredPoll as any)?.poll_id || null;
  const isAdminFeatured = !!(featuredPoll as any)?.poll_id && !(userPin as any)?.poll_id;

  // Fetch the actual poll data + results
  const { data: pinnedPollData } = useQuery({
    queryKey: ['pinned-poll-data', pinnedPollId],
    queryFn: async () => {
      if (!pinnedPollId) return null;
      const { data: poll } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, image_a_url, image_b_url, category, starts_at, ends_at, target_gender')
        .eq('id', pinnedPollId)
        .single();
      if (!poll) return null;
      const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: [pinnedPollId] });
      const r = results?.[0] as any;
      return {
        ...poll,
        totalVotes: Number(r?.total_votes || 0),
        percentA: r?.percent_a || 50,
        percentB: r?.percent_b || 50,
        votesA: Number(r?.votes_a || 0),
        votesB: Number(r?.votes_b || 0),
      };
    },
    staleTime: 1000 * 15,
    refetchInterval: 1000 * 30, // Real-time refresh every 30s
    enabled: !!pinnedPollId,
  });

  // Gender split for demographic highlight
  const { data: genderSplit } = useQuery({
    queryKey: ['pinned-poll-gender-split', pinnedPollId],
    queryFn: async () => {
      if (!pinnedPollId) return null;
      const { data: votes } = await supabase
        .from('votes')
        .select('choice, voter_gender')
        .eq('poll_id', pinnedPollId)
        .not('voter_gender', 'is', null)
        .limit(500);
      if (!votes || votes.length === 0) return null;
      const male = votes.filter(v => v.voter_gender === 'Male');
      const female = votes.filter(v => v.voter_gender === 'Female');
      if (male.length < 3 && female.length < 3) return null;
      const maleA = male.length > 0 ? Math.round((male.filter(v => v.choice === 'A').length / male.length) * 100) : 50;
      const femaleA = female.length > 0 ? Math.round((female.filter(v => v.choice === 'A').length / female.length) * 100) : 50;
      return { maleA, femaleA, maleCount: male.length, femaleCount: female.length };
    },
    staleTime: 1000 * 60,
    enabled: !!pinnedPollId,
  });

  // Realtime subscription
  useEffect(() => {
    if (!pinnedPollId) return;
    const channel = supabase
      .channel(`pinned-poll-${pinnedPollId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'votes', filter: `poll_id=eq.${pinnedPollId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['pinned-poll-data', pinnedPollId] });
        queryClient.invalidateQueries({ queryKey: ['pinned-poll-gender-split', pinnedPollId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [pinnedPollId, queryClient]);

  // Pin mutation
  const pinPoll = useMutation({
    mutationFn: async (pollId: string) => {
      if (!user) throw new Error('Not authenticated');
      // Upsert — delete existing then insert
      await supabase.from('pinned_polls' as any).delete().eq('user_id', user.id);
      const midnight = new Date();
      midnight.setDate(midnight.getDate() + 1);
      midnight.setHours(0, 0, 0, 0);
      const { error } = await supabase.from('pinned_polls' as any).insert({
        user_id: user.id,
        poll_id: pollId,
        expires_at: midnight.toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-pinned-poll'] });
    },
  });

  const unpinPoll = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('pinned_polls' as any).delete().eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-pinned-poll'] });
    },
  });

  return {
    pinnedPollData,
    genderSplit,
    isAdminFeatured,
    isPinned: !!pinnedPollId,
    userPinId: (userPin as any)?.poll_id as string | null,
    pinPoll,
    unpinPoll,
  };
}

// Admin feature hook
export function useAdminFeaturePoll() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const featurePoll = useMutation({
    mutationFn: async (pollId: string) => {
      if (!user) throw new Error('Not authenticated');
      // Remove existing featured polls
      await supabase.from('featured_polls' as any).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      const midnight = new Date();
      midnight.setDate(midnight.getDate() + 1);
      midnight.setHours(0, 0, 0, 0);
      const { error } = await supabase.from('featured_polls' as any).insert({
        poll_id: pollId,
        created_by: user.id,
        expires_at: midnight.toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['featured-poll'] });
    },
  });

  const unfeaturePoll = useMutation({
    mutationFn: async () => {
      await supabase.from('featured_polls' as any).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['featured-poll'] });
    },
  });

  return { featurePoll, unfeaturePoll };
}
