import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Loader2, ChevronRight, Clock, CheckCircle, Search, X, Share2 } from 'lucide-react';
import ShareButton from '@/components/poll/ShareButton';
import { formatDistanceToNow } from 'date-fns';
import { Input } from '@/components/ui/input';

interface PollWithVote {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  image_a_url: string | null;
  image_b_url: string | null;
  category: string | null;
  created_at: string;
  starts_at: string | null;
  ends_at: string | null;
  userChoice: 'A' | 'B' | null;
  percentA: number;
  percentB: number;
  totalVotes: number;
  isExpired: boolean;
}

export default function PollHistory() {
  const { user } = useAuth();
  const [selectedPoll, setSelectedPoll] = useState<PollWithVote | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');

  const { data: pollHistory, isLoading } = useQuery({
    queryKey: ['poll-history', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Use the security definer function to get all polls (bypasses RLS)
      const { data: allPolls, error: pollsError } = await supabase
        .rpc('get_all_polls_for_history');

      if (pollsError) throw pollsError;
      if (!allPolls || allPolls.length === 0) return [];

      // Get user's votes
      const { data: userVotes } = await supabase
        .from('votes')
        .select('poll_id, choice')
        .eq('user_id', user.id);

      const voteMap = new Map<string, 'A' | 'B'>(
        userVotes?.map(v => [v.poll_id, v.choice as 'A' | 'B']) || []
      );

      // Get poll results using the security definer function
      const pollIds = allPolls.map(p => p.id);
      const { data: results } = await supabase.rpc('get_poll_results', {
        poll_ids: pollIds
      });

      const resultsMap = new Map(
        results?.map((r: { poll_id: string; total_votes: number; percent_a: number; percent_b: number }) => [
          r.poll_id, 
          { totalVotes: r.total_votes, percentA: r.percent_a, percentB: r.percent_b }
        ]) || []
      );

      const now = new Date();
      
      return allPolls.map((poll) => {
        const result = resultsMap.get(poll.id) || { totalVotes: 0, percentA: 0, percentB: 0 };
        const isExpired = poll.ends_at ? new Date(poll.ends_at) < now : false;

        return {
          ...poll,
          userChoice: voteMap.get(poll.id) || null,
          percentA: result.percentA,
          percentB: result.percentB,
          totalVotes: result.totalVotes,
          isExpired,
        };
      });
    },
    enabled: !!user,
  });

  // Get unique categories for filter suggestions
  const categories = useMemo(() => {
    const cats = new Set<string>();
    pollHistory?.forEach(p => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats).sort();
  }, [pollHistory]);

  // Filter polls by category
  const filteredVotedPolls = useMemo(() => {
    const voted = pollHistory?.filter(p => p.userChoice) || [];
    if (!categoryFilter.trim()) return voted;
    return voted.filter(p => 
      p.category?.toLowerCase().includes(categoryFilter.toLowerCase())
    );
  }, [pollHistory, categoryFilter]);

  const filteredExpiredPolls = useMemo(() => {
    const expired = pollHistory?.filter(p => p.isExpired && !p.userChoice) || [];
    if (!categoryFilter.trim()) return expired;
    return expired.filter(p => 
      p.category?.toLowerCase().includes(categoryFilter.toLowerCase())
    );
  }, [pollHistory, categoryFilter]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen p-4 pb-24">
        <header className="mb-6">
          <h1 className="text-2xl font-display font-bold">Poll History</h1>
          <p className="text-sm text-muted-foreground">View your past votes and expired polls</p>
        </header>

        {/* Category Search/Filter */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by category..."
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="pl-10 pr-10"
          />
          {categoryFilter && (
            <button
              onClick={() => setCategoryFilter('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-secondary rounded-full"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Category Tags */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {categories.slice(0, 6).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  categoryFilter === cat 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Your Votes Section */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            Your Votes ({filteredVotedPolls.length})
          </h2>
          
          {filteredVotedPolls.length === 0 ? (
            <div className="glass rounded-2xl p-6 text-center">
              <p className="text-muted-foreground">
                {categoryFilter ? 'No polls found in this category' : "You haven't voted on any polls yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredVotedPolls.map((poll) => (
                <div
                  key={poll.id}
                  className="w-full glass rounded-2xl p-4 hover:bg-secondary/80 transition-all"
                >
                  <div className="flex items-center gap-3">
                    {(poll.image_a_url || poll.image_b_url) && (
                      <div className="flex -space-x-2 shrink-0">
                        {poll.image_a_url && (
                          <div className={`w-12 h-12 rounded-lg overflow-hidden border-2 ${poll.userChoice === 'A' ? 'border-option-a' : 'border-background'}`}>
                            <img src={poll.image_a_url} alt={poll.option_a} className="w-full h-full object-cover" />
                          </div>
                        )}
                        {poll.image_b_url && (
                          <div className={`w-12 h-12 rounded-lg overflow-hidden border-2 ${poll.userChoice === 'B' ? 'border-option-b' : 'border-background'}`}>
                            <img src={poll.image_b_url} alt={poll.option_b} className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>
                    )}
                    <button 
                      onClick={() => setSelectedPoll(poll)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <p className="font-medium line-clamp-1">{poll.question}</p>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <span className={poll.userChoice === 'A' ? 'text-option-a font-semibold' : ''}>
                          {poll.option_a} ({poll.percentA}%)
                        </span>
                        <span>vs</span>
                        <span className={poll.userChoice === 'B' ? 'text-option-b font-semibold' : ''}>
                          {poll.option_b} ({poll.percentB}%)
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        {poll.category && (
                          <span className="px-2 py-0.5 bg-secondary rounded-full">{poll.category}</span>
                        )}
                        <span>{formatDistanceToNow(new Date(poll.created_at), { addSuffix: true })}</span>
                        <span>·</span>
                        <span>{poll.totalVotes.toLocaleString()} votes</span>
                      </div>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <ShareButton
                        pollId={poll.id}
                        pollQuestion={poll.question}
                        optionA={poll.option_a}
                        optionB={poll.option_b}
                        percentA={poll.percentA}
                        percentB={poll.percentB}
                        showResults={true}
                        variant="icon"
                      />
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Expired Polls Section */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            Expired Polls ({filteredExpiredPolls.length})
          </h2>
          
          {filteredExpiredPolls.length === 0 ? (
            <div className="glass rounded-2xl p-6 text-center">
              <p className="text-muted-foreground">
                {categoryFilter ? 'No expired polls in this category' : 'No expired polls to show'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredExpiredPolls.map((poll) => (
                <div
                  key={poll.id}
                  className="w-full glass rounded-2xl p-4 opacity-70 hover:opacity-100 transition-all"
                >
                  <div className="flex items-center gap-3">
                    {(poll.image_a_url || poll.image_b_url) && (
                      <div className="flex -space-x-2 shrink-0">
                        {poll.image_a_url && (
                          <div className="w-12 h-12 rounded-lg overflow-hidden border-2 border-background">
                            <img src={poll.image_a_url} alt={poll.option_a} className="w-full h-full object-cover" />
                          </div>
                        )}
                        {poll.image_b_url && (
                          <div className="w-12 h-12 rounded-lg overflow-hidden border-2 border-background">
                            <img src={poll.image_b_url} alt={poll.option_b} className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>
                    )}
                    <button 
                      onClick={() => setSelectedPoll(poll)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <p className="font-medium line-clamp-1">{poll.question}</p>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <span>{poll.option_a} ({poll.percentA}%)</span>
                        <span>vs</span>
                        <span>{poll.option_b} ({poll.percentB}%)</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        {poll.category && (
                          <span className="px-2 py-0.5 bg-secondary rounded-full">{poll.category}</span>
                        )}
                        <span>Expired {poll.ends_at ? formatDistanceToNow(new Date(poll.ends_at), { addSuffix: true }) : ''}</span>
                        <span>·</span>
                        <span>{poll.totalVotes.toLocaleString()} votes</span>
                      </div>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <ShareButton
                        pollId={poll.id}
                        pollQuestion={poll.question}
                        optionA={poll.option_a}
                        optionB={poll.option_b}
                        percentA={poll.percentA}
                        percentB={poll.percentB}
                        showResults={true}
                        variant="icon"
                      />
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Poll Detail Modal - Results Only (No Demographics) */}
      {selectedPoll && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/90 backdrop-blur-lg animate-fade-in"
          onClick={() => setSelectedPoll(null)}
        >
          <div 
            className="w-full max-w-sm glass rounded-3xl p-6 shadow-card animate-bounce-in max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="text-xl font-display font-bold">{selectedPoll.question}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedPoll.totalVotes.toLocaleString()} total votes
              </p>
              {selectedPoll.category && (
                <span className="inline-block mt-2 px-3 py-1 bg-secondary text-secondary-foreground text-xs rounded-full">
                  {selectedPoll.category}
                </span>
              )}
              {selectedPoll.userChoice && (
                <p className="text-xs text-primary mt-2">
                  You voted: Option {selectedPoll.userChoice}
                </p>
              )}
            </div>

            {/* Poll Images */}
            {(selectedPoll.image_a_url || selectedPoll.image_b_url) && (
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className={`relative rounded-xl overflow-hidden aspect-square ${selectedPoll.userChoice === 'A' ? 'ring-2 ring-option-a' : ''}`}>
                  {selectedPoll.image_a_url ? (
                    <img src={selectedPoll.image_a_url} alt={selectedPoll.option_a} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-secondary flex items-center justify-center">
                      <span className="text-muted-foreground text-sm">{selectedPoll.option_a}</span>
                    </div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                    <span className="text-white text-xs font-medium">{selectedPoll.option_a}</span>
                  </div>
                  {selectedPoll.userChoice === 'A' && (
                    <div className="absolute top-2 right-2 bg-option-a text-option-a-foreground text-xs px-2 py-0.5 rounded-full font-medium">
                      Your vote
                    </div>
                  )}
                </div>
                <div className={`relative rounded-xl overflow-hidden aspect-square ${selectedPoll.userChoice === 'B' ? 'ring-2 ring-option-b' : ''}`}>
                  {selectedPoll.image_b_url ? (
                    <img src={selectedPoll.image_b_url} alt={selectedPoll.option_b} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-secondary flex items-center justify-center">
                      <span className="text-muted-foreground text-sm">{selectedPoll.option_b}</span>
                    </div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                    <span className="text-white text-xs font-medium">{selectedPoll.option_b}</span>
                  </div>
                  {selectedPoll.userChoice === 'B' && (
                    <div className="absolute top-2 right-2 bg-option-b text-option-b-foreground text-xs px-2 py-0.5 rounded-full font-medium">
                      Your vote
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Results with Percentages */}
            <div className="space-y-4 mb-6">
              {/* Option A */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-option-a flex items-center justify-center text-option-a-foreground font-bold text-xs">
                      A
                    </span>
                    <span className={selectedPoll.userChoice === 'A' ? 'font-bold text-option-a' : ''}>
                      {selectedPoll.option_a}
                    </span>
                  </div>
                  <span className="font-bold text-lg">{selectedPoll.percentA}%</span>
                </div>
                <div className="h-3 rounded-full bg-secondary overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-1000 ease-out bg-option-a"
                    style={{ width: `${selectedPoll.percentA}%` }}
                  />
                </div>
              </div>

              {/* Option B */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-option-b flex items-center justify-center text-option-b-foreground font-bold text-xs">
                      B
                    </span>
                    <span className={selectedPoll.userChoice === 'B' ? 'font-bold text-option-b' : ''}>
                      {selectedPoll.option_b}
                    </span>
                  </div>
                  <span className="font-bold text-lg">{selectedPoll.percentB}%</span>
                </div>
                <div className="h-3 rounded-full bg-secondary overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-1000 ease-out bg-option-b"
                    style={{ width: `${selectedPoll.percentB}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setSelectedPoll(null)}
              className="w-full h-12 rounded-xl bg-secondary hover:bg-secondary/80 font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
