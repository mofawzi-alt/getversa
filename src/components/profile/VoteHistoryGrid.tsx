import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { History, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import PollOptionImage from '@/components/poll/PollOptionImage';

interface Props {
  userId: string;
}

export default function VoteHistoryGrid({ userId }: Props) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(true);

  const { data: history = [] } = useQuery({
    queryKey: ['vote-history-grid', userId],
    queryFn: async () => {
      const { data: votes } = await supabase
        .from('votes')
        .select('poll_id, choice, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(12);
      if (!votes?.length) return [];
      const ids = votes.map(v => v.poll_id);
      const { data: polls } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, image_a_url, image_b_url')
        .in('id', ids);
      const pollMap = new Map(polls?.map(p => [p.id, p]) || []);
      return votes
        .map(v => ({ ...v, poll: pollMap.get(v.poll_id) }))
        .filter(v => v.poll);
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
  });

  if (!history.length) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 flex-1"
          aria-expanded={expanded}
        >
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Recent Votes
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        {expanded && (
          <button
            onClick={() => navigate('/history')}
            className="flex items-center text-muted-foreground"
            aria-label="See all"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {expanded && (
        <div className="grid grid-cols-3 gap-1.5">
          {history.map((v: any) => {
            const p = v.poll;
            const userPickedA = v.choice === 'A';
            return (
              <button
                key={v.poll_id + v.created_at}
                onClick={() => navigate('/history')}
                className="relative aspect-square rounded-lg overflow-hidden border border-border/50 active:scale-95 transition-transform"
              >
                <div className="flex h-full">
                  <div className="w-1/2 h-full relative overflow-hidden">
                    <PollOptionImage
                      imageUrl={p.image_a_url}
                      option={p.option_a}
                      question={p.question}
                      side="A"
                      maxLogoSize="55%"
                      loading="lazy"
                      variant="browse"
                    />
                    {userPickedA && (
                      <div className="absolute inset-0 ring-2 ring-inset ring-primary pointer-events-none" />
                    )}
                  </div>
                  <div className="absolute inset-y-0 left-1/2 w-px bg-white/30 z-10" />
                  <div className="w-1/2 h-full relative overflow-hidden">
                    <PollOptionImage
                      imageUrl={p.image_b_url}
                      option={p.option_b}
                      question={p.question}
                      side="B"
                      maxLogoSize="55%"
                      loading="lazy"
                      variant="browse"
                    />
                    {!userPickedA && (
                      <div className="absolute inset-0 ring-2 ring-inset ring-primary pointer-events-none" />
                    )}
                  </div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
