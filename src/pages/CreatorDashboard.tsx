import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Loader2, Plus, BarChart3, Users, TrendingUp, 
  Calendar, Crown, ArrowLeft, Eye, Vote, Clock, 
  Sparkles, Target, Activity, Download, RefreshCcw, UserPlus
} from 'lucide-react';
import { toast } from 'sonner';
import ShareButton from '@/components/poll/ShareButton';
import AudienceDemographics from '@/components/creator/AudienceDemographics';
import ContentPerformance from '@/components/creator/ContentPerformance';
import EngagementTrends from '@/components/creator/EngagementTrends';
import BusinessIntelligence from '@/components/creator/BusinessIntelligence';
import AIInsights from '@/components/creator/AIInsights';
import ResponseTimeAnalytics from '@/components/creator/ResponseTimeAnalytics';
import VoterRetentionFunnel from '@/components/creator/VoterRetentionFunnel';
import AnalyticsExport from '@/components/creator/AnalyticsExport';
import FollowerAnalytics from '@/components/creator/FollowerAnalytics';

interface CreatorPoll {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  category: string | null;
  created_at: string;
  is_active: boolean;
  vote_count?: number;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price_monthly: number;
  features: string[];
  max_polls_per_month: number | null;
  analytics_access: boolean;
  demographic_targeting: boolean;
  export_data: boolean;
}

export default function CreatorDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [newPoll, setNewPoll] = useState({
    question: '',
    option_a: '',
    option_b: '',
    category: '',
    target_gender: '',
    target_age_range: '',
    target_country: '',
  });

  // Check if user has creator subscription
  const { data: subscription, isLoading: loadingSubscription } = useQuery({
    queryKey: ['user-subscription', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          plan:subscription_plans(*)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch subscription plans
  const { data: plans } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_monthly', { ascending: true });
      
      if (error) throw error;
      return data as SubscriptionPlan[];
    },
  });

  // Fetch creator's polls
  const { data: myPolls, isLoading: loadingPolls } = useQuery({
    queryKey: ['creator-polls', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data: polls, error } = await supabase
        .from('polls')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Get vote counts for each poll
      const pollsWithVotes = await Promise.all(
        (polls || []).map(async (poll) => {
          const { count } = await supabase
            .from('votes')
            .select('id', { count: 'exact' })
            .eq('poll_id', poll.id);
          
          return { ...poll, vote_count: count || 0 };
        })
      );
      
      return pollsWithVotes as CreatorPoll[];
    },
    enabled: !!user && !!subscription,
  });

  // Create poll mutation
  const createPollMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('polls')
        .insert({
          question: newPoll.question,
          option_a: newPoll.option_a,
          option_b: newPoll.option_b,
          category: newPoll.category || null,
          created_by: user.id,
          is_active: true,
          target_gender: newPoll.target_gender || null,
          target_age_range: newPoll.target_age_range || null,
          target_country: newPoll.target_country || null,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Poll created successfully!');
      setShowCreatePoll(false);
      setNewPoll({ question: '', option_a: '', option_b: '', category: '', target_gender: '', target_age_range: '', target_country: '' });
      queryClient.invalidateQueries({ queryKey: ['creator-polls'] });
    },
    onError: (error) => {
      toast.error('Failed to create poll');
      console.error(error);
    },
  });

  // Calculate stats
  const totalPolls = myPolls?.length || 0;
  const totalVotes = myPolls?.reduce((sum, p) => sum + (p.vote_count || 0), 0) || 0;
  const avgVotesPerPoll = totalPolls > 0 ? Math.round(totalVotes / totalPolls) : 0;

  if (loadingSubscription) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show subscription plans if no active subscription
  if (!subscription) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Feed
          </button>

          <header className="text-center py-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 mb-4">
              <Crown className="h-5 w-5 text-primary" />
              <span className="font-bold text-primary">Creator Dashboard</span>
            </div>
            <h1 className="text-3xl font-display font-bold mb-2">Become a Creator</h1>
            <p className="text-muted-foreground max-w-md mx-auto">
              Create polls, access detailed analytics, and engage with your audience.
            </p>
          </header>

          <div className="grid md:grid-cols-3 gap-6">
            {plans?.map((plan) => (
              <Card 
                key={plan.id} 
                className={`relative ${plan.name === 'Pro' ? 'border-primary shadow-lg' : ''}`}
              >
                {plan.name === 'Pro' && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary">Most Popular</Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="pt-4">
                    <span className="text-4xl font-bold">${plan.price_monthly}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {(plan.features as string[]).map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className="w-full"
                    onClick={() => toast.info('Payment integration coming soon!')}
                  >
                    Subscribe to {plan.name}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Feed
          </button>
          
          <Badge variant="outline" className="gap-1">
            <Crown className="h-3 w-3" />
            {subscription.plan?.name || 'Creator'}
          </Badge>
        </div>

        <header>
          <h1 className="text-2xl font-display font-bold">Creator Dashboard</h1>
          <p className="text-muted-foreground">
            Create polls and track your engagement analytics
          </p>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalPolls}</p>
                  <p className="text-sm text-muted-foreground">Total Polls</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/20">
                  <Users className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalVotes}</p>
                  <p className="text-sm text-muted-foreground">Total Votes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/20">
                  <TrendingUp className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{avgVotesPerPoll}</p>
                  <p className="text-sm text-muted-foreground">Avg Votes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="polls" className="w-full">
          <TabsList className="grid w-full grid-cols-10 h-auto">
            <TabsTrigger value="polls" className="gap-1 text-xs px-1 py-2">
              <Vote className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Polls</span>
            </TabsTrigger>
            <TabsTrigger value="followers" className="gap-1 text-xs px-1 py-2">
              <UserPlus className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Followers</span>
            </TabsTrigger>
            <TabsTrigger value="audience" className="gap-1 text-xs px-1 py-2">
              <Users className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Audience</span>
            </TabsTrigger>
            <TabsTrigger value="performance" className="gap-1 text-xs px-1 py-2">
              <BarChart3 className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Content</span>
            </TabsTrigger>
            <TabsTrigger value="trends" className="gap-1 text-xs px-1 py-2">
              <Activity className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Trends</span>
            </TabsTrigger>
            <TabsTrigger value="timing" className="gap-1 text-xs px-1 py-2">
              <Clock className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Timing</span>
            </TabsTrigger>
            <TabsTrigger value="retention" className="gap-1 text-xs px-1 py-2">
              <RefreshCcw className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Retention</span>
            </TabsTrigger>
            <TabsTrigger value="intelligence" className="gap-1 text-xs px-1 py-2">
              <Target className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">BI</span>
            </TabsTrigger>
            <TabsTrigger value="insights" className="gap-1 text-xs px-1 py-2">
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">AI</span>
            </TabsTrigger>
            <TabsTrigger value="export" className="gap-1 text-xs px-1 py-2">
              <Download className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Export</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="followers" className="mt-6">
            <FollowerAnalytics />
          </TabsContent>

          <TabsContent value="polls" className="space-y-4 mt-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Your Polls</h2>
              <Button onClick={() => setShowCreatePoll(!showCreatePoll)} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Poll
              </Button>
            </div>

            {showCreatePoll && (
              <Card>
                <CardHeader>
                  <CardTitle>Create New Poll</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Question</Label>
                    <Textarea
                      placeholder="What would you like to ask?"
                      value={newPoll.question}
                      onChange={(e) => setNewPoll({ ...newPoll, question: e.target.value })}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Option A</Label>
                      <Input
                        placeholder="First option"
                        value={newPoll.option_a}
                        onChange={(e) => setNewPoll({ ...newPoll, option_a: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Option B</Label>
                      <Input
                        placeholder="Second option"
                        value={newPoll.option_b}
                        onChange={(e) => setNewPoll({ ...newPoll, option_b: e.target.value })}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Category (optional)</Label>
                    <Input
                      placeholder="e.g., Fashion, Tech, Travel"
                      value={newPoll.category}
                      onChange={(e) => setNewPoll({ ...newPoll, category: e.target.value })}
                    />
                  </div>
                  
                  {/* Demographic Targeting */}
                  <div className="border-t border-border pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="h-4 w-4 text-primary" />
                      <Label className="font-semibold">Demographic Targeting (Optional)</Label>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Gender</Label>
                        <select
                          value={newPoll.target_gender}
                          onChange={(e) => setNewPoll({ ...newPoll, target_gender: e.target.value })}
                          className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                        >
                          <option value="">All</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Age Range</Label>
                        <select
                          value={newPoll.target_age_range}
                          onChange={(e) => setNewPoll({ ...newPoll, target_age_range: e.target.value })}
                          className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                        >
                          <option value="">All</option>
                          <option value="13-17">13-17</option>
                          <option value="18-24">18-24</option>
                          <option value="25-34">25-34</option>
                          <option value="35-44">35-44</option>
                          <option value="45-54">45-54</option>
                          <option value="55+">55+</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Country</Label>
                        <select
                          value={newPoll.target_country}
                          onChange={(e) => setNewPoll({ ...newPoll, target_country: e.target.value })}
                          className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                        >
                          <option value="">All</option>
                          <option value="United States">United States</option>
                          <option value="United Kingdom">United Kingdom</option>
                          <option value="Canada">Canada</option>
                          <option value="Australia">Australia</option>
                          <option value="Germany">Germany</option>
                          <option value="France">France</option>
                          <option value="Spain">Spain</option>
                          <option value="Italy">Italy</option>
                          <option value="Brazil">Brazil</option>
                          <option value="India">India</option>
                          <option value="Japan">Japan</option>
                          <option value="Mexico">Mexico</option>
                          <option disabled>── Middle East ──</option>
                          <option value="Saudi Arabia">Saudi Arabia</option>
                          <option value="United Arab Emirates">United Arab Emirates</option>
                          <option value="Qatar">Qatar</option>
                          <option value="Kuwait">Kuwait</option>
                          <option value="Bahrain">Bahrain</option>
                          <option value="Oman">Oman</option>
                          <option value="Jordan">Jordan</option>
                          <option value="Lebanon">Lebanon</option>
                          <option value="Iraq">Iraq</option>
                          <option value="Iran">Iran</option>
                          <option value="Israel">Israel</option>
                          <option value="Palestine">Palestine</option>
                          <option value="Syria">Syria</option>
                          <option value="Yemen">Yemen</option>
                          <option value="Egypt">Egypt</option>
                          <option value="Turkey">Turkey</option>
                        </select>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Leave as "All" to show poll to everyone
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => createPollMutation.mutate()}
                      disabled={!newPoll.question || !newPoll.option_a || !newPoll.option_b || createPollMutation.isPending}
                    >
                      {createPollMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Create Poll
                    </Button>
                    <Button variant="outline" onClick={() => setShowCreatePoll(false)}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {loadingPolls ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : myPolls && myPolls.length > 0 ? (
              <div className="space-y-3">
                {myPolls.map((poll) => (
                  <Card key={poll.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate">{poll.question}</h3>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Vote className="h-3.5 w-3.5" />
                              {poll.vote_count} votes
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {new Date(poll.created_at).toLocaleDateString()}
                            </span>
                            {poll.category && (
                              <Badge variant="secondary">{poll.category}</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <ShareButton
                            pollId={poll.id}
                            pollQuestion={poll.question}
                            optionA={poll.option_a}
                            optionB={poll.option_b}
                            variant="icon"
                          />
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Vote className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No polls yet. Create your first poll!</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="audience" className="mt-6">
            {subscription.plan?.analytics_access ? (
              <AudienceDemographics />
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground mb-4">Upgrade to Pro or Business to view audience demographics</p>
                  <Button variant="outline">Upgrade Plan</Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="performance" className="mt-6">
            {subscription.plan?.analytics_access ? (
              <ContentPerformance />
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground mb-4">Upgrade to Pro or Business to view content performance</p>
                  <Button variant="outline">Upgrade Plan</Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="trends" className="mt-6">
            {subscription.plan?.analytics_access ? (
              <EngagementTrends />
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Activity className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground mb-4">Upgrade to Pro or Business to view engagement trends</p>
                  <Button variant="outline">Upgrade Plan</Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="intelligence" className="mt-6">
            {subscription.plan?.analytics_access ? (
              <BusinessIntelligence />
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Target className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground mb-4">Upgrade to Pro or Business for business intelligence</p>
                  <Button variant="outline">Upgrade Plan</Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="insights" className="mt-6">
            {subscription.plan?.analytics_access ? (
              <AIInsights />
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground mb-4">Upgrade to Pro or Business for AI-powered insights</p>
                  <Button variant="outline">Upgrade Plan</Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="timing" className="mt-6">
            {subscription.plan?.analytics_access ? (
              <ResponseTimeAnalytics />
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground mb-4">Upgrade to Pro or Business for response time analytics</p>
                  <Button variant="outline">Upgrade Plan</Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="retention" className="mt-6">
            {subscription.plan?.analytics_access ? (
              <VoterRetentionFunnel />
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <RefreshCcw className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground mb-4">Upgrade to Pro or Business for retention analytics</p>
                  <Button variant="outline">Upgrade Plan</Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="export" className="mt-6">
            {subscription.plan?.export_data ? (
              <AnalyticsExport />
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Download className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground mb-4">Upgrade to Business for data exports</p>
                  <Button variant="outline">Upgrade Plan</Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
