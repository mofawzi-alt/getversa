import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, BarChart3, Users, Globe, Calendar, TrendingUp, Eye, Clock, Image as ImageIcon, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { format } from 'date-fns';

interface DemographicBreakdown {
  label: string;
  optionA: number;
  optionB: number;
  total: number;
}

interface PollAnalyticsData {
  poll: {
    id: string;
    question: string;
    option_a: string;
    option_b: string;
    category: string | null;
    image_a_url: string | null;
    image_b_url: string | null;
    created_at: string | null;
    ends_at: string | null;
    is_active: boolean | null;
  };
  totalVotes: number;
  overallA: number;
  overallB: number;
  byGender: DemographicBreakdown[];
  byAgeRange: DemographicBreakdown[];
  byCountry: DemographicBreakdown[];
  recentVotes: { created_at: string; choice: string }[];
}

interface PollAnalyticsProps {
  initialPollId?: string | null;
}

export default function PollAnalytics({ initialPollId }: PollAnalyticsProps) {
  const [selectedPollId, setSelectedPollId] = useState<string | null>(initialPollId || null);

  // Sync with parent when initialPollId changes
  useEffect(() => {
    if (initialPollId) {
      setSelectedPollId(initialPollId);
    }
  }, [initialPollId]);

  // Fetch all polls for dropdown
  const { data: polls, isLoading: pollsLoading } = useQuery({
    queryKey: ['analytics-polls'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, category, created_at, image_a_url, image_b_url')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch analytics for selected poll
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['poll-analytics', selectedPollId],
    queryFn: async (): Promise<PollAnalyticsData | null> => {
      if (!selectedPollId) return null;

      // Get poll details
      const { data: poll } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, category, image_a_url, image_b_url, created_at, ends_at, is_active')
        .eq('id', selectedPollId)
        .single();

      if (!poll) return null;

      // Get all votes with user demographics
      const { data: votes } = await supabase
        .from('votes')
        .select(`
          choice,
          user_id,
          created_at,
          users!inner(gender, age_range, country)
        `)
        .eq('poll_id', selectedPollId)
        .order('created_at', { ascending: false });

      if (!votes || votes.length === 0) {
        return {
          poll,
          totalVotes: 0,
          overallA: 0,
          overallB: 0,
          byGender: [],
          byAgeRange: [],
          byCountry: [],
          recentVotes: [],
        };
      }

      const totalVotes = votes.length;
      const overallA = votes.filter(v => v.choice === 'A').length;
      const overallB = totalVotes - overallA;

      // Group by gender
      const genderGroups = new Map<string, { a: number; b: number }>();
      votes.forEach(vote => {
        const gender = (vote.users as any)?.gender || 'Unknown';
        const current = genderGroups.get(gender) || { a: 0, b: 0 };
        if (vote.choice === 'A') current.a++;
        else current.b++;
        genderGroups.set(gender, current);
      });

      const byGender: DemographicBreakdown[] = Array.from(genderGroups.entries())
        .map(([label, counts]) => ({
          label: label || 'Unknown',
          optionA: counts.a,
          optionB: counts.b,
          total: counts.a + counts.b,
        }))
        .sort((a, b) => b.total - a.total);

      // Group by age range
      const ageGroups = new Map<string, { a: number; b: number }>();
      votes.forEach(vote => {
        const ageRange = (vote.users as any)?.age_range || 'Unknown';
        const current = ageGroups.get(ageRange) || { a: 0, b: 0 };
        if (vote.choice === 'A') current.a++;
        else current.b++;
        ageGroups.set(ageRange, current);
      });

      const byAgeRange: DemographicBreakdown[] = Array.from(ageGroups.entries())
        .map(([label, counts]) => ({
          label: label || 'Unknown',
          optionA: counts.a,
          optionB: counts.b,
          total: counts.a + counts.b,
        }))
        .sort((a, b) => b.total - a.total);

      // Group by country
      const countryGroups = new Map<string, { a: number; b: number }>();
      votes.forEach(vote => {
        const country = (vote.users as any)?.country || 'Unknown';
        const current = countryGroups.get(country) || { a: 0, b: 0 };
        if (vote.choice === 'A') current.a++;
        else current.b++;
        countryGroups.set(country, current);
      });

      const byCountry: DemographicBreakdown[] = Array.from(countryGroups.entries())
        .map(([label, counts]) => ({
          label: label || 'Unknown',
          optionA: counts.a,
          optionB: counts.b,
          total: counts.a + counts.b,
        }))
        .sort((a, b) => b.total - a.total);

      // Recent votes for activity feed
      const recentVotes = votes.slice(0, 10).map(v => ({
        created_at: v.created_at || '',
        choice: v.choice,
      }));

      return {
        poll,
        totalVotes,
        overallA,
        overallB,
        byGender,
        byAgeRange,
        byCountry,
        recentVotes,
      };
    },
    enabled: !!selectedPollId,
  });

  const DemographicChart = ({ 
    title, 
    icon: Icon, 
    data, 
    optionALabel, 
    optionBLabel 
  }: { 
    title: string; 
    icon: any; 
    data: DemographicBreakdown[]; 
    optionALabel: string; 
    optionBLabel: string;
  }) => {
    if (data.length === 0) {
      return (
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Icon className="h-4 w-4 text-primary" />
            <h4 className="font-semibold text-sm">{title}</h4>
          </div>
          <p className="text-sm text-muted-foreground text-center py-4">No data available</p>
        </div>
      );
    }

    return (
      <div className="glass rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Icon className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm">{title}</h4>
        </div>
        <div className="space-y-3">
          {data.map((item) => {
            const percentA = item.total > 0 ? Math.round((item.optionA / item.total) * 100) : 0;
            const percentB = 100 - percentA;
            
            return (
              <div key={item.label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-foreground">{item.label}</span>
                  <span className="text-foreground/70">{item.total} votes</span>
                </div>
                {/* Show percentages above bar when one is 0% or very small */}
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-bold text-option-a">{percentA}%</span>
                  <span className="font-bold text-option-b">{percentB}%</span>
                </div>
                <div className="flex h-4 rounded-full overflow-hidden bg-secondary">
                  <div 
                    className="bg-option-a transition-all"
                    style={{ width: `${percentA}%` }}
                  />
                  <div 
                    className="bg-option-b transition-all"
                    style={{ width: `${percentB}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-center gap-4 mt-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-option-a" />
            <span className="truncate max-w-[80px]">{optionALabel}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-option-b" />
            <span className="truncate max-w-[80px]">{optionBLabel}</span>
          </div>
        </div>
      </div>
    );
  };

  // Calculate percentages only when analytics is available
  const getPercentages = () => {
    if (!analytics || analytics.totalVotes === 0) return { percentA: 0, percentB: 0, winner: 'Tie' as const };
    const pA = Math.round((analytics.overallA / analytics.totalVotes) * 100);
    const pB = 100 - pA;
    const w = pA > pB ? 'A' : pB > pA ? 'B' : 'Tie';
    return { percentA: pA, percentB: pB, winner: w };
  };

  const exportCurrentPoll = async () => {
    if (!analytics) {
      toast.error('No poll selected');
      return;
    }
    
    try {
      // Get votes with demographics for current poll
      const { data: votes } = await supabase
        .from('votes')
        .select('choice, created_at, users!inner(gender, age_range, country)')
        .eq('poll_id', analytics.poll.id);

      // Build detailed CSV
      let csvContent = "Poll Details\n";
      csvContent += `Question,"${analytics.poll.question}"\n`;
      csvContent += `Option A,"${analytics.poll.option_a}"\n`;
      csvContent += `Option B,"${analytics.poll.option_b}"\n`;
      csvContent += `Category,"${analytics.poll.category || 'N/A'}"\n`;
      csvContent += `Total Votes,${analytics.totalVotes}\n`;
      csvContent += `Votes for A,${analytics.overallA} (${analytics.totalVotes > 0 ? Math.round((analytics.overallA / analytics.totalVotes) * 100) : 0}%)\n`;
      csvContent += `Votes for B,${analytics.overallB} (${analytics.totalVotes > 0 ? Math.round((analytics.overallB / analytics.totalVotes) * 100) : 0}%)\n`;
      csvContent += `Created At,"${analytics.poll.created_at}"\n\n`;

      // Demographics breakdown
      csvContent += "Demographics by Gender\n";
      csvContent += "Gender,Option A,Option B,Total\n";
      analytics.byGender.forEach(g => {
        csvContent += `"${g.label}",${g.optionA},${g.optionB},${g.total}\n`;
      });

      csvContent += "\nDemographics by Age Range\n";
      csvContent += "Age Range,Option A,Option B,Total\n";
      analytics.byAgeRange.forEach(a => {
        csvContent += `"${a.label}",${a.optionA},${a.optionB},${a.total}\n`;
      });

      csvContent += "\nDemographics by Country\n";
      csvContent += "Country,Option A,Option B,Total\n";
      analytics.byCountry.forEach(c => {
        csvContent += `"${c.label}",${c.optionA},${c.optionB},${c.total}\n`;
      });

      csvContent += "\nIndividual Votes\n";
      csvContent += "Choice,Gender,Age Range,Country,Voted At\n";
      votes?.forEach(v => {
        const user = v.users as any;
        csvContent += `"${v.choice}","${user?.gender || 'Unknown'}","${user?.age_range || 'Unknown'}","${user?.country || 'Unknown'}","${v.created_at}"\n`;
      });

      // Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `poll-analytics-${analytics.poll.id.slice(0, 8)}-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      toast.success('Poll analytics exported');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export poll analytics');
    }
  };

  const exportAllAnalytics = async () => {
    try {
      // Get all polls
      const { data: allPolls } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, category, created_at')
        .order('created_at', { ascending: false });

      if (!allPolls || allPolls.length === 0) {
        toast.error('No polls to export');
        return;
      }

      const pollIds = allPolls.map(p => p.id);
      
      // Get all votes with demographics
      const { data: allVotes } = await supabase
        .from('votes')
        .select('poll_id, choice, created_at, users!inner(gender, age_range, country)')
        .in('poll_id', pollIds);

      // Get poll results
      const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: pollIds });

      // Build CSV with demographics
      let csvContent = "Poll ID,Question,Option A,Option B,Category,Total Votes,Votes A,Votes B,Percent A,Percent B,Created At\n";
      
      allPolls.forEach(poll => {
        const result = results?.find(r => r.poll_id === poll.id);
        csvContent += `"${poll.id}","${poll.question}","${poll.option_a}","${poll.option_b}","${poll.category || ''}","${result?.total_votes || 0}","${result?.votes_a || 0}","${result?.votes_b || 0}","${result?.percent_a || 0}%","${result?.percent_b || 0}%","${poll.created_at}"\n`;
      });

      // Add individual votes sheet
      csvContent += "\n\nIndividual Votes\n";
      csvContent += "Poll ID,Choice,Gender,Age Range,Country,Voted At\n";
      allVotes?.forEach(v => {
        const user = v.users as any;
        csvContent += `"${v.poll_id}","${v.choice}","${user?.gender || 'Unknown'}","${user?.age_range || 'Unknown'}","${user?.country || 'Unknown'}","${v.created_at}"\n`;
      });

      // Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `admin-analytics-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      toast.success('Analytics exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export analytics');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Poll Analytics</h2>
        </div>
        <div className="flex gap-2">
          {selectedPollId && analytics && (
            <Button size="sm" variant="outline" onClick={exportCurrentPoll}>
              <Download className="h-4 w-4 mr-2" />
              Export This Poll
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={exportAllAnalytics}>
            <Download className="h-4 w-4 mr-2" />
            Export All
          </Button>
        </div>
      </div>

      {/* Poll Selector with Preview */}
      <div className="glass rounded-xl p-4">
        <label className="text-sm font-medium mb-2 block">Select a poll to analyze</label>
        <Select value={selectedPollId || undefined} onValueChange={(val) => setSelectedPollId(val)}>
          <SelectTrigger className="w-full bg-secondary">
            <SelectValue placeholder="Choose a poll..." />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {pollsLoading ? (
              <div className="p-4 flex justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              polls?.map((poll) => (
                <SelectItem key={poll.id} value={poll.id} className="py-2">
                  {poll.option_a} vs {poll.option_b}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Analytics Display */}
      {selectedPollId && (
        <>
          {analyticsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : analytics ? (
            (() => {
              const { percentA, percentB, winner } = getPercentages();
              return (
            <div className="space-y-4">
              {/* Poll Header with Images */}
              <div className="glass rounded-xl p-4 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{analytics.poll.question}</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {analytics.poll.category && (
                        <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary">
                          {analytics.poll.category}
                        </span>
                      )}
                      <span className={`text-xs px-2 py-1 rounded-full ${analytics.poll.is_active ? 'bg-green-500/20 text-green-400' : 'bg-muted text-muted-foreground'}`}>
                        {analytics.poll.is_active ? 'Active' : 'Closed'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {analytics.poll.created_at && (
                      <div className="flex items-center gap-1 justify-end">
                        <Clock className="h-3 w-3" />
                        {format(new Date(analytics.poll.created_at), 'MMM d, yyyy')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Poll Images Side by Side */}
                {(analytics.poll.image_a_url || analytics.poll.image_b_url) && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      {analytics.poll.image_a_url ? (
                        <div className="relative aspect-square rounded-xl overflow-hidden border-2 border-option-a/30">
                          <img 
                            src={analytics.poll.image_a_url} 
                            alt={analytics.poll.option_a}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                            <p className="text-white text-sm font-medium truncate">{analytics.poll.option_a}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-2xl font-bold text-option-a">{percentA}%</span>
                              <span className="text-xs text-white/70">({analytics.overallA} votes)</span>
                            </div>
                          </div>
                          {winner === 'A' && (
                            <div className="absolute top-2 right-2 bg-option-a text-option-a-foreground text-xs px-2 py-1 rounded-full flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              Winner
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="aspect-square rounded-xl bg-secondary flex items-center justify-center border-2 border-option-a/30">
                          <div className="text-center p-4">
                            <p className="text-sm font-medium">{analytics.poll.option_a}</p>
                            <span className="text-2xl font-bold text-option-a">{percentA}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="relative">
                      {analytics.poll.image_b_url ? (
                        <div className="relative aspect-square rounded-xl overflow-hidden border-2 border-option-b/30">
                          <img 
                            src={analytics.poll.image_b_url} 
                            alt={analytics.poll.option_b}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                            <p className="text-white text-sm font-medium truncate">{analytics.poll.option_b}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-2xl font-bold text-option-b">{percentB}%</span>
                              <span className="text-xs text-white/70">({analytics.overallB} votes)</span>
                            </div>
                          </div>
                          {winner === 'B' && (
                            <div className="absolute top-2 right-2 bg-option-b text-option-b-foreground text-xs px-2 py-1 rounded-full flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              Winner
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="aspect-square rounded-xl bg-secondary flex items-center justify-center border-2 border-option-b/30">
                          <div className="text-center p-4">
                            <p className="text-sm font-medium">{analytics.poll.option_b}</p>
                            <span className="text-2xl font-bold text-option-b">{percentB}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Text-only poll results (no images) */}
                {!analytics.poll.image_a_url && !analytics.poll.image_b_url && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-option-a flex items-center gap-2">
                          {analytics.poll.option_a}
                          {winner === 'A' && (
                            <span className="text-xs bg-option-a/20 px-2 py-0.5 rounded-full">Winner</span>
                          )}
                        </span>
                        <span className="font-bold">{percentA}% ({analytics.overallA})</span>
                      </div>
                      <div className="h-4 rounded-full bg-secondary overflow-hidden">
                        <div 
                          className="h-full bg-option-a rounded-full transition-all"
                          style={{ width: `${percentA}%` }}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-option-b flex items-center gap-2">
                          {analytics.poll.option_b}
                          {winner === 'B' && (
                            <span className="text-xs bg-option-b/20 px-2 py-0.5 rounded-full">Winner</span>
                          )}
                        </span>
                        <span className="font-bold">{percentB}% ({analytics.overallB})</span>
                      </div>
                      <div className="h-4 rounded-full bg-secondary overflow-hidden">
                        <div 
                          className="h-full bg-option-b rounded-full transition-all"
                          style={{ width: `${percentB}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{analytics.totalVotes}</div>
                    <div className="text-xs text-muted-foreground">Total Votes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {analytics.totalVotes > 0 ? Math.abs(percentA - percentB) : 0}%
                    </div>
                    <div className="text-xs text-muted-foreground">Margin</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {analytics.byCountry.length}
                    </div>
                    <div className="text-xs text-muted-foreground">Countries</div>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              {analytics.recentVotes.length > 0 && (
                <div className="glass rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Eye className="h-4 w-4 text-primary" />
                    <h4 className="font-semibold text-sm">Recent Activity</h4>
                  </div>
                  <div className="space-y-2">
                    {analytics.recentVotes.slice(0, 5).map((vote, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${vote.choice === 'A' ? 'bg-primary' : 'bg-accent'}`} />
                          <span>Voted for {vote.choice === 'A' ? analytics.poll.option_a : analytics.poll.option_b}</span>
                        </div>
                        <span className="text-muted-foreground">
                          {vote.created_at && format(new Date(vote.created_at), 'MMM d, h:mm a')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Demographic Breakdowns */}
              <DemographicChart 
                title="By Gender" 
                icon={Users} 
                data={analytics.byGender}
                optionALabel={analytics.poll.option_a}
                optionBLabel={analytics.poll.option_b}
              />
              
              <DemographicChart 
                title="By Age Range" 
                icon={Calendar} 
                data={analytics.byAgeRange}
                optionALabel={analytics.poll.option_a}
                optionBLabel={analytics.poll.option_b}
              />
              
              <DemographicChart 
                title="By Country" 
                icon={Globe} 
                data={analytics.byCountry}
                optionALabel={analytics.poll.option_a}
                optionBLabel={analytics.poll.option_b}
              />
            </div>
              );
            })()
          ) : (
            <div className="glass rounded-xl p-6 text-center">
              <p className="text-muted-foreground">No data found for this poll</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
