import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, Upload, X, Calendar } from 'lucide-react';
import { toast } from 'sonner';

interface Poll {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  image_a_url: string | null;
  image_b_url: string | null;
  category: string | null;
  intent_tag: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean | null;
  target_gender: string | null;
  target_age_range: string | null;
  target_country: string | null;
  target_countries: string[] | null;
}

interface PollEditDialogProps {
  poll: Poll | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PollEditDialog({ poll, open, onOpenChange }: PollEditDialogProps) {
  const queryClient = useQueryClient();
  const [question, setQuestion] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [imageAUrl, setImageAUrl] = useState('');
  const [imageBUrl, setImageBUrl] = useState('');
  const [category, setCategory] = useState('');
  const [intentTag, setIntentTag] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [imageAPreview, setImageAPreview] = useState('');
  const [imageBPreview, setImageBPreview] = useState('');
  const [imageAFile, setImageAFile] = useState<File | null>(null);
  const [imageBFile, setImageBFile] = useState<File | null>(null);
  const imageAInputRef = useRef<HTMLInputElement>(null);
  const imageBInputRef = useRef<HTMLInputElement>(null);
  const [targetCountries, setTargetCountries] = useState<string[]>([]);
  const [targetGender, setTargetGender] = useState('');
  const [targetAgeRange, setTargetAgeRange] = useState('');

  // Sync state when poll changes
  const [lastPollId, setLastPollId] = useState<string | null>(null);
  if (poll && poll.id !== lastPollId) {
    setLastPollId(poll.id);
    setQuestion(poll.question);
    setOptionA(poll.option_a);
    setOptionB(poll.option_b);
    setImageAUrl(poll.image_a_url || '');
    setImageBUrl(poll.image_b_url || '');
    setCategory(poll.category || '');
    setIntentTag(poll.intent_tag || '');
    setStartsAt(poll.starts_at ? new Date(poll.starts_at).toISOString().slice(0, 16) : '');
    setEndsAt(poll.ends_at ? new Date(poll.ends_at).toISOString().slice(0, 16) : '');
    setImageAPreview('');
    setImageBPreview('');
    setImageAFile(null);
    setImageBFile(null);
    setTargetCountries(poll.target_countries || []);
    setTargetGender(poll.target_gender || '');
    setTargetAgeRange(poll.target_age_range || '');
  }

  const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'ogg'];
  const isVideoFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    return VIDEO_EXTENSIONS.includes(ext) || file.type.startsWith('video/');
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime', 'video/ogg'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Allowed: JPEG, PNG, GIF, WebP, MP4, WebM, MOV, OGG');
      return null;
    }
    const isVideo = isVideoFile(file);
    const maxSize = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`Max ${isVideo ? '50MB' : '5MB'}`);
      return null;
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `polls/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('poll-images').upload(path, file, { contentType: file.type });
    if (error) { console.error(error); return null; }
    return supabase.storage.from('poll-images').getPublicUrl(path).data.publicUrl;
  };

  const handleImageSelect = (file: File, option: 'A' | 'B') => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (option === 'A') {
        setImageAFile(file);
        setImageAPreview(e.target?.result as string);
      } else {
        setImageBFile(file);
        setImageBPreview(e.target?.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!poll) return;
      setIsUploading(true);

      let finalImageA = imageAUrl;
      let finalImageB = imageBUrl;
      if (imageAFile) {
        const url = await uploadImage(imageAFile);
        if (url) finalImageA = url;
      }
      if (imageBFile) {
        const url = await uploadImage(imageBFile);
        if (url) finalImageB = url;
      }

      const { error } = await supabase
        .from('polls')
        .update({
          question,
          option_a: optionA,
          option_b: optionB,
          image_a_url: finalImageA || null,
          image_b_url: finalImageB || null,
          category: category || null,
          intent_tag: intentTag || null,
          starts_at: startsAt ? new Date(startsAt).toISOString() : null,
          ends_at: endsAt ? new Date(endsAt).toISOString() : null,
          target_countries: targetCountries.length > 0 ? targetCountries : [],
          target_gender: targetGender || null,
          target_age_range: targetAgeRange || null,
        })
        .eq('id', poll.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-polls'] });
      toast.success('Poll updated!');
      onOpenChange(false);
      setIsUploading(false);
    },
    onError: () => {
      toast.error('Failed to update poll');
      setIsUploading(false);
    },
  });

  if (!poll) return null;

  const currentImageA = imageAPreview || imageAUrl;
  const currentImageB = imageBPreview || imageBUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Poll</DialogTitle>
          <DialogDescription>Update poll details, images, and schedule.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Question</Label>
            <Input value={question} onChange={(e) => setQuestion(e.target.value)} className="bg-secondary" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Option A</Label>
              <Input value={optionA} onChange={(e) => setOptionA(e.target.value)} className="bg-secondary" />
            </div>
            <div>
              <Label>Option B</Label>
              <Input value={optionB} onChange={(e) => setOptionB(e.target.value)} className="bg-secondary" />
            </div>
          </div>

          {/* Images */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Image A</Label>
              <input type="file" accept="image/*,video/*,.mp4,.webm,.mov,.ogg" ref={imageAInputRef} onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0], 'A')} className="hidden" />
              {currentImageA ? (
                <div className="relative mt-2">
                  <img src={currentImageA} alt="A" className="w-full h-24 object-cover rounded-lg" />
                  <button onClick={() => { setImageAFile(null); setImageAPreview(''); setImageAUrl(''); }} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <Button type="button" variant="outline" className="w-full mt-2" onClick={() => imageAInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" /> Upload
                </Button>
              )}
              {!currentImageA && (
                <Input value={imageAUrl} onChange={(e) => setImageAUrl(e.target.value)} placeholder="Or paste URL..." className="bg-secondary mt-2 text-xs" />
              )}
            </div>
            <div>
              <Label>Image B</Label>
              <input type="file" accept="image/*,video/*,.mp4,.webm,.mov,.ogg" ref={imageBInputRef} onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0], 'B')} className="hidden" />
              {currentImageB ? (
                <div className="relative mt-2">
                  <img src={currentImageB} alt="B" className="w-full h-24 object-cover rounded-lg" />
                  <button onClick={() => { setImageBFile(null); setImageBPreview(''); setImageBUrl(''); }} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <Button type="button" variant="outline" className="w-full mt-2" onClick={() => imageBInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" /> Upload
                </Button>
              )}
              {!currentImageB && (
                <Input value={imageBUrl} onChange={(e) => setImageBUrl(e.target.value)} placeholder="Or paste URL..." className="bg-secondary mt-2 text-xs" />
              )}
          </div>
          </div>

          {/* Category & Intent */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} className="bg-secondary" />
            </div>
            <div>
              <Label>Intent Tag</Label>
              <Input value={intentTag} onChange={(e) => setIntentTag(e.target.value)} className="bg-secondary" />
            </div>
          </div>

          {/* Schedule */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Starts</Label>
              <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="bg-secondary text-xs" />
            </div>
            <div>
              <Label className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Ends</Label>
              <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="bg-secondary text-xs" />
            </div>
          </div>

          {/* Demographics */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Target Gender <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {['Male', 'Female'].map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setTargetGender(prev => prev === g ? '' : g)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      targetGender === g
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-secondary text-muted-foreground border-border'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Target Age <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {['18-24', '25-34', '35-44', '45+'].map(a => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setTargetAgeRange(prev => prev === a ? '' : a)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      targetAgeRange === a
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-secondary text-muted-foreground border-border'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Target Countries */}
          <div>
            <Label>Target Countries <span className="text-muted-foreground text-xs">(none = all)</span></Label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {['Egypt', 'Saudi Arabia', 'United Arab Emirates', 'Qatar', 'Kuwait', 'Bahrain', 'Oman', 'Jordan', 'Lebanon', 'Iraq', 'Palestine'].map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setTargetCountries(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                    targetCountries.includes(c)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary text-muted-foreground border-border'
                  }`}
                >
                  {c === 'United Arab Emirates' ? 'UAE' : c}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={() => updateMutation.mutate()}
            disabled={!question || !optionA || !optionB || updateMutation.isPending || isUploading}
            className="w-full bg-gradient-primary"
          >
            {(updateMutation.isPending || isUploading) ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />{isUploading ? 'Uploading...' : 'Saving...'}</>
            ) : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
