import { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, X, Check, Upload, Target, Plus } from 'lucide-react';
import { toast } from 'sonner';

// Image upload validation constants
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

interface PollCreationFormProps {
  userId: string;
  onClose: () => void;
  onSuccess?: (pollId: string, optionA: string, optionB: string) => void;
  campaignId?: string;
  entityName?: string;
  compact?: boolean;
}

export default function PollCreationForm({ 
  userId, 
  onClose, 
  onSuccess,
  campaignId,
  entityName: initialEntityName,
  compact = false
}: PollCreationFormProps) {
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
  const [targetGender, setTargetGender] = useState('');
  const [targetAgeRange, setTargetAgeRange] = useState('');
  const [targetCountry, setTargetCountry] = useState('');
  const [intentTag, setIntentTag] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [entityName, setEntityName] = useState(initialEntityName || '');
  
  const imageAInputRef = useRef<HTMLInputElement>(null);
  const imageBInputRef = useRef<HTMLInputElement>(null);

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

  const handleImageSelect = (file: File, option: 'A' | 'B') => {
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
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Only image files are allowed (JPEG, PNG, GIF, WebP)');
      return null;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      toast.error('File size must be less than 5MB');
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
      
      // Set 24-hour window for daily polls
      const startsAt = new Date();
      const endsAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      const { data: poll, error } = await supabase
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
          ends_at: endsAt.toISOString(),
          target_gender: targetGender || null,
          target_age_range: targetAgeRange || null,
          target_country: targetCountry || null,
          intent_tag: intentTag || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // If this is part of a campaign, add to campaign_polls
      if (campaignId && entityName && poll) {
        const { error: campaignError } = await (supabase
          .from('campaign_polls' as any)
          .insert({
            campaign_id: campaignId,
            poll_id: poll.id,
            entity_name: entityName,
          }) as any);
        
        if (campaignError) {
          console.error('Failed to add poll to campaign:', campaignError);
          // Don't throw - poll was created successfully
        }
      }
      
      return poll;
    },
    onSuccess: (poll) => {
      queryClient.invalidateQueries({ queryKey: ['admin-polls'] });
      if (campaignId) {
        queryClient.invalidateQueries({ queryKey: ['campaign-polls', campaignId] });
        queryClient.invalidateQueries({ queryKey: ['campaign-results', campaignId] });
        queryClient.invalidateQueries({ queryKey: ['all-polls-for-campaign'] });
      }
      toast.success(campaignId ? 'Poll created and added to campaign!' : 'Poll created with 24-hour window!');
      
      if (onSuccess && poll) {
        onSuccess(poll.id, poll.option_a, poll.option_b);
      }
      
      onClose();
    },
    onError: () => {
      toast.error('Failed to create poll');
      setIsUploading(false);
    },
  });

  return (
    <div className={`space-y-4 ${compact ? '' : 'glass rounded-xl p-4'}`}>
      {!compact && (
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">{campaignId ? 'Create Poll for Campaign' : 'Create Poll'}</h3>
          <button onClick={onClose}>
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      )}
      
      {/* Campaign Entity Selection */}
      {campaignId && (
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
          <Label className="text-xs font-medium text-primary">Entity to Track in Campaign</Label>
          <p className="text-xs text-muted-foreground mb-2">
            Which option represents the entity you want to track? (e.g., "Vodafone" in a telecom comparison)
          </p>
          <div className="flex gap-2 flex-wrap">
            {optionA && (
              <Button
                type="button"
                variant={entityName === optionA ? "default" : "outline"}
                size="sm"
                onClick={() => setEntityName(optionA)}
                className="text-xs"
              >
                A: {optionA}
              </Button>
            )}
            {optionB && (
              <Button
                type="button"
                variant={entityName === optionB ? "default" : "outline"}
                size="sm"
                onClick={() => setEntityName(optionB)}
                className="text-xs"
              >
                B: {optionB}
              </Button>
            )}
            <Input
              value={entityName}
              onChange={(e) => setEntityName(e.target.value)}
              placeholder="Or enter custom entity name..."
              className="flex-1 min-w-[150px] h-8 text-xs bg-background"
            />
          </div>
        </div>
      )}
      
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
              accept="image/*"
              ref={imageAInputRef}
              onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0], 'A')}
              className="hidden"
            />
            {imageAPreview ? (
              <div className="relative mt-2">
                <img src={imageAPreview} alt="Option A" className="w-full h-24 object-cover rounded-lg" />
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
              accept="image/*"
              ref={imageBInputRef}
              onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0], 'B')}
              className="hidden"
            />
            {imageBPreview ? (
              <div className="relative mt-2">
                <img src={imageBPreview} alt="Option B" className="w-full h-24 object-cover rounded-lg" />
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
          <div className="flex gap-2">
            <select
              value={['brand_test', 'concept_test', 'cultural_signal', 'fun_engagement', ''].includes(intentTag) ? intentTag : '__custom__'}
              onChange={(e) => {
                if (e.target.value === '__custom__') {
                  setIntentTag('');
                } else {
                  setIntentTag(e.target.value);
                }
              }}
              className="flex-1 h-9 px-3 rounded-md border border-input bg-secondary text-sm"
            >
              <option value="">No tag</option>
              <option value="brand_test">Brand Test</option>
              <option value="concept_test">Concept Test</option>
              <option value="cultural_signal">Cultural Signal</option>
              <option value="fun_engagement">Fun/Engagement</option>
              <option value="__custom__">✏️ Custom...</option>
            </select>
          </div>
          {!['brand_test', 'concept_test', 'cultural_signal', 'fun_engagement', ''].includes(intentTag) && (
            <Input
              value={intentTag}
              onChange={(e) => setIntentTag(e.target.value)}
              placeholder="Enter custom intent tag..."
              className="bg-secondary mt-2 text-sm"
            />
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Users don't see this — buyers/admins do
          </p>
        </div>
        
        <Button
          onClick={() => createPollMutation.mutate()}
          disabled={!question || !optionA || !optionB || (campaignId && !entityName) || createPollMutation.isPending || isUploading}
          className="w-full bg-gradient-primary"
        >
          {(createPollMutation.isPending || isUploading) ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              {isUploading ? 'Uploading...' : 'Creating...'}
            </>
          ) : campaignId ? 'Create Poll & Add to Campaign' : 'Create Poll'}
        </Button>
      </div>
    </div>
  );
}
