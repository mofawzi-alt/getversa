import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Lock, CheckCircle2, Sparkles, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface CampaignInfo {
  id: string;
  name: string;
  brand_name: string | null;
  brand_logo_url: string | null;
  description: string | null;
  panel_incentive_points: number | null;
  is_active: boolean;
  campaign_type: string;
}

interface PanelistRow {
  status: string;
}

interface PollRow {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  image_a_url: string | null;
  image_b_url: string | null;
}

export default function FocusGroup() {
  const { id: campaignId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const qc = useQueryClient();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [feedbackDraft, setFeedbackDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: campaign, isLoading: cLoading } = useQuery({
    queryKey: ['focus-group-campaign', campaignId],
    queryFn: async (): Promise<CampaignInfo | null> => {
      const { data, error } = await supabase
        .from('poll_campaigns')
        .select('id, name, brand_name, brand_logo_url, description, panel_incentive_points, is_active, campaign_type')
        .eq('id', campaignId!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!campaignId && !!user,
  });

  const { data: panelist, isLoading: pLoading } = useQuery({
    queryKey: ['focus-group-panelist', campaignId, user?.id],
    queryFn: async (): Promise<PanelistRow | null> => {
      const { data } = await supabase
        .from('campaign_panelists')
        .select('status')
        .eq('campaign_id', campaignId!)
        .eq('user_id', user!.id)
        .maybeSingle();
      return data as any;
    },
    enabled: !!campaignId && !!user,
  });

  const { data: polls = [], isLoading: pollsLoading } = useQuery({
    queryKey: ['focus-group-polls', campaignId],
    queryFn: async (): Promise<PollRow[]> => {
      const { data, error } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, image_a_url, image_b_url')
        .eq('campaign_id', campaignId!)
        .eq('is_active', true)
        .order('created_at');
      if (error) throw error;
      return (data || []) as any;
    },
    enabled: !!campaignId && !!user && panelist?.status === 'accepted',
  });

  const { data: myVotes = [] } = useQuery({
    queryKey: ['focus-group-votes', campaignId, user?.id],
    queryFn: async (): Promise<string[]> => {
      if (!polls.length) return [];
      const { data } = await supabase
        .from('votes')
        .select('poll_id')
        .eq('user_id', user!.id)
        .in('poll_id', polls.map((p) => p.id));
      return (data || []).map((r) => r.poll_id);
    },
    enabled: !!user && polls.length > 0,
  });

  const remainingPolls = useMemo(
    () => polls.filter((p) => !myVotes.includes(p.id)),
    [polls, myVotes]
  );
  const currentPoll = remainingPolls[currentIdx];
  const progressPct = polls.length > 0 ? Math.round((myVotes.length / polls.length) * 100) : 0;

  // Auto-mark accepted on first visit if status is 'invited'
  useEffect(() => {
    if (panelist?.status === 'invited' && user && campaignId) {
      supabase
        .from('campaign_panelists')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('campaign_id', campaignId)
        .eq('user_id', user.id)
        .then(() => qc.invalidateQueries({ queryKey: ['focus-group-panelist', campaignId, user.id] }));
    }
  }, [panelist, user, campaignId, qc]);

  // Mark completed when all polls voted
  useEffect(() => {
    if (
      polls.length > 0 &&
      myVotes.length >= polls.length &&
      panelist?.status === 'accepted' &&
      user &&
      campaignId
    ) {
      supabase
        .from('campaign_panelists')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('campaign_id', campaignId)
        .eq('user_id', user.id)
        .then(async () => {
          // Award incentive points
          const incentive = campaign?.panel_incentive_points ?? 0;
          if (incentive > 0 && user) {
            const { data: u } = await supabase.from('users').select('points').eq('id', user.id).single();
            await supabase.from('users').update({ points: (u?.points || 0) + incentive }).eq('id', user.id);
          }
          qc.invalidateQueries({ queryKey: ['focus-group-panelist', campaignId, user.id] });
        });
    }
  }, [polls.length, myVotes.length, panelist, user, campaignId, campaign?.panel_incentive_points, qc]);

  if (authLoading || cLoading || pLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-background">
        <Lock className="w-10 h-10 text-muted-foreground mb-4" />
        <h1 className="text-lg font-bold mb-2">Sign in required</h1>
        <p className="text-sm text-muted-foreground mb-4">This is a private research panel.</p>
        <Button onClick={() => navigate('/auth')}>Sign in</Button>
      </div>
    );
  }

  if (!campaign || campaign.campaign_type !== 'focus_group' || !campaign.is_active) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-background">
        <Lock className="w-10 h-10 text-muted-foreground mb-4" />
        <h1 className="text-lg font-bold mb-2">Panel unavailable</h1>
        <p className="text-sm text-muted-foreground mb-4">This focus group isn't active right now.</p>
        <Button variant="outline" onClick={() => navigate('/home')}>Back home</Button>
      </div>
    );
  }

  if (!panelist) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-background">
        <Lock className="w-10 h-10 text-muted-foreground mb-4" />
        <h1 className="text-lg font-bold mb-2">You're not on this panel</h1>
        <p className="text-sm text-muted-foreground mb-4">
          This is a private invite-only research study.
        </p>
        <Button variant="outline" onClick={() => navigate('/home')}>Back home</Button>
      </div>
    );
  }

  // Completed screen
  if (panelist.status === 'completed' || (polls.length > 0 && myVotes.length >= polls.length)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-background">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
          <CheckCircle2 className="w-16 h-16 text-primary mb-4" />
        </motion.div>
        <h1 className="text-2xl font-bold mb-2">Thank you!</h1>
        <p className="text-sm text-muted-foreground mb-1">
          Your responses help shape {campaign.brand_name || 'this brand'}'s next move.
        </p>
        {campaign.panel_incentive_points && campaign.panel_incentive_points > 0 && (
          <p className="text-base font-semibold text-primary mb-6">
            +{campaign.panel_incentive_points} points awarded
          </p>
        )}
        <Button onClick={() => navigate('/home')}>Back to Versa</Button>
      </div>
    );
  }

  // Loading polls
  if (pollsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!currentPoll) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleVote = async (choice: 'A' | 'B') => {
    if (!user || !currentPoll || submitting) return;
    setSubmitting(true);
    try {
      // Record vote
      const { error: vErr } = await supabase.from('votes').insert({
        poll_id: currentPoll.id,
        user_id: user.id,
        choice,
        category: 'focus_group',
      });
      if (vErr && vErr.code !== '23505') throw vErr;

      // Record verbatim if provided
      if (feedbackDraft.trim().length >= 3) {
        await supabase.from('poll_verbatim_feedback').insert({
          poll_id: currentPoll.id,
          user_id: user.id,
          choice,
          feedback: feedbackDraft.trim().slice(0, 1000),
        });
      }

      setFeedbackDraft('');
      qc.invalidateQueries({ queryKey: ['focus-group-votes', campaignId, user.id] });
      // Move to next (index stays since myVotes will refresh and remove current)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <button onClick={() => navigate('/home')} className="text-muted-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center flex-1 px-3">
          <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-primary font-semibold">
            <Sparkles className="w-3 h-3" />
            Private Panel
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {campaign.brand_name || campaign.name}
          </div>
        </div>
        <div className="text-xs font-semibold text-muted-foreground w-10 text-right">
          {myVotes.length}/{polls.length}
        </div>
      </div>

      {/* Progress */}
      <div className="h-1 bg-muted">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      {/* Poll */}
      <div className="flex-1 flex flex-col px-4 py-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPoll.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex-1 flex flex-col"
          >
            <h2 className="text-lg font-bold mb-4 text-center">{currentPoll.question}</h2>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => handleVote('A')}
                disabled={submitting}
                className="aspect-[3/4] rounded-2xl border border-border bg-muted/40 overflow-hidden flex flex-col active:scale-95 transition disabled:opacity-50"
              >
                {currentPoll.image_a_url ? (
                  <img src={currentPoll.image_a_url} alt={currentPoll.option_a} className="flex-1 w-full object-cover" />
                ) : (
                  <div className="flex-1 bg-gradient-to-br from-green-100 to-green-200" />
                )}
                <div className="p-2 text-sm font-semibold text-center truncate">{currentPoll.option_a}</div>
              </button>

              <button
                onClick={() => handleVote('B')}
                disabled={submitting}
                className="aspect-[3/4] rounded-2xl border border-border bg-muted/40 overflow-hidden flex flex-col active:scale-95 transition disabled:opacity-50"
              >
                {currentPoll.image_b_url ? (
                  <img src={currentPoll.image_b_url} alt={currentPoll.option_b} className="flex-1 w-full object-cover" />
                ) : (
                  <div className="flex-1 bg-gradient-to-br from-blue-100 to-blue-200" />
                )}
                <div className="p-2 text-sm font-semibold text-center truncate">{currentPoll.option_b}</div>
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                Tell us why (optional but really helpful)
              </label>
              <Textarea
                value={feedbackDraft}
                onChange={(e) => setFeedbackDraft(e.target.value)}
                placeholder="Share what shaped your choice…"
                rows={3}
                maxLength={1000}
                className="resize-none"
              />
              <p className="text-[10px] text-muted-foreground text-right">
                Anonymous to the brand · {feedbackDraft.length}/1000
              </p>
            </div>
          </motion.div>
        </AnimatePresence>

        {submitting && (
          <div className="text-center text-xs text-muted-foreground py-2">
            <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
            Saving…
          </div>
        )}
      </div>
    </div>
  );
}
