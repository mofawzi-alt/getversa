import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { ArrowLeft, Sparkles, Check, Loader2 } from 'lucide-react';
import PollOptionImage from '@/components/poll/PollOptionImage';
import { toast } from 'sonner';

export default function BrandCampaign() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [voting, setVoting] = useState(false);

  // Fetch campaign + polls + user votes
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['brand-campaign', id, user?.id],
    queryFn: async () => {
      if (!id) return null;
      const { data: campaign } = await supabase
        .from('poll_campaigns')
        .select('id, name, brand_name, brand_logo_url, description, release_at, expires_at, is_active')
        .eq('id', id)
        .maybeSingle();
      if (!campaign) return null;

      const { data: links } = await supabase
        .from('campaign_polls')
        .select('poll_id')
        .eq('campaign_id', id);
      const pollIds = (links || []).map((l) => l.poll_id);

      const { data: polls } = await supabase
        .from('polls')
        .select('*')
        .in('id', pollIds);

      let votedMap: Record<string, string> = {};
      if (user && pollIds.length > 0) {
        const { data: votes } = await supabase
          .from('votes')
          .select('poll_id, choice')
          .eq('user_id', user.id)
          .in('poll_id', pollIds);
        votedMap = Object.fromEntries((votes || []).map((v) => [v.poll_id, v.choice]));
      }

      // Order: unvoted first (preserve campaign order), then voted
      const ordered = [...(polls || [])].sort((a, b) => {
        const aVoted = votedMap[a.id] ? 1 : 0;
        const bVoted = votedMap[b.id] ? 1 : 0;
        return aVoted - bVoted;
      });

      return { campaign, polls: ordered, votedMap };
    },
    enabled: !!id,
  });

  const currentIndex = useMemo(() => {
    if (!data) return 0;
    return data.polls.findIndex((p) => !data.votedMap[p.id]);
  }, [data]);

  const total = data?.polls.length || 0;
  const completed = data ? data.polls.length - data.polls.filter((p) => !data.votedMap[p.id]).length : 0;
  const allDone = data && currentIndex === -1;

  const handleVote = async (choice: 'A' | 'B') => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!data || currentIndex < 0 || voting) return;
    const poll = data.polls[currentIndex];
    setVoting(true);
    try {
      const { error } = await supabase.from('votes').insert({
        user_id: user.id,
        poll_id: poll.id,
        choice,
        category: poll.category,
      });
      if (error) throw error;
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['active-brand-campaign'] });
    } catch (e: any) {
      toast.error(e.message || 'Vote failed');
    } finally {
      setVoting(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!data) {
    return (
      <AppLayout>
        <div className="p-6 text-center">
          <p className="text-muted-foreground">Campaign not found.</p>
          <button onClick={() => navigate('/home')} className="mt-4 text-sm text-primary underline">
            Back to home
          </button>
        </div>
      </AppLayout>
    );
  }

  const { campaign } = data;
  const brand = campaign.brand_name || campaign.name;
  const currentPoll = currentIndex >= 0 ? data.polls[currentIndex] : null;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <AppLayout>
      <div className="px-4 pt-3 pb-6 max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/home')} className="p-2 -ml-2 rounded-full hover:bg-accent">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-primary font-semibold">Brand Pack</div>
            <div className="text-base font-bold truncate">{brand}</div>
          </div>
          {campaign.brand_logo_url && (
            <img
              src={campaign.brand_logo_url}
              alt={brand}
              className="w-10 h-10 rounded-full object-cover border border-border"
            />
          )}
        </div>

        {/* Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>{completed} of {total}</span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {allDone ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <Check className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold mb-2">All done!</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Thanks for sharing your opinion on {brand}.
            </p>
            <button
              onClick={() => navigate('/home')}
              className="px-6 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold"
            >
              Back to home
            </button>
          </div>
        ) : currentPoll ? (
          <div>
            <h2 className="text-lg font-bold mb-1 leading-snug">{currentPoll.question}</h2>
            {currentPoll.subtitle && (
              <p className="text-xs text-muted-foreground mb-3">{currentPoll.subtitle}</p>
            )}
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                onClick={() => handleVote('A')}
                disabled={voting}
                className="aspect-[4/5] rounded-2xl overflow-hidden bg-muted relative active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                <PollOptionImage
                  imageUrl={currentPoll.image_a_url}
                  option={currentPoll.option_a}
                  question={currentPoll.question}
                  side="A"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
                  <div className="text-white text-sm font-semibold text-center">{currentPoll.option_a}</div>
                </div>
              </button>
              <button
                onClick={() => handleVote('B')}
                disabled={voting}
                className="aspect-[4/5] rounded-2xl overflow-hidden bg-muted relative active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                <PollOptionImage
                  imageUrl={currentPoll.image_b_url}
                  option={currentPoll.option_b}
                  question={currentPoll.question}
                  side="B"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
                  <div className="text-white text-sm font-semibold text-center">{currentPoll.option_b}</div>
                </div>
              </button>
            </div>
            <div className="mt-4 text-center">
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                Question {completed + 1} of {total}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
