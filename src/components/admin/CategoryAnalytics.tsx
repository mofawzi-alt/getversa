import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  Loader2, Tags, BarChart3, Users, Globe, Calendar, 
  Download, TrendingUp, ChevronRight, ChevronDown, Trophy
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { toast } from 'sonner';

interface PollResult {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  votesA: number;
  votesB: number;
  total: number;
  winner: 'A' | 'B' | 'Tie';
  winPercent: number;
}

interface DemographicBreakdown {
  label: string;
  votesA: number;
  votesB: number;
  total: number;
}

interface CategoryData {
  category: string;
  pollCount: number;
  totalVotes: number;
  polls: PollResult[];
  byGender: DemographicBreakdown[];
  byAge: DemographicBreakdown[];
  byCountry: DemographicBreakdown[];
  topOptions: { name: string; votes: number; winRate: number }[];
}

export default function CategoryAnalytics() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('polls');

  // Fetch all unique categories
  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['poll-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('polls')
        .select('category')
        .not('category', 'is', null);
      if (error) throw error;
      
      // Get unique categories with counts
      const categoryCounts = new Map<string, number>();
      data.forEach(poll => {
        if (poll.category) {
          categoryCounts.set(poll.category, (categoryCounts.get(poll.category) || 0) + 1);
        }
      });
      
      return Array.from(categoryCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
    },
  });

  // Fetch category analytics
  const { data: categoryData, isLoading: dataLoading } = useQuery({
    queryKey: ['category-analytics', selectedCategory],
    queryFn: async (): Promise<CategoryData | null> => {
      if (!selectedCategory) return null;

      // Get all polls in category
      const { data: polls, error: pollsError } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b')
        .eq('category', selectedCategory);
      
      if (pollsError) throw pollsError;
      if (!polls || polls.length === 0) return null;

      const pollIds = polls.map(p => p.id);

      // Get all votes with demographics
      const { data: votes, error: votesError } = await supabase
        .from('votes')
        .select(`
          poll_id,
          choice,
          users!inner(gender, age_range, country)
        `)
        .in('poll_id', pollIds);

      if (votesError) throw votesError;

      // Aggregate per-poll results
      const pollResults: PollResult[] = polls.map(poll => {
        const pollVotes = votes?.filter(v => v.poll_id === poll.id) || [];
        const votesA = pollVotes.filter(v => v.choice === 'A').length;
        const votesB = pollVotes.filter(v => v.choice === 'B').length;
        const total = votesA + votesB;
        const winner: 'A' | 'B' | 'Tie' = votesA > votesB ? 'A' : votesB > votesA ? 'B' : 'Tie';
        const winPercent = total > 0 
          ? Math.round((Math.max(votesA, votesB) / total) * 100) 
          : 0;

        return {
          id: poll.id,
          question: poll.question,
          option_a: poll.option_a,
          option_b: poll.option_b,
          votesA,
          votesB,
          total,
          winner,
          winPercent,
        };
      }).sort((a, b) => b.total - a.total);

      // Aggregate demographics across all polls
      const genderMap = new Map<string, { a: number; b: number }>();
      const ageMap = new Map<string, { a: number; b: number }>();
      const countryMap = new Map<string, { a: number; b: number }>();

      votes?.forEach(vote => {
        const user = vote.users as any;

        // Gender
        if (user?.gender) {
          const genderStats = genderMap.get(user.gender) || { a: 0, b: 0 };
          if (vote.choice === 'A') genderStats.a++;
          else genderStats.b++;
          genderMap.set(user.gender, genderStats);
        }

        // Age
        if (user?.age_range) {
          const ageStats = ageMap.get(user.age_range) || { a: 0, b: 0 };
          if (vote.choice === 'A') ageStats.a++;
          else ageStats.b++;
          ageMap.set(user.age_range, ageStats);
        }

        // Country
        if (user?.country) {
          const countryStats = countryMap.get(user.country) || { a: 0, b: 0 };
          if (vote.choice === 'A') countryStats.a++;
          else countryStats.b++;
          countryMap.set(user.country, countryStats);
        }
      });

      const mapToBreakdown = (map: Map<string, { a: number; b: number }>): DemographicBreakdown[] => {
        return Array.from(map.entries())
          .map(([label, counts]) => ({
            label,
            votesA: counts.a,
            votesB: counts.b,
            total: counts.a + counts.b,
          }))
          .filter(d => d.total >= 5) // Filter noisy data
          .sort((a, b) => b.total - a.total);
      };

      // Calculate top performing options across all polls
      const optionPerformance = new Map<string, { wins: number; total: number; votes: number }>();
      pollResults.forEach(poll => {
        // Option A
        const optA = optionPerformance.get(poll.option_a) || { wins: 0, total: 0, votes: 0 };
        optA.total++;
        optA.votes += poll.votesA;
        if (poll.winner === 'A') optA.wins++;
        optionPerformance.set(poll.option_a, optA);

        // Option B
        const optB = optionPerformance.get(poll.option_b) || { wins: 0, total: 0, votes: 0 };
        optB.total++;
        optB.votes += poll.votesB;
        if (poll.winner === 'B') optB.wins++;
        optionPerformance.set(poll.option_b, optB);
      });

      const topOptions = Array.from(optionPerformance.entries())
        .map(([name, stats]) => ({
          name,
          votes: stats.votes,
          winRate: stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0,
        }))
        .sort((a, b) => b.votes - a.votes)
        .slice(0, 10);

      return {
        category: selectedCategory,
        pollCount: polls.length,
        totalVotes: votes?.length || 0,
        polls: pollResults,
        byGender: mapToBreakdown(genderMap),
        byAge: mapToBreakdown(ageMap),
        byCountry: mapToBreakdown(countryMap),
        topOptions,
      };
    },
    enabled: !!selectedCategory,
  });

  const exportCategoryReport = () => {
    if (!categoryData) return;

    let csvContent = `Category Analytics Report: ${categoryData.category}\n`;
    csvContent += `Generated: ${new Date().toISOString()}\n`;
    csvContent += `Total Polls: ${categoryData.pollCount}\n`;
    csvContent += `Total Votes: ${categoryData.totalVotes}\n\n`;

    // Top Options
    csvContent += "TOP PERFORMING OPTIONS\n";
    csvContent += "Option,Total Votes,Win Rate\n";
    categoryData.topOptions.forEach(opt => {
      csvContent += `"${opt.name}",${opt.votes},${opt.winRate}%\n`;
    });

    // All Polls
    csvContent += "\n\nALL POLLS IN CATEGORY\n";
    csvContent += "Question,Option A,Option B,Votes A,Votes B,Total,Winner,Win %\n";
    categoryData.polls.forEach(poll => {
      const winnerText = poll.winner === 'Tie' ? 'Tie' : poll.winner === 'A' ? poll.option_a : poll.option_b;
      csvContent += `"${poll.question}","${poll.option_a}","${poll.option_b}",${poll.votesA},${poll.votesB},${poll.total},"${winnerText}",${poll.winPercent}%\n`;
    });

    // Demographics
    csvContent += "\n\nDEMOGRAPHICS BY GENDER\n";
    csvContent += "Gender,Option A Votes,Option B Votes,Total\n";
    categoryData.byGender.forEach(d => {
      csvContent += `"${d.label}",${d.votesA},${d.votesB},${d.total}\n`;
    });

    csvContent += "\n\nDEMOGRAPHICS BY AGE\n";
    csvContent += "Age Range,Option A Votes,Option B Votes,Total\n";
    categoryData.byAge.forEach(d => {
      csvContent += `"${d.label}",${d.votesA},${d.votesB},${d.total}\n`;
    });

    csvContent += "\n\nDEMOGRAPHICS BY COUNTRY\n";
    csvContent += "Country,Option A Votes,Option B Votes,Total\n";
    categoryData.byCountry.forEach(d => {
      csvContent += `"${d.label}",${d.votesA},${d.votesB},${d.total}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `category-report-${categoryData.category.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('Report exported');
  };

  const DemographicSection = ({ 
    title, 
    icon: Icon, 
    data 
  }: { 
    title: string; 
    icon: any; 
    data: DemographicBreakdown[];
  }) => (
    <div className="space-y-2">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </h4>
      {data.length === 0 ? (
        <p className="text-xs text-muted-foreground">Not enough data</p>
      ) : (
        <div className="space-y-2">
          {data.slice(0, 6).map(demo => {
            const percentA = demo.total > 0 ? Math.round((demo.votesA / demo.total) * 100) : 0;
            return (
              <div key={demo.label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    {title === 'By Gender' && (
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ 
                        backgroundColor: demo.label === 'Male' ? 'hsl(210, 80%, 55%)' : demo.label === 'Female' ? 'hsl(340, 75%, 55%)' : 'hsl(var(--muted-foreground))' 
                      }} />
                    )}
                    {demo.label}
                  </span>
                  <span>{demo.total} votes</span>
                </div>
                {title === 'By Gender' ? (
                  <div className="flex h-2 rounded-full overflow-hidden bg-secondary">
                    <div style={{ width: `${percentA}%`, backgroundColor: demo.label === 'Male' ? 'hsl(210, 80%, 55%)' : demo.label === 'Female' ? 'hsl(340, 75%, 55%)' : 'hsl(var(--primary))' }} />
                    <div style={{ width: `${100 - percentA}%`, backgroundColor: demo.label === 'Male' ? 'hsl(210, 80%, 55%)' : demo.label === 'Female' ? 'hsl(340, 75%, 55%)' : 'hsl(var(--primary))', opacity: 0.4 }} />
                  </div>
                ) : (
                  <div className="flex h-2 rounded-full overflow-hidden bg-secondary">
                    <div className="bg-option-a" style={{ width: `${percentA}%` }} />
                    <div className="bg-option-b" style={{ width: `${100 - percentA}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Tags className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Industry Analytics</h2>
        </div>
      </div>

      {/* Category Selector */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Select value={selectedCategory || ''} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an industry/category..." />
                </SelectTrigger>
                <SelectContent>
                  {categoriesLoading ? (
                    <div className="p-4 flex justify-center">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : categories?.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No categories found
                    </div>
                  ) : (
                    categories?.map((cat) => (
                      <SelectItem key={cat.name} value={cat.name}>
                        <div className="flex items-center justify-between gap-4">
                          <span>{cat.name}</span>
                          <span className="text-xs text-muted-foreground">{cat.count} polls</span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            {categoryData && (
              <Button variant="outline" onClick={exportCategoryReport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {dataLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {/* Category Results */}
      {categoryData && (
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-primary">{categoryData.pollCount}</div>
                <div className="text-xs text-muted-foreground">Total Polls</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-primary">{categoryData.totalVotes.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Total Votes</div>
              </CardContent>
            </Card>
          </div>

          {/* Top Performing Options */}
          {categoryData.topOptions.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                  Top Options in {categoryData.category}
                </CardTitle>
                <CardDescription>Most voted options across all polls</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {categoryData.topOptions.slice(0, 5).map((opt, index) => (
                    <div key={opt.name} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/50">
                      <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                        index === 1 ? 'bg-gray-400/20 text-gray-400' :
                        index === 2 ? 'bg-orange-600/20 text-orange-600' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium truncate block">{opt.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold">{opt.votes.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">{opt.winRate}% win rate</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Demographics */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Audience Demographics
              </CardTitle>
              <CardDescription>Voting patterns across all {categoryData.category} polls</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <DemographicSection title="By Gender" icon={Users} data={categoryData.byGender} />
              <DemographicSection title="By Age" icon={Calendar} data={categoryData.byAge} />
              <DemographicSection title="By Country" icon={Globe} data={categoryData.byCountry} />
            </CardContent>
          </Card>

          {/* All Polls */}
          <Card>
            <CardHeader className="pb-2">
              <button
                className="w-full flex items-center justify-between"
                onClick={() => setExpandedSection(expandedSection === 'polls' ? null : 'polls')}
              >
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  All Polls ({categoryData.polls.length})
                </CardTitle>
                {expandedSection === 'polls' ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </CardHeader>
            {expandedSection === 'polls' && (
              <CardContent>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {categoryData.polls.map(poll => (
                    <div key={poll.id} className="p-3 rounded-lg bg-secondary/50 space-y-2">
                      <p className="text-sm font-medium">{poll.question}</p>
                      <div className="flex gap-2 text-xs">
                        <span className={`px-2 py-0.5 rounded ${poll.winner === 'A' ? 'bg-option-a/20 text-option-a font-bold' : 'text-muted-foreground'}`}>
                          {poll.option_a}: {poll.votesA}
                        </span>
                        <span className={`px-2 py-0.5 rounded ${poll.winner === 'B' ? 'bg-option-b/20 text-option-b font-bold' : 'text-muted-foreground'}`}>
                          {poll.option_b}: {poll.votesB}
                        </span>
                        <span className="text-muted-foreground ml-auto">
                          {poll.total} total • {poll.winPercent}% majority
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
