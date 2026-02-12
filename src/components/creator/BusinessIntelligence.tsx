import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Loader2, Download, Target, Gauge, TrendingUp, 
  Star, Users, BarChart3, Sparkles 
} from 'lucide-react';
import { toast } from 'sonner';

interface AudienceValueMetrics {
  score: number;
  engagementRate: number;
  retentionRate: number;
  growthRate: number;
  qualityIndicators: {
    name: string;
    value: number;
    max: number;
    status: 'excellent' | 'good' | 'needs-work';
  }[];
}

interface BenchmarkData {
  metric: string;
  yourValue: number;
  platformAvg: number;
  percentile: number;
}

export default function BusinessIntelligence() {
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['creator-business-intelligence', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      // Get creator's polls
      const { data: polls } = await supabase
        .from('polls')
        .select('id, created_at')
        .eq('created_by', user.id);

      if (!polls || polls.length === 0) {
        return null;
      }

      const pollIds = polls.map(p => p.id);

      // Get all votes
      const { data: votes } = await supabase
        .from('votes')
        .select('user_id, created_at')
        .in('poll_id', pollIds);

      const totalVotes = votes?.length || 0;
      const uniqueVoters = new Set(votes?.map(v => v.user_id)).size;

      // Calculate metrics
      const avgVotesPerPoll = polls.length > 0 ? Math.round(totalVotes / polls.length) : 0;
      
      // Engagement rate (votes per unique voter)
      const engagementRate = uniqueVoters > 0 ? Math.round((totalVotes / uniqueVoters) * 10) / 10 : 0;
      
      // Retention (repeat voters)
      const voterCounts = new Map<string, number>();
      votes?.forEach(v => {
        voterCounts.set(v.user_id, (voterCounts.get(v.user_id) || 0) + 1);
      });
      const repeatVoters = Array.from(voterCounts.values()).filter(c => c > 1).length;
      const retentionRate = uniqueVoters > 0 ? Math.round((repeatVoters / uniqueVoters) * 100) : 0;

      // Calculate audience value score (0-100)
      const score = Math.min(100, Math.round(
        (engagementRate * 15) + 
        (retentionRate * 0.5) + 
        (avgVotesPerPoll * 2) +
        (polls.length * 2)
      ));

      const audienceValue: AudienceValueMetrics = {
        score,
        engagementRate,
        retentionRate,
        growthRate: 15, // Placeholder
        qualityIndicators: [
          {
            name: 'Engagement Depth',
            value: Math.min(engagementRate * 20, 100),
            max: 100,
            status: engagementRate > 3 ? 'excellent' : engagementRate > 1.5 ? 'good' : 'needs-work',
          },
          {
            name: 'Audience Loyalty',
            value: retentionRate,
            max: 100,
            status: retentionRate > 40 ? 'excellent' : retentionRate > 20 ? 'good' : 'needs-work',
          },
          {
            name: 'Content Consistency',
            value: Math.min(polls.length * 10, 100),
            max: 100,
            status: polls.length > 10 ? 'excellent' : polls.length > 5 ? 'good' : 'needs-work',
          },
          {
            name: 'Reach Potential',
            value: Math.min(uniqueVoters * 2, 100),
            max: 100,
            status: uniqueVoters > 50 ? 'excellent' : uniqueVoters > 20 ? 'good' : 'needs-work',
          },
        ],
      };

      // Benchmarks (simulated platform averages)
      const benchmarks: BenchmarkData[] = [
        {
          metric: 'Votes per Poll',
          yourValue: avgVotesPerPoll,
          platformAvg: 25,
          percentile: Math.min(100, Math.round((avgVotesPerPoll / 50) * 100)),
        },
        {
          metric: 'Retention Rate',
          yourValue: retentionRate,
          platformAvg: 35,
          percentile: Math.min(100, Math.round((retentionRate / 70) * 100)),
        },
        {
          metric: 'Engagement Rate',
          yourValue: engagementRate,
          platformAvg: 2.0,
          percentile: Math.min(100, Math.round((engagementRate / 5) * 100)),
        },
        {
          metric: 'Unique Reach',
          yourValue: uniqueVoters,
          platformAvg: 100,
          percentile: Math.min(100, Math.round((uniqueVoters / 200) * 100)),
        },
      ];

      return {
        audienceValue,
        benchmarks,
        exportData: {
          polls,
          totalVotes,
          uniqueVoters,
          avgVotesPerPoll,
          engagementRate,
          retentionRate,
        },
      };
    },
    enabled: !!user,
  });

  const handleExport = async () => {
    if (!data?.exportData) return;
    
    setExporting(true);
    try {
      const csvContent = `Versa Creator Analytics Report
Generated: ${new Date().toLocaleDateString()}

Summary Metrics
Total Polls,${data.exportData.polls.length}
Total Votes,${data.exportData.totalVotes}
Unique Voters,${data.exportData.uniqueVoters}
Average Votes per Poll,${data.exportData.avgVotesPerPoll}
Engagement Rate,${data.exportData.engagementRate}
Retention Rate,${data.exportData.retentionRate}%

Audience Value Score,${data.audienceValue.score}/100
`;

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `versa-analytics-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast.success('Analytics exported successfully!');
    } catch (error) {
      toast.error('Failed to export analytics');
    } finally {
      setExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No data available yet. Create polls to unlock business intelligence.</p>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'text-green-500 bg-green-500/10';
      case 'good': return 'text-yellow-500 bg-yellow-500/10';
      default: return 'text-red-500 bg-red-500/10';
    }
  };

  return (
    <div className="space-y-6">
      {/* Audience Value Score */}
      <Card className="bg-gradient-to-br from-primary/10 via-background to-accent/10 border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Audience Value Score</CardTitle>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExport}
              disabled={exporting}
              className="gap-2"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export Report
            </Button>
          </div>
          <CardDescription>A composite metric measuring your audience quality and business potential</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-8">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  fill="none"
                  stroke="hsl(var(--muted))"
                  strokeWidth="12"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="12"
                  strokeDasharray={`${data.audienceValue.score * 3.51} 351`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <span className="text-3xl font-bold">{data.audienceValue.score}</span>
                  <span className="text-sm text-muted-foreground block">/100</span>
                </div>
              </div>
            </div>
            
            <div className="flex-1 grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{data.audienceValue.engagementRate}x</p>
                <p className="text-xs text-muted-foreground">Engagement Rate</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-accent">{data.audienceValue.retentionRate}%</p>
                <p className="text-xs text-muted-foreground">Retention</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-500">+{data.audienceValue.growthRate}%</p>
                <p className="text-xs text-muted-foreground">Growth</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quality Indicators */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-4 w-4 text-primary" />
            Quality Indicators
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.audienceValue.qualityIndicators.map((indicator) => (
            <div key={indicator.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{indicator.name}</span>
                <Badge variant="outline" className={getStatusColor(indicator.status)}>
                  {indicator.status.replace('-', ' ')}
                </Badge>
              </div>
              <Progress value={indicator.value} max={indicator.max} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Benchmarks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Platform Benchmarks
          </CardTitle>
          <CardDescription>How you compare to other creators on Versa</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {data.benchmarks.map((benchmark) => (
              <div key={benchmark.metric} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{benchmark.metric}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground">
                      Avg: {benchmark.platformAvg}
                    </span>
                    <span className="font-bold text-primary">
                      You: {benchmark.yourValue}
                    </span>
                  </div>
                </div>
                <div className="relative h-4 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="absolute left-1/2 w-0.5 h-full bg-muted-foreground/30 z-10"
                  />
                  <div 
                    className={`absolute top-0 left-0 h-full rounded-full transition-all ${
                      benchmark.yourValue >= benchmark.platformAvg 
                        ? 'bg-gradient-to-r from-primary to-green-500' 
                        : 'bg-gradient-to-r from-orange-500 to-primary'
                    }`}
                    style={{ width: `${benchmark.percentile}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-right">
                  Top {100 - benchmark.percentile}% of creators
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
