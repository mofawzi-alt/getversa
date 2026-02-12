import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Lightbulb, TrendingUp, Target, Clock, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface Insight {
  id: string;
  type: 'recommendation' | 'opportunity' | 'alert' | 'tip';
  icon: typeof Lightbulb;
  title: string;
  description: string;
  action?: string;
  priority: 'high' | 'medium' | 'low';
}

export default function AIInsights() {
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [aiInsights, setAiInsights] = useState<string | null>(null);

  const { data: insights, isLoading } = useQuery({
    queryKey: ['creator-insights', user?.id],
    queryFn: async (): Promise<Insight[]> => {
      if (!user) throw new Error('Not authenticated');

      // Get creator's data for analysis
      const { data: polls } = await supabase
        .from('polls')
        .select('id, category, created_at')
        .eq('created_by', user.id);

      if (!polls || polls.length === 0) {
        return [];
      }

      const pollIds = polls.map(p => p.id);

      const { data: votes } = await supabase
        .from('votes')
        .select('poll_id, created_at, user_id')
        .in('poll_id', pollIds);

      const totalVotes = votes?.length || 0;
      const uniqueVoters = new Set(votes?.map(v => v.user_id)).size;
      const avgVotes = polls.length > 0 ? Math.round(totalVotes / polls.length) : 0;

      // Category analysis
      const categoryVotes = new Map<string, number>();
      polls.forEach(poll => {
        const cat = poll.category || 'Uncategorized';
        const pollVotes = votes?.filter(v => v.poll_id === poll.id).length || 0;
        categoryVotes.set(cat, (categoryVotes.get(cat) || 0) + pollVotes);
      });

      const sortedCategories = Array.from(categoryVotes.entries())
        .sort((a, b) => b[1] - a[1]);

      const topCategory = sortedCategories[0]?.[0];
      const lowCategory = sortedCategories.length > 1 
        ? sortedCategories[sortedCategories.length - 1]?.[0] 
        : null;

      // Generate insights based on data
      const generatedInsights: Insight[] = [];

      // Top performing category
      if (topCategory && categoryVotes.get(topCategory)! > avgVotes * 2) {
        generatedInsights.push({
          id: '1',
          type: 'recommendation',
          icon: TrendingUp,
          title: `Your "${topCategory}" polls are crushing it!`,
          description: `This category gets ${Math.round((categoryVotes.get(topCategory)! / totalVotes) * 100)}% of your total votes. Consider creating more content in this space.`,
          action: 'Create similar poll',
          priority: 'high',
        });
      }

      // Low performing category
      if (lowCategory && topCategory !== lowCategory) {
        generatedInsights.push({
          id: '2',
          type: 'opportunity',
          icon: Target,
          title: `"${lowCategory}" polls need attention`,
          description: `This category is underperforming. Try different question formats or combine with trending topics.`,
          priority: 'medium',
        });
      }

      // Engagement tip
      if (uniqueVoters > 0 && totalVotes / uniqueVoters < 2) {
        generatedInsights.push({
          id: '3',
          type: 'tip',
          icon: Lightbulb,
          title: 'Boost repeat engagement',
          description: 'Most of your voters only vote once. Create poll series or use provocative questions to encourage return visits.',
          priority: 'medium',
        });
      }

      // Consistency alert
      const lastPollDate = polls[0]?.created_at;
      if (lastPollDate) {
        const daysSinceLastPoll = Math.floor(
          (new Date().getTime() - new Date(lastPollDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceLastPoll > 7) {
          generatedInsights.push({
            id: '4',
            type: 'alert',
            icon: Clock,
            title: 'Time to post again!',
            description: `It's been ${daysSinceLastPoll} days since your last poll. Consistent posting keeps your audience engaged.`,
            action: 'Create new poll',
            priority: 'high',
          });
        }
      }

      // Growth opportunity
      if (avgVotes > 10) {
        generatedInsights.push({
          id: '5',
          type: 'opportunity',
          icon: Zap,
          title: 'You\'re ready to scale!',
          description: 'Your engagement rates indicate your audience loves your content. Consider partnering with brands or exploring sponsored polls.',
          priority: 'low',
        });
      }

      return generatedInsights;
    },
    enabled: !!user,
  });

  const generateAIInsights = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');

      // Get creator's data
      const { data: polls } = await supabase
        .from('polls')
        .select('question, category, option_a, option_b')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      const pollIds = polls?.map(p => p.question) || [];

      if (pollIds.length === 0) {
        throw new Error('No polls to analyze');
      }

      // Call AI edge function
      const { data, error } = await supabase.functions.invoke('analyze-creator', {
        body: { polls },
      });

      if (error) throw error;
      return data.insights;
    },
    onSuccess: (data) => {
      setAiInsights(data);
      toast.success('AI insights generated!');
    },
    onError: (error) => {
      console.error('Failed to generate AI insights:', error);
      toast.error('Could not generate AI insights. Try again later.');
    },
  });

  const handleGenerateAI = () => {
    setGenerating(true);
    generateAIInsights.mutate(undefined, {
      onSettled: () => setGenerating(false),
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'medium': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      default: return 'bg-green-500/10 text-green-600 border-green-500/20';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'recommendation': return 'from-primary/20 to-primary/5 border-primary/20';
      case 'opportunity': return 'from-accent/20 to-accent/5 border-accent/20';
      case 'alert': return 'from-orange-500/20 to-orange-500/5 border-orange-500/20';
      default: return 'from-blue-500/20 to-blue-500/5 border-blue-500/20';
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* AI Analysis Card */}
      <Card className="bg-gradient-to-br from-purple-500/10 via-background to-pink-500/10 border-purple-500/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              <CardTitle className="text-lg">AI-Powered Analysis</CardTitle>
            </div>
            <Button 
              onClick={handleGenerateAI} 
              disabled={generating}
              className="gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Generate Deep Insights
            </Button>
          </div>
          <CardDescription>
            Get personalized recommendations based on your poll performance patterns
          </CardDescription>
        </CardHeader>
        {aiInsights && (
          <CardContent>
            <div className="p-4 rounded-lg bg-card border">
              <p className="text-sm whitespace-pre-wrap">{aiInsights}</p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Smart Insights */}
      {insights && insights.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            Smart Recommendations
          </h3>
          
          {insights.map((insight) => {
            const Icon = insight.icon;
            return (
              <Card 
                key={insight.id} 
                className={`bg-gradient-to-r ${getTypeColor(insight.type)}`}
              >
                <CardContent className="pt-4">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-background/50">
                      <Icon className="h-5 w-5 text-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{insight.title}</h4>
                        <Badge variant="outline" className={`text-xs ${getPriorityColor(insight.priority)}`}>
                          {insight.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {insight.description}
                      </p>
                      {insight.action && (
                        <Button size="sm" variant="secondary">
                          {insight.action}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              Create more polls to unlock personalized insights and recommendations.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
