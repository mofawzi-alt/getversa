import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Loader2, Plus, FolderOpen, BarChart3, Users, Globe, Calendar, 
  Download, Trophy, Trash2, ChevronRight, ChevronDown, Info, HelpCircle,
  CheckCircle2, CircleDot, ArrowRight, PlusCircle, FileEdit
} from 'lucide-react';
import PollCreationForm from './PollCreationForm';
import CampaignClientsManager from './CampaignClientsManager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface CampaignPoll {
  id: string;
  poll_id: string;
  entity_name: string;
  poll: {
    id: string;
    question: string;
    option_a: string;
    option_b: string;
    category: string | null;
  };
}

interface EntityResult {
  name: string;
  wins: number;
  losses: number;
  totalVotes: number;
  winRate: number;
  demographics: {
    byGender: Map<string, { wins: number; total: number }>;
    byAge: Map<string, { wins: number; total: number }>;
    byCountry: Map<string, { wins: number; total: number }>;
  };
}

interface DemographicBreakdown {
  label: string;
  wins: number;
  total: number;
  winRate: number;
}

export default function CampaignAnalytics() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAddPollDialog, setShowAddPollDialog] = useState(false);
  const [showCreatePollForm, setShowCreatePollForm] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignDesc, setNewCampaignDesc] = useState('');
  const [selectedPollId, setSelectedPollId] = useState<string>('');
  const [entityName, setEntityName] = useState('');
  const [expandedEntity, setExpandedEntity] = useState<string | null>(null);
  const [addPollMode, setAddPollMode] = useState<'existing' | 'create'>('existing');

  // Fetch campaigns
  const { data: campaigns, isLoading: campaignsLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('poll_campaigns' as any)
        .select('*')
        .order('created_at', { ascending: false }) as any);
      if (error) throw error;
      return data as Campaign[];
    },
  });

  // Fetch campaign polls
  const { data: campaignPolls, isLoading: pollsLoading } = useQuery({
    queryKey: ['campaign-polls', selectedCampaignId],
    queryFn: async () => {
      if (!selectedCampaignId) return [];
      const { data, error } = await (supabase
        .from('campaign_polls' as any)
        .select(`
          id,
          poll_id,
          entity_name,
          poll:polls(id, question, option_a, option_b, category)
        `)
        .eq('campaign_id', selectedCampaignId) as any);
      if (error) throw error;
      return data as CampaignPoll[];
    },
    enabled: !!selectedCampaignId,
  });

  // Fetch all polls for adding to campaign
  const { data: allPolls } = useQuery({
    queryKey: ['all-polls-for-campaign'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch aggregated results
  const { data: results, isLoading: resultsLoading } = useQuery({
    queryKey: ['campaign-results', selectedCampaignId, campaignPolls],
    queryFn: async (): Promise<EntityResult[]> => {
      if (!campaignPolls || campaignPolls.length === 0) return [];

      const pollIds = campaignPolls.map(cp => cp.poll_id);
      
      // Get all votes with demographics
      const { data: votes } = await supabase
        .from('votes')
        .select(`
          poll_id,
          choice,
          users!inner(gender, age_range, country)
        `)
        .in('poll_id', pollIds);

      if (!votes) return [];

      // Build entity results
      const entityMap = new Map<string, EntityResult>();

      // Initialize entities
      campaignPolls.forEach(cp => {
        if (!entityMap.has(cp.entity_name)) {
          entityMap.set(cp.entity_name, {
            name: cp.entity_name,
            wins: 0,
            losses: 0,
            totalVotes: 0,
            winRate: 0,
            demographics: {
              byGender: new Map(),
              byAge: new Map(),
              byCountry: new Map(),
            },
          });
        }
      });

      // Process each poll
      campaignPolls.forEach(cp => {
        const pollVotes = votes.filter(v => v.poll_id === cp.poll_id);
        const votesA = pollVotes.filter(v => v.choice === 'A').length;
        const votesB = pollVotes.filter(v => v.choice === 'B').length;
        const total = votesA + votesB;

        if (total === 0) return;

        // Determine which option represents this entity
        const poll = cp.poll;
        const isOptionA = poll.option_a.toLowerCase().includes(cp.entity_name.toLowerCase());
        const isOptionB = poll.option_b.toLowerCase().includes(cp.entity_name.toLowerCase());
        
        let entityVotes = 0;
        let opponentVotes = 0;
        let isWin = false;

        if (isOptionA) {
          entityVotes = votesA;
          opponentVotes = votesB;
          isWin = votesA > votesB;
        } else if (isOptionB) {
          entityVotes = votesB;
          opponentVotes = votesA;
          isWin = votesB > votesA;
        } else {
          // Entity name doesn't match options, use entity_name as reference
          // Assume option_a is the entity
          entityVotes = votesA;
          opponentVotes = votesB;
          isWin = votesA > votesB;
        }

        const entity = entityMap.get(cp.entity_name)!;
        entity.totalVotes += entityVotes;
        if (isWin) entity.wins++;
        else if (entityVotes < opponentVotes) entity.losses++;

        // Aggregate demographics for wins
        pollVotes.forEach(vote => {
          const user = vote.users as any;
          const votedForEntity = (isOptionA && vote.choice === 'A') || (isOptionB && vote.choice === 'B') || 
                                  (!isOptionA && !isOptionB && vote.choice === 'A');

          // Gender demographics
          const gender = user?.gender || 'Unknown';
          const genderStats = entity.demographics.byGender.get(gender) || { wins: 0, total: 0 };
          genderStats.total++;
          if (votedForEntity) genderStats.wins++;
          entity.demographics.byGender.set(gender, genderStats);

          // Age demographics
          const age = user?.age_range || 'Unknown';
          const ageStats = entity.demographics.byAge.get(age) || { wins: 0, total: 0 };
          ageStats.total++;
          if (votedForEntity) ageStats.wins++;
          entity.demographics.byAge.set(age, ageStats);

          // Country demographics
          const country = user?.country || 'Unknown';
          const countryStats = entity.demographics.byCountry.get(country) || { wins: 0, total: 0 };
          countryStats.total++;
          if (votedForEntity) countryStats.wins++;
          entity.demographics.byCountry.set(country, countryStats);
        });
      });

      // Calculate win rates
      const results = Array.from(entityMap.values()).map(e => ({
        ...e,
        winRate: e.wins + e.losses > 0 ? Math.round((e.wins / (e.wins + e.losses)) * 100) : 0,
      }));

      // Sort by win rate, then by total votes
      return results.sort((a, b) => {
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        return b.totalVotes - a.totalVotes;
      });
    },
    enabled: !!campaignPolls && campaignPolls.length > 0,
  });

  // Create campaign mutation
  const createCampaign = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase
        .from('poll_campaigns' as any)
        .insert({
          name: newCampaignName,
          description: newCampaignDesc || null,
          created_by: user?.id,
        })
        .select()
        .single() as any);
      if (error) throw error;
      return data as Campaign;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setNewCampaignName('');
      setNewCampaignDesc('');
      setShowCreateForm(false);
      setSelectedCampaignId(data.id);
      toast.success('Campaign created');
    },
    onError: () => toast.error('Failed to create campaign'),
  });

  // Add poll to campaign mutation
  const addPollToCampaign = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase
        .from('campaign_polls' as any)
        .insert({
          campaign_id: selectedCampaignId,
          poll_id: selectedPollId,
          entity_name: entityName,
        }) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-polls', selectedCampaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaign-results', selectedCampaignId] });
      setSelectedPollId('');
      setEntityName('');
      setShowAddPollDialog(false);
      toast.success('Poll added to campaign');
    },
    onError: () => toast.error('Failed to add poll'),
  });

  // Remove poll from campaign
  const removePoll = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from('campaign_polls' as any)
        .delete()
        .eq('id', id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-polls', selectedCampaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaign-results', selectedCampaignId] });
      toast.success('Poll removed');
    },
  });

  // Delete campaign
  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from('poll_campaigns' as any)
        .delete()
        .eq('id', id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setSelectedCampaignId(null);
      toast.success('Campaign deleted');
    },
  });

  const exportCampaignReport = () => {
    if (!results || !campaignPolls) return;

    const campaign = campaigns?.find(c => c.id === selectedCampaignId);
    
    let csvContent = `Campaign Report: ${campaign?.name || 'Unknown'}\n`;
    csvContent += `Generated: ${new Date().toISOString()}\n\n`;
    
    // Overall rankings
    csvContent += "OVERALL RANKINGS\n";
    csvContent += "Rank,Entity,Wins,Losses,Win Rate,Total Votes\n";
    results.forEach((entity, index) => {
      csvContent += `${index + 1},"${entity.name}",${entity.wins},${entity.losses},${entity.winRate}%,${entity.totalVotes}\n`;
    });

    // Demographics per entity
    results.forEach(entity => {
      csvContent += `\n\nDEMOGRAPHICS FOR: ${entity.name}\n`;
      
      csvContent += "\nBy Gender\n";
      csvContent += "Gender,Votes For Entity,Total Votes,Support Rate\n";
      entity.demographics.byGender.forEach((stats, label) => {
        const rate = stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0;
        csvContent += `"${label}",${stats.wins},${stats.total},${rate}%\n`;
      });

      csvContent += "\nBy Age Range\n";
      csvContent += "Age Range,Votes For Entity,Total Votes,Support Rate\n";
      entity.demographics.byAge.forEach((stats, label) => {
        const rate = stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0;
        csvContent += `"${label}",${stats.wins},${stats.total},${rate}%\n`;
      });

      csvContent += "\nBy Country\n";
      csvContent += "Country,Votes For Entity,Total Votes,Support Rate\n";
      entity.demographics.byCountry.forEach((stats, label) => {
        const rate = stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0;
        csvContent += `"${label}",${stats.wins},${stats.total},${rate}%\n`;
      });
    });

    // Polls in campaign
    csvContent += "\n\nPOLLS IN CAMPAIGN\n";
    csvContent += "Entity,Poll Question,Option A,Option B\n";
    campaignPolls.forEach(cp => {
      csvContent += `"${cp.entity_name}","${cp.poll.question}","${cp.poll.option_a}","${cp.poll.option_b}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `campaign-report-${campaign?.name?.replace(/\s+/g, '-').toLowerCase() || 'unknown'}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('Report exported');
  };

  const getDemographicBreakdown = (demoMap: Map<string, { wins: number; total: number }>): DemographicBreakdown[] => {
    return Array.from(demoMap.entries())
      .map(([label, stats]) => ({
        label,
        wins: stats.wins,
        total: stats.total,
        winRate: stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  };

  // Calculate current step for onboarding
  const getCurrentStep = () => {
    if (!campaigns || campaigns.length === 0) return 1;
    if (!selectedCampaignId) return 2;
    if (!campaignPolls || campaignPolls.length === 0) return 3;
    return 4; // Complete
  };

  const currentStep = getCurrentStep();

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Campaign Analytics</h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs p-4">
                <p className="font-semibold mb-2">What are Campaigns?</p>
                <p className="text-sm">Campaigns let you group multiple A/B polls to compare entities across different matchups. For example, compare how Vodafone, Orange, and Etisalat perform across various polls.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Button size="sm" onClick={() => setShowCreateForm(!showCreateForm)}>
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </Button>
        </div>

        {/* Onboarding Steps - Show when not complete */}
        {currentStep < 4 && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                Quick Setup Guide
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-1 text-xs">
                <div className={`flex flex-col items-center text-center gap-1 p-1.5 rounded ${currentStep === 1 ? 'bg-primary/20' : ''}`}>
                  {currentStep > 1 ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <CircleDot className={`h-4 w-4 ${currentStep === 1 ? 'text-primary' : 'text-muted-foreground'}`} />}
                  <span className={currentStep === 1 ? 'font-medium text-primary' : currentStep > 1 ? 'text-green-500' : 'text-muted-foreground'}>Create</span>
                </div>
                <div className={`flex flex-col items-center text-center gap-1 p-1.5 rounded ${currentStep === 2 ? 'bg-primary/20' : ''}`}>
                  {currentStep > 2 ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <CircleDot className={`h-4 w-4 ${currentStep === 2 ? 'text-primary' : 'text-muted-foreground'}`} />}
                  <span className={currentStep === 2 ? 'font-medium text-primary' : currentStep > 2 ? 'text-green-500' : 'text-muted-foreground'}>Select</span>
                </div>
                <div className={`flex flex-col items-center text-center gap-1 p-1.5 rounded ${currentStep === 3 ? 'bg-primary/20' : ''}`}>
                  {currentStep > 3 ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <CircleDot className={`h-4 w-4 ${currentStep === 3 ? 'text-primary' : 'text-muted-foreground'}`} />}
                  <span className={currentStep === 3 ? 'font-medium text-primary' : currentStep > 3 ? 'text-green-500' : 'text-muted-foreground'}>Add Polls</span>
                </div>
                <div className={`flex flex-col items-center text-center gap-1 p-1.5 rounded ${currentStep === 4 ? 'bg-primary/20' : ''}`}>
                  <CircleDot className={`h-4 w-4 ${currentStep === 4 ? 'text-green-500' : 'text-muted-foreground'}`} />
                  <span className={currentStep === 4 ? 'text-green-500' : 'text-muted-foreground'}>Results</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Create Campaign Form */}
        {showCreateForm && (
          <Card className={currentStep === 1 ? 'ring-2 ring-primary' : ''}>
            <CardHeader>
              <CardTitle className="text-base">Create New Campaign</CardTitle>
              <CardDescription>Group multiple polls to compare entities across matchups</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Example:</strong> Create "Egypt Telecom 2026" to compare Vodafone, Orange, Etisalat across polls like "Vodafone vs Orange", "Orange vs Etisalat", etc.
                </AlertDescription>
              </Alert>
              <div>
                <Label>Campaign Name</Label>
                <Input
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  placeholder="e.g., Egypt Telecom Comparison 2026"
                />
              </div>
              <div>
                <Label>Description (Optional)</Label>
                <Textarea
                  value={newCampaignDesc}
                  onChange={(e) => setNewCampaignDesc(e.target.value)}
                  placeholder="Comparing the 4 major telecom providers in Egypt..."
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => createCampaign.mutate()} 
                  disabled={!newCampaignName || createCampaign.isPending}
                >
                  {createCampaign.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Campaign
                </Button>
                <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Campaign Selector */}
        <Card className={currentStep === 2 && !showCreateForm ? 'ring-2 ring-primary' : ''}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Label>Select Campaign</Label>
              {currentStep === 2 && !showCreateForm && (
                <span className="text-xs text-primary animate-pulse">← Select or create a campaign</span>
              )}
            </div>
            <div className="flex gap-2">
              <Select value={selectedCampaignId || ''} onValueChange={setSelectedCampaignId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Choose a campaign..." />
                </SelectTrigger>
                <SelectContent>
                  {campaignsLoading ? (
                    <div className="p-4 flex justify-center">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : campaigns?.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No campaigns yet - create one first!
                    </div>
                  ) : (
                    campaigns?.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedCampaignId && (
                <Button 
                  variant="destructive" 
                  size="icon"
                  onClick={() => {
                    if (confirm('Delete this campaign?')) {
                      deleteCampaign.mutate(selectedCampaignId);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Campaign Content */}
        {selectedCampaignId && (
          <div className="space-y-4">
            {/* Polls in Campaign */}
            <Card className={currentStep === 3 ? 'ring-2 ring-primary' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      Polls in Campaign ({campaignPolls?.length || 0})
                    </CardTitle>
                    {currentStep === 3 && (
                      <span className="text-xs text-primary animate-pulse">← Add polls to compare</span>
                    )}
                  </div>
                  <Dialog open={showAddPollDialog} onOpenChange={(open) => {
                    setShowAddPollDialog(open);
                    if (!open) {
                      setAddPollMode('existing');
                      setShowCreatePollForm(false);
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant={currentStep === 3 ? "default" : "outline"}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add Poll
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Add Poll to Campaign</DialogTitle>
                      </DialogHeader>
                      
                      {/* Mode Selection */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant={addPollMode === 'existing' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => {
                            setAddPollMode('existing');
                            setShowCreatePollForm(false);
                          }}
                          className="flex-1"
                        >
                          <FileEdit className="h-4 w-4 mr-2" />
                          Add Existing
                        </Button>
                        <Button
                          variant={addPollMode === 'create' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => {
                            setAddPollMode('create');
                            setShowCreatePollForm(true);
                          }}
                          className="flex-1"
                        >
                          <PlusCircle className="h-4 w-4 mr-2" />
                          Create New
                        </Button>
                      </div>
                      
                      {addPollMode === 'existing' ? (
                        <div className="space-y-4 pt-4">
                          <Alert>
                            <Info className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                              <strong>How it works:</strong> Select a poll, then specify which entity it represents. 
                              For example, in "Vodafone vs Orange", if you're tracking Vodafone's performance, enter "Vodafone" as the entity name.
                            </AlertDescription>
                          </Alert>
                          <div>
                            <Label>1. Select Poll</Label>
                            <Select value={selectedPollId} onValueChange={(val) => {
                              setSelectedPollId(val);
                              // Auto-suggest entity name from poll options
                              const poll = allPolls?.find(p => p.id === val);
                              if (poll && !entityName) {
                                // Suggest option_a as default
                                setEntityName(poll.option_a);
                              }
                            }}>
                              <SelectTrigger>
                                <SelectValue placeholder="Choose a poll..." />
                              </SelectTrigger>
                              <SelectContent>
                                {allPolls?.filter(p => !campaignPolls?.some(cp => cp.poll_id === p.id))
                                  .map((poll) => (
                                    <SelectItem key={poll.id} value={poll.id}>
                                      <span className="line-clamp-1">{poll.question}</span>
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                            {selectedPollId && (
                              <div className="mt-2 p-2 rounded bg-secondary/50 text-xs">
                                <p className="font-medium mb-1">Poll Options:</p>
                                <div className="flex gap-2">
                                  <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="sm" 
                                    className="text-xs h-7"
                                    onClick={() => setEntityName(allPolls?.find(p => p.id === selectedPollId)?.option_a || '')}
                                  >
                                    A: {allPolls?.find(p => p.id === selectedPollId)?.option_a}
                                  </Button>
                                  <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="sm" 
                                    className="text-xs h-7"
                                    onClick={() => setEntityName(allPolls?.find(p => p.id === selectedPollId)?.option_b || '')}
                                  >
                                    B: {allPolls?.find(p => p.id === selectedPollId)?.option_b}
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                          <div>
                            <Label>2. Entity Name (which option to track)</Label>
                            <Input
                              value={entityName}
                              onChange={(e) => setEntityName(e.target.value)}
                              placeholder="e.g., Vodafone, Orange, etc."
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              This entity's wins/losses will be aggregated across all polls with this name
                            </p>
                          </div>
                          <Button 
                            onClick={() => addPollToCampaign.mutate()}
                            disabled={!selectedPollId || !entityName || addPollToCampaign.isPending}
                            className="w-full"
                          >
                            {addPollToCampaign.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Add to Campaign
                          </Button>
                        </div>
                      ) : (
                        <div className="pt-4">
                          <Alert className="mb-4">
                            <Info className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                              <strong>Create a new poll</strong> and automatically add it to this campaign. 
                              You'll need to specify which option (A or B) represents the entity you're tracking.
                            </AlertDescription>
                          </Alert>
                          {user?.id && selectedCampaignId && (
                            <PollCreationForm
                              userId={user.id}
                              campaignId={selectedCampaignId}
                              compact
                              onClose={() => {
                                setShowAddPollDialog(false);
                                setAddPollMode('existing');
                              }}
                              onSuccess={() => {
                                queryClient.invalidateQueries({ queryKey: ['campaign-polls', selectedCampaignId] });
                                queryClient.invalidateQueries({ queryKey: ['campaign-results', selectedCampaignId] });
                              }}
                            />
                          )}
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {pollsLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : campaignPolls?.length === 0 ? (
                  <div className="text-center py-6">
                    <BarChart3 className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm font-medium">No polls added yet</p>
                    <p className="text-xs text-muted-foreground mt-1 mb-3">
                      Add polls to start comparing entities across matchups
                    </p>
                    <Button size="sm" onClick={() => setShowAddPollDialog(true)}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Your First Poll
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {campaignPolls?.map((cp) => (
                      <div key={cp.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/50">
                        <div className="flex-1 min-w-0">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/20 text-primary">
                            {cp.entity_name}
                          </span>
                          <p className="text-sm truncate mt-1">{cp.poll.question}</p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removePoll.mutate(cp.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

          {/* Results */}
          {results && results.length > 0 && (
            <>
              {/* Overall Rankings */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-yellow-500" />
                      Overall Rankings
                    </CardTitle>
                    <Button size="sm" variant="outline" onClick={exportCampaignReport}>
                      <Download className="h-4 w-4 mr-2" />
                      Export Report
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {results.map((entity, index) => (
                      <div key={entity.name} className="space-y-2">
                        <button
                          className="w-full text-left"
                          onClick={() => setExpandedEntity(expandedEntity === entity.name ? null : entity.name)}
                        >
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors">
                            <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                              index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                              index === 1 ? 'bg-gray-400/20 text-gray-400' :
                              index === 2 ? 'bg-orange-600/20 text-orange-600' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              #{index + 1}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold">{entity.name}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-primary">{entity.winRate}%</span>
                                  {expandedEntity === entity.name ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                                <span className="text-green-500">{entity.wins}W</span>
                                <span className="text-red-500">{entity.losses}L</span>
                                <span>{entity.totalVotes} votes</span>
                              </div>
                            </div>
                          </div>
                        </button>

                        {/* Expanded Demographics */}
                        {expandedEntity === entity.name && (
                          <div className="ml-11 space-y-4 p-4 rounded-lg border border-border/50 bg-card">
                            {/* Gender Breakdown */}
                            <div>
                              <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                                <Users className="h-4 w-4 text-primary" />
                                Support by Gender
                              </h4>
                              <div className="space-y-2">
                                {getDemographicBreakdown(entity.demographics.byGender).map(demo => (
                                  <div key={demo.label} className="flex items-center gap-2">
                                    <span className="text-xs w-20 text-muted-foreground">{demo.label}</span>
                                    <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                                      <div 
                                        className="h-full transition-all"
                                        style={{ 
                                          width: `${demo.winRate}%`,
                                          backgroundColor: demo.label === 'Male' ? 'hsl(210, 80%, 55%)' : demo.label === 'Female' ? 'hsl(340, 75%, 55%)' : 'hsl(var(--primary))'
                                        }}
                                      />
                                    </div>
                                    <span className="text-xs font-medium w-12 text-right">{demo.winRate}%</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Age Breakdown */}
                            <div>
                              <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                                <Calendar className="h-4 w-4 text-primary" />
                                Support by Age
                              </h4>
                              <div className="space-y-2">
                                {getDemographicBreakdown(entity.demographics.byAge).map(demo => (
                                  <div key={demo.label} className="flex items-center gap-2">
                                    <span className="text-xs w-20 text-muted-foreground">{demo.label}</span>
                                    <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-primary transition-all"
                                        style={{ width: `${demo.winRate}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-medium w-12 text-right">{demo.winRate}%</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Country Breakdown */}
                            <div>
                              <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                                <Globe className="h-4 w-4 text-primary" />
                                Support by Country
                              </h4>
                              <div className="space-y-2">
                                {getDemographicBreakdown(entity.demographics.byCountry).slice(0, 5).map(demo => (
                                  <div key={demo.label} className="flex items-center gap-2">
                                    <span className="text-xs w-20 text-muted-foreground truncate">{demo.label}</span>
                                    <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-primary transition-all"
                                        style={{ width: `${demo.winRate}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-medium w-12 text-right">{demo.winRate}%</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {resultsLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
