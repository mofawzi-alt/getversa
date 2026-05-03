import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, FileText, Search, ExternalLink, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function DecisionIntelligencePanel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [generatingPollId, setGeneratingPollId] = useState<string | null>(null);

  // Fetch existing DI reports
  const { data: reports, isLoading } = useQuery({
    queryKey: ['di-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('decision_intelligence_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Fetch polls for generation
  const { data: polls } = useQuery({
    queryKey: ['di-poll-search', searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('polls')
        .select('id, question, option_a, option_b, category')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (searchQuery) {
        query = query.or(`question.ilike.%${searchQuery}%,option_a.ilike.%${searchQuery}%,option_b.ilike.%${searchQuery}%`);
      }
      
      const { data: pollData, error } = await query;
      if (error) throw error;
      if (!pollData || pollData.length === 0) return [];

      // Get vote counts for these polls
      const pollIds = pollData.map(p => p.id);
      const { data: voteCounts } = await supabase
        .from('votes')
        .select('poll_id')
        .in('poll_id', pollIds);
      
      const countMap = new Map<string, number>();
      voteCounts?.forEach(v => countMap.set(v.poll_id, (countMap.get(v.poll_id) || 0) + 1));
      
      return pollData.map(p => ({ ...p, totalVotes: countMap.get(p.id) || 0 }));
    },
    enabled: true,
  });

  const generateMutation = useMutation({
    mutationFn: async (pollId: string) => {
      setGeneratingPollId(pollId);
      const { data, error } = await supabase.functions.invoke('generate-decision-intelligence', {
        body: { poll_id: pollId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success('Decision Intelligence report generated!');
      queryClient.invalidateQueries({ queryKey: ['di-reports'] });
      setGeneratingPollId(null);
      if (data?.report?.id) {
        navigate(`/di/report/${data.report.id}`);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to generate report');
      setGeneratingPollId(null);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Decision Intelligence
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            AI-powered insight reports for brands and agencies
          </p>
        </div>
      </div>

      {/* Generate new report */}
      <div className="bg-secondary/30 rounded-xl p-4 space-y-3">
        <h3 className="font-semibold text-sm">Generate New Report</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search polls to analyze..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {polls?.map((poll: any) => {
            const totalVotes = (poll.votes_a || 0) + (poll.votes_b || 0);
            return (
              <div key={poll.id} className="flex items-center justify-between p-3 bg-background rounded-lg border">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{poll.question}</p>
                  <p className="text-xs text-muted-foreground">
                    {totalVotes} votes · {poll.category || 'Uncategorized'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => generateMutation.mutate(poll.id)}
                  disabled={generatingPollId === poll.id}
                  className="ml-2 shrink-0"
                >
                  {generatingPollId === poll.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  <span className="ml-1">Analyze</span>
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Existing reports */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm">Generated Reports</h3>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : reports?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No reports generated yet</p>
          </div>
        ) : (
          reports?.map((report: any) => (
            <div
              key={report.id}
              className="p-4 bg-background rounded-xl border hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => navigate(`/di/report/${report.id}`)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-primary">
                      {report.concept_score}
                    </span>
                    <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                      Concept Score
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      report.report_status === 'complete' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {report.report_status}
                    </span>
                  </div>
                  <p className="text-sm font-medium mt-1">
                    {report.winner_option} vs {report.loser_option}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {report.total_votes} votes · {new Date(report.created_at).toLocaleDateString()}
                  </p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
