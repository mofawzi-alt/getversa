import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, TrendingUp, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface SearchablePoll {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  category: string | null;
  is_active: boolean | null;
  totalVotes: number;
  percentA: number;
  percentB: number;
  userVoted: boolean;
  userChoice?: string;
}

interface GlobalPollSearchProps {
  open: boolean;
  onClose: () => void;
}

export default function GlobalPollSearch({ open, onClose }: GlobalPollSearchProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Close on escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Fetch polls + user votes
  const { data: allPolls = [], isLoading } = useQuery({
    queryKey: ['global-poll-search', user?.id],
    queryFn: async () => {
      const { data: polls } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, category, is_active')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(500);

      if (!polls || polls.length === 0) return [];

      const pollIds = polls.map(p => p.id);
      const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: pollIds });
      const resultsMap = new Map((results || []).map((r: any) => [r.poll_id, r]));

      let userVotesMap = new Map<string, string>();
      if (user) {
        const { data: votes } = await supabase
          .from('votes')
          .select('poll_id, choice')
          .eq('user_id', user.id)
          .in('poll_id', pollIds);
        (votes || []).forEach(v => userVotesMap.set(v.poll_id, v.choice));
      }

      return polls.map(p => {
        const r = resultsMap.get(p.id);
        return {
          id: p.id,
          question: p.question,
          option_a: p.option_a,
          option_b: p.option_b,
          category: p.category,
          is_active: p.is_active,
          totalVotes: r?.total_votes || 0,
          percentA: r?.percent_a || 0,
          percentB: r?.percent_b || 0,
          userVoted: userVotesMap.has(p.id),
          userChoice: userVotesMap.get(p.id),
        } as SearchablePoll;
      });
    },
    enabled: open,
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    if (!query.trim()) return allPolls.slice(0, 20); // Show trending when no query
    const q = query.toLowerCase();
    return allPolls.filter(p =>
      p.question.toLowerCase().includes(q) ||
      p.option_a.toLowerCase().includes(q) ||
      p.option_b.toLowerCase().includes(q) ||
      (p.category && p.category.toLowerCase().includes(q))
    ).slice(0, 30);
  }, [allPolls, query]);

  const handlePollClick = (poll: SearchablePoll) => {
    onClose();
    if (poll.userVoted) {
      navigate(`/history?pollId=${poll.id}`);
    } else {
      navigate('/home');
    }
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex flex-col"
        >
          {/* Header */}
          <div className="px-4 pt-4 pb-2 flex items-center gap-3 safe-area-top">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                placeholder="Search polls, options, categories..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10 h-11 text-base"
              />
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-secondary text-muted-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto px-4 pb-8">
            {!query.trim() && (
              <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" /> Popular polls
              </p>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <Search className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No polls found for "{query}"</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(poll => (
                  <button
                    key={poll.id}
                    onClick={() => handlePollClick(poll)}
                    className="w-full text-left glass rounded-xl p-3.5 hover:bg-secondary/50 transition-colors"
                  >
                    <p className="text-sm font-semibold text-foreground leading-snug mb-1.5">
                      {poll.question}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {poll.totalVotes.toLocaleString()}
                      </span>
                      {poll.category && (
                        <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                          {poll.category}
                        </span>
                      )}
                      {poll.userVoted && (
                        <span className="px-1.5 py-0.5 rounded-full bg-accent/10 text-accent-foreground text-[10px] font-medium">
                          Voted
                        </span>
                      )}
                    </div>
                    {poll.userVoted && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full rounded-full bg-option-a"
                            style={{ width: `${poll.percentA}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground font-medium w-16 text-right">
                          {poll.percentA}% – {poll.percentB}%
                        </span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
