import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, Plus, Loader2, BarChart3, Gift, 
  Users, Bell, Sparkles, X, Check, Upload, Image, Trash2, Target,
  Clock, RefreshCcw, Download, TrendingUp, Flame, Pencil, Pin, PinOff
} from 'lucide-react';
import { toast } from 'sonner';
import PollAnalytics from '@/components/admin/PollAnalytics';
import PollEditDialog from '@/components/admin/PollEditDialog';
import AdminRetentionAnalytics from '@/components/admin/AdminRetentionAnalytics';
import AdminResponseTimeAnalytics from '@/components/admin/AdminResponseTimeAnalytics';
import AdminAnalyticsExport from '@/components/admin/AdminAnalyticsExport';
import InsightHighlights from '@/components/admin/InsightHighlights';
import BrandCampaignBuilder from '@/components/admin/BrandCampaignBuilder';
import CategoryAnalytics from '@/components/admin/CategoryAnalytics';
import BrandRankingReport from '@/components/admin/BrandRankingReport';
import AnalyticsDashboard from '@/components/admin/AnalyticsDashboard';
import InsightsReport from '@/components/admin/InsightsReport';
import BrandIntelligence from '@/components/admin/BrandIntelligence';
import IndustryReport from '@/components/admin/IndustryReport';
import MonthlyLeaderboard from '@/components/admin/MonthlyLeaderboard';
import ActivePollsMonitor from '@/components/admin/ActivePollsMonitor';
import UserManagement from '@/components/admin/UserManagement';
import { useAdminFeaturePoll } from '@/hooks/usePinnedPoll';
export default function AdminDashboard() {
  const { isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [showPollForm, setShowPollForm] = useState(false);
  const [showRewardForm, setShowRewardForm] = useState(false);
  const [activeTab, setActiveTab] = useState('polls');
  const [selectedPollId, setSelectedPollId] = useState<string | null>(null);

  const handleInsightClick = (pollId: string) => {
    setSelectedPollId(pollId);
    setActiveTab('analytics');
  };

  if (!isAdmin) {
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen p-4 pb-8 safe-area-top animate-slide-up">
      {/* Header */}
      <header className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-display font-bold">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage your app content</p>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full flex flex-wrap justify-start gap-1 h-auto p-1">
          <TabsTrigger value="polls" className="text-xs px-4 py-2">Polls</TabsTrigger>
          <TabsTrigger value="campaigns" className="text-xs px-4 py-2">Campaigns</TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs px-4 py-2">Analytics</TabsTrigger>
          <TabsTrigger value="rewards" className="text-xs px-4 py-2">Rewards</TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs px-4 py-2">Notify</TabsTrigger>
          <TabsTrigger value="daily-limit" className="text-xs px-4 py-2">Daily Limit</TabsTrigger>
          <TabsTrigger value="users" className="text-xs px-4 py-2">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-4">
          <BrandCampaignBuilder />
        </TabsContent>

        <TabsContent value="polls" className="space-y-4">
          <PollsTab 
            showForm={showPollForm} 
            setShowForm={setShowPollForm} 
            userId={user?.id}
            onInsightClick={handleInsightClick}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Tabs defaultValue="dashboard" className="space-y-4">
            <TabsList className="w-full flex flex-wrap justify-start gap-1 h-auto p-1 bg-secondary/50">
              <TabsTrigger value="dashboard" className="text-xs px-3 py-1.5">Dashboard</TabsTrigger>
              <TabsTrigger value="overview" className="text-xs px-3 py-1.5">Per Poll</TabsTrigger>
              <TabsTrigger value="brands" className="text-xs px-3 py-1.5">Brands</TabsTrigger>
              <TabsTrigger value="industry" className="text-xs px-3 py-1.5">Industry</TabsTrigger>
              <TabsTrigger value="timing" className="text-xs px-3 py-1.5">Timing</TabsTrigger>
              <TabsTrigger value="retention" className="text-xs px-3 py-1.5">Retention</TabsTrigger>
              <TabsTrigger value="monitor" className="text-xs px-3 py-1.5">Monitor</TabsTrigger>
              <TabsTrigger value="export" className="text-xs px-3 py-1.5">Export</TabsTrigger>
            </TabsList>
            
            <TabsContent value="dashboard">
              <AnalyticsDashboard />
            </TabsContent>

            <TabsContent value="overview" className="space-y-6">
              <PollAnalytics initialPollId={selectedPollId} />
              <div className="border-t pt-6">
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Shareable Insights Report</h3>
                <InsightsReport />
              </div>
            </TabsContent>
            
            <TabsContent value="brands" className="space-y-6">
              <BrandRankingReport />
              <div className="border-t pt-6">
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Single Brand Deep Dive</h3>
                <BrandIntelligence />
              </div>
              <div className="border-t pt-6">
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Monthly Leaderboard</h3>
                <MonthlyLeaderboard />
              </div>
            </TabsContent>
            
            <TabsContent value="industry" className="space-y-6">
              <CategoryAnalytics />
              <div className="border-t pt-6">
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Industry PDF Report</h3>
                <IndustryReport />
              </div>
            </TabsContent>
            
            <TabsContent value="timing">
              <AdminResponseTimeAnalytics />
            </TabsContent>
            
            <TabsContent value="retention">
              <AdminRetentionAnalytics />
            </TabsContent>
            
            <TabsContent value="monitor">
              <ActivePollsMonitor />
            </TabsContent>
            
            <TabsContent value="export">
              <AdminAnalyticsExport />
            </TabsContent>
          </Tabs>
        </TabsContent>


        <TabsContent value="rewards" className="space-y-4">
          <RewardsTab 
            showForm={showRewardForm} 
            setShowForm={setShowRewardForm}
          />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <NotificationsTab />
        </TabsContent>

        <TabsContent value="daily-limit" className="space-y-4">
          <DailyLimitTab />
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <UserManagement />
        </TabsContent>

      </Tabs>
    </div>
  );
}

// Polls Tab
function PollsTab({ showForm, setShowForm, userId, onInsightClick }: { showForm: boolean; setShowForm: (v: boolean) => void; userId?: string; onInsightClick?: (pollId: string) => void }) {
  const queryClient = useQueryClient();
  const [question, setQuestion] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [imageAUrl, setImageAUrl] = useState('');
  const [imageBUrl, setImageBUrl] = useState('');
  const [imageAFile, setImageAFile] = useState<File | null>(null);
  const [imageBFile, setImageBFile] = useState<File | null>(null);
  const [imageAPreview, setImageAPreview] = useState('');
  const [imageBPreview, setImageBPreview] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [category, setCategory] = useState('');
  const [isDailyPoll, setIsDailyPoll] = useState(true);
  const [expiryType, setExpiryType] = useState('evergreen');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiCategory, setAiCategory] = useState('');
  const [aiPollCount, setAiPollCount] = useState(1);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 });
  const [targetGender, setTargetGender] = useState('');
  const [targetAgeRange, setTargetAgeRange] = useState('');
  const [targetCountry, setTargetCountry] = useState('');
  const [intentTag, setIntentTag] = useState('');
  const [showCustomIntentInput, setShowCustomIntentInput] = useState(false);
  const [customIntentName, setCustomIntentName] = useState('');
  const [trendingTopics, setTrendingTopics] = useState<any[]>([]);
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);
  const [showTrending, setShowTrending] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [editingPoll, setEditingPoll] = useState<any>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [brandFilter, setBrandFilter] = useState('');
  const [selectedPollIds, setSelectedPollIds] = useState<Set<string>>(new Set());
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const imageAInputRef = useRef<HTMLInputElement>(null);
  const imageBInputRef = useRef<HTMLInputElement>(null);

  const { featurePoll, unfeaturePoll } = useAdminFeaturePoll();
  const { data: currentFeatured } = useQuery({
    queryKey: ['admin-featured-poll'],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from('featured_polls' as any)
        .select('*')
        .gte('expires_at', now)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });
  const featuredPollId = (currentFeatured as any)?.poll_id as string | null;

  // Fetch categories from database
  const { data: categories, refetch: refetchCategories } = useQuery({
    queryKey: ['poll-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('is_preset', { ascending: false })
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Add new category mutation
  const addCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase
        .from('categories')
        .insert({ name, is_preset: false, created_by: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Category added!');
      refetchCategories();
      setCategory(newCategoryName);
      setNewCategoryName('');
      setShowNewCategoryInput(false);
    },
    onError: (error: any) => {
      if (error.message?.includes('duplicate')) {
        toast.error('Category already exists');
      } else {
        toast.error('Failed to add category');
      }
    },
  });

  const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'ogg'];
  const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime', 'video/ogg'];
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
  const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
  const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov', 'ogg'];

  const isVideoFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    return VIDEO_EXTENSIONS.includes(ext) || file.type.startsWith('video/');
  };

  const handleImageSelect = (file: File, option: 'A' | 'B') => {
    const isVideo = isVideoFile(file);
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;

    if (file.size > maxSize) {
      toast.error(`Max ${isVideo ? '50MB' : '5MB'} for ${isVideo ? 'videos' : 'images'}`);
      return;
    }

    if (isVideo) {
      const url = URL.createObjectURL(file);

      if (option === 'A') {
        setImageAFile(file);
        setImageAPreview(url);
        setImageAUrl('');
      } else {
        setImageBFile(file);
        setImageBPreview(url);
        setImageBUrl('');
      }

      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (option === 'A') {
        setImageAFile(file);
        setImageAPreview(e.target?.result as string);
        setImageAUrl('');
      } else {
        setImageBFile(file);
        setImageBPreview(e.target?.result as string);
        setImageBUrl('');
      }
    };
    reader.readAsDataURL(file);
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!ALLOWED_MEDIA_TYPES.includes(file.type)) {
      toast.error('Allowed: JPEG, PNG, GIF, WebP, MP4, WebM, MOV, OGG');
      return null;
    }

    const isVideo = isVideoFile(file);
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (file.size > maxSize) {
      toast.error(`Max ${isVideo ? '50MB' : '5MB'}`);
      return null;
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!fileExt || !ALLOWED_EXTENSIONS.includes(fileExt)) {
      toast.error('Invalid file extension');
      return null;
    }

    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `polls/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('poll-images')
      .upload(filePath, file, {
        contentType: file.type,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return null;
    }

    const { data } = supabase.storage
      .from('poll-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const { data: polls, isLoading } = useQuery({
    queryKey: ['admin-polls'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('polls')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredPolls = polls?.filter((poll) => {
    if (!brandFilter.trim()) return true;
    const term = brandFilter.toLowerCase();
    return (
      poll.option_a.toLowerCase().includes(term) ||
      poll.option_b.toLowerCase().includes(term) ||
      poll.question.toLowerCase().includes(term) ||
      (poll.category && poll.category.toLowerCase().includes(term))
    );
  });

  const createPollMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Not authenticated');
      
      setIsUploading(true);
      
      // Upload images if files are selected
      let finalImageAUrl = imageAUrl;
      let finalImageBUrl = imageBUrl;
      
      if (imageAFile) {
        const uploadedUrl = await uploadImage(imageAFile);
        if (uploadedUrl) finalImageAUrl = uploadedUrl;
      }
      
      if (imageBFile) {
        const uploadedUrl = await uploadImage(imageBFile);
        if (uploadedUrl) finalImageBUrl = uploadedUrl;
      }
      
      // Set time windows based on expiry type
      const startsAt = new Date();
      let endsAt: Date | null = null;
      
      if (expiryType === 'trending') {
        endsAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
      } else if (expiryType === 'campaign') {
        // End of current month (default; campaigns sync via DB trigger when set)
        endsAt = new Date(startsAt.getFullYear(), startsAt.getMonth() + 1, 0, 23, 59, 59);
      } else if (isDailyPoll) {
        endsAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      }
      // Evergreen: no ends_at
      
      const { error } = await supabase
        .from('polls')
        .insert({
          question,
          option_a: optionA,
          option_b: optionB,
          image_a_url: finalImageAUrl || null,
          image_b_url: finalImageBUrl || null,
          category: category || null,
          created_by: userId,
          is_daily_poll: isDailyPoll,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt ? endsAt.toISOString() : null,
          target_gender: targetGender || null,
          target_age_range: targetAgeRange || null,
          target_country: targetCountry || null,
          intent_tag: intentTag || null,
          expiry_type: expiryType,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-polls'] });
      toast.success(`Poll created (${expiryType === 'evergreen' ? 'Evergreen' : expiryType === 'trending' ? '48h Trending' : 'Campaign'})!`);
      setShowForm(false);
      setQuestion('');
      setOptionA('');
      setOptionB('');
      setImageAUrl('');
      setImageBUrl('');
      setImageAFile(null);
      setImageBFile(null);
      setImageAPreview('');
      setImageBPreview('');
      setCategory('');
      setIsDailyPoll(true);
      setExpiryType('evergreen');
      setIsUploading(false);
      setTargetGender('');
      setTargetAgeRange('');
      setTargetCountry('');
      setIntentTag('');
    },
    onError: () => {
      toast.error('Failed to create poll');
      setIsUploading(false);
    },
  });

  const generateAIPoll = async () => {
    if (!userId) {
      toast.error('Not authenticated');
      return;
    }
    
    const count = Math.min(Math.max(aiPollCount, 1), 10); // Clamp between 1-10
    setIsGenerating(true);
    setGenerationProgress({ current: 0, total: count });
    
    const results: { success: number; failed: number; polls: string[] } = { 
      success: 0, 
      failed: 0,
      polls: []
    };
    
    for (let i = 0; i < count; i++) {
      setGenerationProgress({ current: i + 1, total: count });
      
      try {
        const { data, error } = await supabase.functions.invoke('generate-poll', {
          body: { 
            category: aiCategory || null, 
            userId,
            targetAgeRange: targetAgeRange || null,
            targetGender: targetGender || null,
            targetCountry: targetCountry || null,
          }
        });

        if (error) throw error;

        if (data?.duplicate) {
          results.failed++;
          toast.message('Skipped duplicate poll', { description: data.error });
        } else if (data?.error) {
          throw new Error(data.error);
        } else if (data?.poll) {
          results.success++;
          results.polls.push(data.poll.question);
        }
        
        // Small delay between polls to avoid rate limits (except for last one)
        if (i < count - 1) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      } catch (error: any) {
        console.error(`AI generation error (poll ${i + 1}):`, error);
        results.failed++;
        
        // If rate limited, stop early
        if (error.message?.includes('Rate limit') || error.message?.includes('429')) {
          toast.error('Rate limit reached. Try again later.');
          break;
        }
      }
    }
    
    queryClient.invalidateQueries({ queryKey: ['admin-polls'] });
    
    if (results.success > 0) {
      toast.success(`Generated ${results.success} poll${results.success > 1 ? 's' : ''}!`, {
        description: results.failed > 0 ? `${results.failed} failed` : undefined
      });
    } else {
      toast.error('Failed to generate polls');
    }
    
    setAiCategory('');
    setAiPollCount(1);
    setTargetAgeRange('');
    setTargetGender('');
    setTargetCountry('');
    setIsGenerating(false);
    setGenerationProgress({ current: 0, total: 0 });
  };

  const deletePollMutation = useMutation({
    mutationFn: async (pollId: string) => {
      // First delete related votes
      await supabase.from('votes').delete().eq('poll_id', pollId);
      // Delete related favorites
      await supabase.from('favorite_polls').delete().eq('poll_id', pollId);
      // Delete related boosts
      await supabase.from('poll_boosts').delete().eq('poll_id', pollId);
      // Delete related sponsored polls
      await supabase.from('sponsored_polls').delete().eq('poll_id', pollId);
      // Finally delete the poll
      const { error } = await supabase.from('polls').delete().eq('id', pollId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-polls'] });
      toast.success('Poll deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete poll');
    },
  });

  const toggleSelectPoll = (pollId: string) => {
    setSelectedPollIds(prev => {
      const next = new Set(prev);
      if (next.has(pollId)) next.delete(pollId);
      else next.add(pollId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!filteredPolls) return;
    if (selectedPollIds.size === filteredPolls.length) {
      setSelectedPollIds(new Set());
    } else {
      setSelectedPollIds(new Set(filteredPolls.map(p => p.id)));
    }
  };

  const bulkDeletePolls = async () => {
    if (selectedPollIds.size === 0) return;
    if (!confirm(`Delete ${selectedPollIds.size} poll(s)? This will also delete all their votes.`)) return;
    
    setIsDeletingBulk(true);
    try {
      const ids = Array.from(selectedPollIds);
      await supabase.from('votes').delete().in('poll_id', ids);
      await supabase.from('favorite_polls').delete().in('poll_id', ids);
      await supabase.from('poll_boosts').delete().in('poll_id', ids);
      await supabase.from('sponsored_polls').delete().in('poll_id', ids);
      await supabase.from('campaign_polls').delete().in('poll_id', ids);
      await supabase.from('poll_dimensions').delete().in('poll_id', ids);
      const { error } = await supabase.from('polls').delete().in('id', ids);
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['admin-polls'] });
      toast.success(`Deleted ${ids.length} poll(s)`);
      setSelectedPollIds(new Set());
    } catch {
      toast.error('Failed to delete polls');
    } finally {
      setIsDeletingBulk(false);
    }
  };

  return (
    <>
      {/* Insight Highlights - The Weapon */}
      <InsightHighlights onPollSelect={onInsightClick} />

      {/* Brand/Option Filter */}
      <div className="relative">
        <Input
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
          placeholder="Filter by brand or option name..."
          className="bg-secondary pl-9"
        />
        <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        {brandFilter && (
          <button
            onClick={() => setBrandFilter('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Polls ({filteredPolls?.length || 0})</h2>
          {filteredPolls && filteredPolls.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              {selectedPollIds.size === filteredPolls.length ? 'Deselect all' : 'Select all'}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedPollIds.size > 0 && (
            <Button
              size="sm"
              variant="destructive"
              onClick={bulkDeletePolls}
              disabled={isDeletingBulk}
            >
              {isDeletingBulk ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              Delete {selectedPollIds.size}
            </Button>
          )}
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Poll
          </Button>
        </div>
      </div>

      {/* AI Poll Generator */}
      <div className="glass rounded-xl p-4 space-y-3 border-2 border-primary/20">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">AI Poll Generator</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Let AI create engaging polls based on trending topics
        </p>
        
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input 
              value={aiCategory}
              onChange={(e) => setAiCategory(e.target.value)}
              placeholder="Category (optional)"
              className="bg-secondary pr-10"
              disabled={isGenerating}
            />
            <button
              type="button"
              onClick={async () => {
                if (trendingTopics.length > 0) {
                  setShowTrending(!showTrending);
                  return;
                }
                setIsLoadingTrends(true);
                try {
                  const { data, error } = await supabase.functions.invoke('get-trending-topics');
                  if (error) throw error;
                  if (data?.topics) {
                    setTrendingTopics(data.topics);
                    setShowTrending(true);
                  }
                } catch (err) {
                  console.error('Failed to fetch trends:', err);
                  toast.error('Failed to fetch trending topics');
                } finally {
                  setIsLoadingTrends(false);
                }
              }}
              disabled={isGenerating || isLoadingTrends}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-primary/10 transition-colors"
              title="Get trending topics"
            >
              {isLoadingTrends ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <TrendingUp className="h-4 w-4 text-primary" />
              )}
            </button>
          </div>
          <select
            value={aiPollCount}
            onChange={(e) => setAiPollCount(Number(e.target.value))}
            className="bg-secondary border border-border rounded-md px-3 py-2 text-sm min-w-[70px]"
            disabled={isGenerating}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
              <option key={n} value={n}>{n}x</option>
            ))}
          </select>
        </div>

        {/* Trending Topics Suggestions */}
        {showTrending && trendingTopics.length > 0 && (
          <div className="space-y-2 p-3 bg-secondary/50 rounded-lg border border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Flame className="h-4 w-4 text-orange-500" />
                <span>Trending Now</span>
              </div>
              <button
                onClick={() => {
                  setTrendingTopics([]);
                  setIsLoadingTrends(true);
                  supabase.functions.invoke('get-trending-topics').then(({ data }) => {
                    if (data?.topics) setTrendingTopics(data.topics);
                    setIsLoadingTrends(false);
                  }).catch(() => setIsLoadingTrends(false));
                }}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <RefreshCcw className="h-3 w-3" />
                Refresh
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {trendingTopics.map((topic, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setAiCategory(topic.category);
                    setShowTrending(false);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-background rounded-full text-xs hover:bg-primary/10 transition-colors border border-border/50"
                >
                  <span className="font-medium">{topic.category}</span>
                  {topic.heat_score >= 80 && (
                    <span className="text-orange-500">🔥</span>
                  )}
                </button>
              ))}
            </div>
            {trendingTopics[0]?.trending_reason && (
              <p className="text-xs text-muted-foreground mt-1">
                💡 {trendingTopics.find(t => t.category === aiCategory)?.trending_reason || trendingTopics[0].trending_reason}
              </p>
            )}
          </div>
        )}
        
        {/* Audience Targeting */}
        <div className="space-y-2 pt-2 border-t border-border/50">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Target className="h-4 w-4" />
            <span>Audience Targeting (optional)</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select
              value={targetAgeRange}
              onChange={(e) => setTargetAgeRange(e.target.value)}
              className="bg-secondary border border-border rounded-md px-2 py-1.5 text-xs"
              disabled={isGenerating}
            >
              <option value="">All Ages</option>
              <option value="13-17">13-17</option>
              <option value="18-24">18-24</option>
              <option value="25-34">25-34</option>
              <option value="35-44">35-44</option>
              <option value="45+">45+</option>
            </select>
            <select
              value={targetGender}
              onChange={(e) => setTargetGender(e.target.value)}
              className="bg-secondary border border-border rounded-md px-2 py-1.5 text-xs"
              disabled={isGenerating}
            >
              <option value="">All Genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
            <select
              value={targetCountry}
              onChange={(e) => setTargetCountry(e.target.value)}
              className="bg-secondary border border-border rounded-md px-2 py-1.5 text-xs"
              disabled={isGenerating}
            >
              <option value="">All Countries</option>
              <option value="SA">Saudi Arabia</option>
              <option value="AE">UAE</option>
              <option value="QA">Qatar</option>
              <option value="KW">Kuwait</option>
              <option value="BH">Bahrain</option>
              <option value="OM">Oman</option>
              <option value="JO">Jordan</option>
              <option value="LB">Lebanon</option>
              <option value="IQ">Iraq</option>
              <option value="PS">Palestine</option>
              <option value="SY">Syria</option>
              <option value="YE">Yemen</option>
              <option value="EG">Egypt</option>
            </select>
          </div>
        </div>
        
        <Button 
          onClick={generateAIPoll}
          disabled={isGenerating}
          className="w-full bg-gradient-primary"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Generating {generationProgress.current}/{generationProgress.total}...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate {aiPollCount > 1 ? `${aiPollCount} Polls` : 'Poll'}
            </>
          )}
        </Button>
        
        {isGenerating && generationProgress.total > 1 && (
          <div className="space-y-1">
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${(generationProgress.current / generationProgress.total) * 100}%` }}
              />
            </div>
            <p className="text-xs text-center text-muted-foreground">
              Creating poll {generationProgress.current} of {generationProgress.total}...
            </p>
          </div>
        )}
      </div>

      {showForm && (
        <div className="glass rounded-xl p-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Create Poll</h3>
            <button onClick={() => setShowForm(false)}>
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
          
          <div className="space-y-3">
            <div>
              <Label>Question</Label>
              <Input 
                value={question} 
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What do you prefer?"
                className="bg-secondary"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Option A</Label>
                <Input 
                  value={optionA} 
                  onChange={(e) => setOptionA(e.target.value)}
                  placeholder="First option"
                  className="bg-secondary"
                />
              </div>
              <div>
                <Label>Option B</Label>
                <Input 
                  value={optionB} 
                  onChange={(e) => setOptionB(e.target.value)}
                  placeholder="Second option"
                  className="bg-secondary"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Image A</Label>
                <input 
                  type="file" 
                  accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.mov,.ogg"
                  ref={imageAInputRef}
                  onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0], 'A')}
                  className="hidden"
                />
                {imageAPreview ? (
                  <div className="relative mt-2">
                    {imageAFile && isVideoFile(imageAFile) ? (
                      <video src={imageAPreview} className="w-full h-24 object-cover rounded-lg" muted autoPlay loop playsInline />
                    ) : (
                      <img src={imageAPreview} alt="Option A" className="w-full h-24 object-cover rounded-lg" />
                    )}
                    <button 
                      onClick={() => { setImageAFile(null); setImageAPreview(''); }}
                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full mt-2"
                    onClick={() => imageAInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </Button>
                )}
                {!imageAPreview && (
                  <Input 
                    value={imageAUrl} 
                    onChange={(e) => setImageAUrl(e.target.value)}
                    placeholder="Or paste URL..."
                    className="bg-secondary mt-2 text-xs"
                  />
                )}
              </div>
              <div>
                <Label>Image B</Label>
                <input 
                  type="file" 
                  accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.mov,.ogg"
                  ref={imageBInputRef}
                  onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0], 'B')}
                  className="hidden"
                />
                {imageBPreview ? (
                  <div className="relative mt-2">
                    {imageBFile && isVideoFile(imageBFile) ? (
                      <video src={imageBPreview} className="w-full h-24 object-cover rounded-lg" muted autoPlay loop playsInline />
                    ) : (
                      <img src={imageBPreview} alt="Option B" className="w-full h-24 object-cover rounded-lg" />
                    )}
                    <button 
                      onClick={() => { setImageBFile(null); setImageBPreview(''); }}
                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full mt-2"
                    onClick={() => imageBInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </Button>
                )}
                {!imageBPreview && (
                  <Input 
                    value={imageBUrl} 
                    onChange={(e) => setImageBUrl(e.target.value)}
                    placeholder="Or paste URL..."
                    className="bg-secondary mt-2 text-xs"
                  />
                )}
              </div>
            </div>
            <div>
              <Label>Category</Label>
              {showNewCategoryInput ? (
                <div className="flex gap-2 mt-1">
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Enter new category name..."
                    className="bg-secondary flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      if (newCategoryName.trim()) {
                        addCategoryMutation.mutate(newCategoryName.trim());
                      }
                    }}
                    disabled={!newCategoryName.trim() || addCategoryMutation.isPending}
                  >
                    {addCategoryMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowNewCategoryInput(false);
                      setNewCategoryName('');
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="flex-1 h-10 px-3 rounded-md bg-secondary border border-border text-sm"
                  >
                    <option value="">Select a category...</option>
                    {categories?.map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name} {!cat.is_preset && '(custom)'}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowNewCategoryInput(true)}
                    title="Add new category"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <input 
                type="checkbox" 
                id="isDailyPoll"
                checked={isDailyPoll} 
                onChange={(e) => setIsDailyPoll(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="isDailyPoll" className="text-sm">
                Daily Poll (24-hour visibility)
              </Label>
            </div>

            {/* Expiry Type */}
            <div className="border-t border-border pt-4 mt-2">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-primary" />
                <Label className="font-semibold">Expiry Type</Label>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'evergreen', label: '♾️ Evergreen', desc: 'Never expires' },
                  { value: 'trending', label: '⚡ Trending', desc: '48 hours' },
                  { value: 'campaign', label: '🏆 Campaign', desc: 'Ends with campaign' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setExpiryType(opt.value)}
                    className={`p-2 rounded-lg border text-center transition-colors ${
                      expiryType === opt.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-secondary text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    <span className="text-sm font-medium block">{opt.label}</span>
                    <span className="text-[10px] block mt-0.5">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Demographic Targeting */}
            <div className="border-t border-border pt-4 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-4 w-4 text-primary" />
                <Label className="font-semibold">Demographic Targeting (Optional)</Label>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Gender</Label>
                  <select
                    value={targetGender}
                    onChange={(e) => setTargetGender(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-input bg-secondary text-sm"
                  >
                    <option value="">All</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Age Range</Label>
                  <select
                    value={targetAgeRange}
                    onChange={(e) => setTargetAgeRange(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-input bg-secondary text-sm"
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
                <div>
                  <Label className="text-xs">Country</Label>
                  <select
                    value={targetCountry}
                    onChange={(e) => setTargetCountry(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-input bg-secondary text-sm"
                  >
                    <option value="">All</option>
                    <option value="Saudi Arabia">Saudi Arabia</option>
                    <option value="United Arab Emirates">UAE</option>
                    <option value="Qatar">Qatar</option>
                    <option value="Kuwait">Kuwait</option>
                    <option value="Bahrain">Bahrain</option>
                    <option value="Oman">Oman</option>
                    <option value="Jordan">Jordan</option>
                    <option value="Lebanon">Lebanon</option>
                    <option value="Iraq">Iraq</option>
                    <option value="Palestine">Palestine</option>
                    <option value="Syria">Syria</option>
                    <option value="Yemen">Yemen</option>
                    <option value="Egypt">Egypt</option>
                  </select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Leave as "All" to show poll to everyone
              </p>
            </div>
            
            {/* Poll Intent Tag (Internal Only) */}
            <div className="border-t border-border pt-4 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="h-4 w-4 text-primary">🏷️</span>
                <Label className="font-semibold">Poll Intent (Internal Only)</Label>
              </div>
              {showCustomIntentInput ? (
                <div className="flex gap-2">
                  <Input
                    value={customIntentName}
                    onChange={(e) => setCustomIntentName(e.target.value)}
                    placeholder="Enter custom intent tag..."
                    className="bg-secondary flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      if (customIntentName.trim()) {
                        setIntentTag(customIntentName.trim());
                        setCustomIntentName('');
                        setShowCustomIntentInput(false);
                      }
                    }}
                    disabled={!customIntentName.trim()}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowCustomIntentInput(false);
                      setCustomIntentName('');
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select
                    value={intentTag}
                    onChange={(e) => setIntentTag(e.target.value)}
                    className="flex-1 h-9 px-3 rounded-md border border-input bg-secondary text-sm"
                  >
                    <option value="">No tag</option>
                    <option value="brand_test">Brand Test</option>
                    <option value="concept_test">Concept Test</option>
                    <option value="cultural_signal">Cultural Signal</option>
                    <option value="fun_engagement">Fun/Engagement</option>
                    {intentTag && !['brand_test', 'concept_test', 'cultural_signal', 'fun_engagement', ''].includes(intentTag) && (
                      <option value={intentTag}>{intentTag} (custom)</option>
                    )}
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowCustomIntentInput(true)}
                    title="Add custom intent tag"
                    className="shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Users don't see this — buyers/admins do
              </p>
            </div>
            
            <Button
              onClick={() => createPollMutation.mutate()}
              disabled={!question || !optionA || !optionB || createPollMutation.isPending || isUploading}
              className="w-full bg-gradient-primary"
            >
              {(createPollMutation.isPending || isUploading) ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {isUploading ? 'Uploading...' : 'Creating...'}
                </>
              ) : 'Create Poll'}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPolls?.map((poll) => {
            const isExpired = poll.ends_at && new Date(poll.ends_at) < new Date();
            const isLive = poll.starts_at && poll.ends_at && 
              new Date(poll.starts_at) <= new Date() && 
              new Date(poll.ends_at) >= new Date();
            
            return (
              <div key={poll.id} className={`glass rounded-xl p-4 ${selectedPollIds.has(poll.id) ? 'ring-2 ring-primary' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedPollIds.has(poll.id)}
                      onChange={() => toggleSelectPoll(poll.id)}
                      className="h-4 w-4 rounded border-border accent-primary shrink-0"
                    />
                    {poll.category && (
                      <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs">
                        {poll.category}
                      </span>
                    )}
                    {poll.is_daily_poll && (
                      <span className="px-2 py-0.5 rounded-full bg-accent/20 text-accent text-xs">
                        Daily
                      </span>
                    )}
                    {poll.intent_tag && (
                      <span className="px-2 py-0.5 rounded-full bg-secondary text-foreground text-xs border border-border">
                        {poll.intent_tag === 'brand_test' ? '🏢 Brand' :
                         poll.intent_tag === 'concept_test' ? '💡 Concept' :
                         poll.intent_tag === 'cultural_signal' ? '🌍 Cultural' :
                         poll.intent_tag === 'fun_engagement' ? '🎮 Fun' : poll.intent_tag}
                      </span>
                    )}
                    {(poll as any).expiry_type && (poll as any).expiry_type !== 'evergreen' && (
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        (poll as any).expiry_type === 'trending' ? 'bg-orange-500/20 text-orange-600' : 'bg-primary/20 text-primary'
                      }`}>
                        {(poll as any).expiry_type === 'trending' ? '⚡ Trending' : '🏆 Campaign'}
                      </span>
                    )}
                    {(() => {
                      const et = (poll as any).expiry_type;
                      const ea = (poll as any).ends_at;
                      if (et !== 'evergreen' && ea && new Date(ea) <= new Date()) {
                        return (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground border border-border">
                            🔒 Closed
                          </span>
                        );
                      }
                      return null;
                    })()}
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      isExpired ? 'bg-muted text-muted-foreground' :
                      isLive ? 'bg-success/20 text-success' :
                      'bg-warning/20 text-warning'
                    }`}>
                      {isExpired ? 'Expired' : isLive ? 'Live' : 'Scheduled'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const isFeatured = featuredPollId === poll.id;
                        if (isFeatured) {
                          unfeaturePoll.mutate(undefined, {
                            onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-featured-poll'] }); toast.success('Unfeatured'); },
                          });
                        } else {
                          featurePoll.mutate(poll.id, {
                            onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-featured-poll'] }); toast.success('Featured for all users until midnight!'); },
                          });
                        }
                      }}
                      className={featuredPollId === poll.id ? 'text-warning hover:text-warning hover:bg-warning/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}
                      title={featuredPollId === poll.id ? 'Unfeature poll' : 'Feature poll for all users'}
                    >
                      {featuredPollId === poll.id ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingPoll(poll);
                        setShowEditDialog(true);
                      }}
                      className="text-primary hover:text-primary hover:bg-primary/10"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this poll? This will also delete all votes.')) {
                          deletePollMutation.mutate(poll.id);
                        }
                      }}
                      disabled={deletePollMutation.isPending}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      {deletePollMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <h3 className="font-medium">{poll.question}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  A: {poll.option_a} • B: {poll.option_b}
                </p>
                {poll.ends_at && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {isExpired ? 'Expired' : 'Expires'}: {new Date(poll.ends_at).toLocaleString()}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <PollEditDialog
        poll={editingPoll}
        open={showEditDialog}
        onOpenChange={(open) => {
          setShowEditDialog(open);
          if (!open) setEditingPoll(null);
        }}
      />
    </>
  );
}

// Rewards Tab
function RewardsTab({ showForm, setShowForm }: { showForm: boolean; setShowForm: (v: boolean) => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [costPoints, setCostPoints] = useState('500');

  const { data: rewards, isLoading } = useQuery({
    queryKey: ['admin-rewards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rewards')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createRewardMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('rewards')
        .insert({
          title,
          description,
          cost_points: parseInt(costPoints),
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-rewards'] });
      toast.success('Reward created!');
      setShowForm(false);
      setTitle('');
      setDescription('');
    },
    onError: () => toast.error('Failed to create reward'),
  });

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Rewards ({rewards?.length || 0})</h2>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Reward
        </Button>
      </div>

      {showForm && (
        <div className="glass rounded-xl p-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Create Reward</h3>
            <button onClick={() => setShowForm(false)}>
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
          
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input 
                value={title} 
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Premium Badge"
                className="bg-secondary"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea 
                value={description} 
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Unlock a special profile badge"
                className="bg-secondary"
              />
            </div>
            <div>
              <Label>Cost (points)</Label>
              <Input 
                type="number"
                value={costPoints} 
                onChange={(e) => setCostPoints(e.target.value)}
                className="bg-secondary"
              />
            </div>
            
            <Button 
              onClick={() => createRewardMutation.mutate()}
              disabled={!title || !description || createRewardMutation.isPending}
              className="w-full bg-gradient-primary"
            >
              {createRewardMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Reward'}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-3">
          {rewards?.map((reward) => (
            <div key={reward.id} className="glass rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">{reward.title}</h3>
                <span className="text-primary text-sm font-bold">{reward.cost_points} pts</span>
              </div>
              <p className="text-sm text-muted-foreground">{reward.description}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// Daily Limit Tab
function DailyLimitTab() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin-daily-settings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('daily_poll_settings')
        .select('*')
        .limit(1)
        .single();
      return data;
    },
  });

  const [dailyLimit, setDailyLimit] = useState(15);
  const [firstDayLimit, setFirstDayLimit] = useState(20);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setDailyLimit(settings.daily_limit);
      setFirstDayLimit(settings.first_day_limit);
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (settings) {
        const { error } = await supabase
          .from('daily_poll_settings')
          .update({ 
            daily_limit: dailyLimit, 
            first_day_limit: firstDayLimit,
            updated_by: user?.id,
          })
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('daily_poll_settings')
          .insert({ 
            daily_limit: dailyLimit, 
            first_day_limit: firstDayLimit,
            updated_by: user?.id,
          });
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ['admin-daily-settings'] });
      queryClient.invalidateQueries({ queryKey: ['daily-poll-settings'] });
      toast.success('Daily limit settings saved!');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-4 space-y-5">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Target className="h-5 w-5 text-primary" />
        Daily Poll Limit
      </h2>
      <p className="text-sm text-muted-foreground">
        Control how many new polls each user gets per day. Lower limits create daily habit loops (like Wordle).
      </p>

      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">Daily Limit (returning users)</Label>
          <div className="flex items-center gap-3 mt-1">
            <Input
              type="number"
              min={1}
              max={100}
              value={dailyLimit}
              onChange={(e) => setDailyLimit(Number(e.target.value))}
              className="bg-secondary w-24"
            />
            <span className="text-sm text-muted-foreground">polls per day</span>
          </div>
        </div>

        <div>
          <Label className="text-sm font-medium">First Day Limit (new users)</Label>
          <div className="flex items-center gap-3 mt-1">
            <Input
              type="number"
              min={1}
              max={100}
              value={firstDayLimit}
              onChange={(e) => setFirstDayLimit(Number(e.target.value))}
              className="bg-secondary w-24"
            />
            <span className="text-sm text-muted-foreground">polls on first day</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Give new users extra content to get hooked.</p>
        </div>

        <div className="bg-secondary/50 rounded-lg p-3 space-y-1.5">
          <p className="text-xs font-medium text-foreground">Quick presets:</p>
          <div className="flex gap-2 flex-wrap">
            {[
              { label: 'Normal (15)', daily: 15, first: 20 },
              { label: 'Event (25)', daily: 25, first: 30 },
              { label: 'Ramadan (20)', daily: 20, first: 25 },
              { label: 'Weekend (30)', daily: 30, first: 35 },
            ].map(preset => (
              <button
                key={preset.label}
                onClick={() => { setDailyLimit(preset.daily); setFirstDayLimit(preset.first); }}
                className="text-[10px] px-2.5 py-1 rounded-full bg-primary/10 text-primary font-bold hover:bg-primary/20 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-gradient-primary"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}

// Notifications Tab
function NotificationsTab() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<{ push: number; inApp: number } | null>(null);

  const sendBroadcastMutation = useMutation({
    mutationFn: async () => {
      setSending(true);
      setLastResult(null);

      // 1. Send push notifications via edge function
      const { data: pushResult, error: pushError } = await supabase.functions.invoke('send-push-notification', {
        body: {
          title,
          body,
          url: link || '/home',
        },
      });

      if (pushError) {
        console.error('Push error:', pushError);
      }

      // 2. Also store in-app notifications for users without push
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id');

      if (usersError) throw usersError;

      const notifications = users.map(user => ({
        user_id: user.id,
        title,
        body,
        type: 'broadcast',
        data: link ? { url: link } : null,
      }));

      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (notifError) throw notifError;

      return {
        pushSent: pushResult?.sent ?? 0,
        inAppCount: users.length,
      };
    },
    onSuccess: (data) => {
      toast.success(`Broadcast sent! ${data.pushSent} push + ${data.inAppCount} in-app`);
      setLastResult({ push: data.pushSent, inApp: data.inAppCount });
      setTitle('');
      setBody('');
      setLink('');
      setSending(false);
    },
    onError: () => {
      toast.error('Failed to send broadcast');
      setSending(false);
    },
  });

  return (
    <div className="glass rounded-xl p-4 space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Bell className="h-5 w-5 text-primary" />
        Broadcast Push & In-App
      </h2>
      <p className="text-xs text-muted-foreground">
        Sends a real push notification to all subscribed devices + an in-app notification for everyone.
      </p>
      
      <div className="space-y-3">
        <div>
          <Label>Title</Label>
          <Input 
            value={title} 
            onChange={(e) => setTitle(e.target.value)}
            placeholder="🔥 New polls just dropped!"
            className="bg-secondary"
            maxLength={100}
          />
        </div>
        <div>
          <Label>Message</Label>
          <Textarea 
            value={body} 
            onChange={(e) => setBody(e.target.value)}
            placeholder="Come vote on today's battles..."
            className="bg-secondary"
            maxLength={200}
          />
        </div>
        <div>
          <Label>Link (optional)</Label>
          <Input 
            value={link} 
            onChange={(e) => setLink(e.target.value)}
            placeholder="/home or /explore"
            className="bg-secondary"
            maxLength={200}
          />
          <p className="text-xs text-muted-foreground mt-1">Where users land when they tap the notification</p>
        </div>

        {lastResult && (
          <div className="p-3 rounded-lg bg-primary/10 text-sm space-y-1">
            <p className="font-medium text-primary">✅ Last broadcast sent</p>
            <p className="text-muted-foreground">{lastResult.push} push notifications · {lastResult.inApp} in-app</p>
          </div>
        )}
        
        <Button 
          onClick={() => sendBroadcastMutation.mutate()}
          disabled={!title || !body || sending}
          className="w-full bg-gradient-primary"
        >
          {sending ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Sending...</>
          ) : (
            '📢 Send Broadcast to All Users'
          )}
        </Button>
      </div>
    </div>
  );
}