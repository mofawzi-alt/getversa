import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, Upload, X, Check, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';

interface Suggestion {
  id: string;
  user_id: string;
  question: string;
  option_a: string | null;
  option_b: string | null;
  category: string | null;
}

interface Props {
  suggestion: Suggestion | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export default function CreatePollFromSuggestionDialog({ suggestion, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [question, setQuestion] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [category, setCategory] = useState('');
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [previewA, setPreviewA] = useState<string>('');
  const [previewB, setPreviewB] = useState<string>('');
  const inputA = useRef<HTMLInputElement>(null);
  const inputB = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (suggestion && open) {
      setQuestion(suggestion.question || '');
      setOptionA(suggestion.option_a || '');
      setOptionB(suggestion.option_b || '');
      setCategory(suggestion.category || '');
      setFileA(null); setFileB(null);
      setPreviewA(''); setPreviewB('');
    }
  }, [suggestion, open]);

  const pick = (file: File, side: 'A' | 'B') => {
    if (!ALLOWED.includes(file.type)) { toast.error('JPEG / PNG / GIF / WebP only'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Max 5MB'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (side === 'A') { setFileA(file); setPreviewA(e.target?.result as string); }
      else { setFileB(file); setPreviewB(e.target?.result as string); }
    };
    reader.readAsDataURL(file);
  };

  const upload = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `polls/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('poll-images').upload(path, file, { contentType: file.type });
    if (error) throw error;
    return supabase.storage.from('poll-images').getPublicUrl(path).data.publicUrl;
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!suggestion || !user) throw new Error('Missing context');
      if (!question.trim() || !optionA.trim() || !optionB.trim()) {
        throw new Error('Question and both options are required');
      }
      if (!fileA || !fileB) throw new Error('Upload both images');

      const [imgA, imgB] = await Promise.all([upload(fileA), upload(fileB)]);

      // 1. Create the poll
      const { data: poll, error: pErr } = await supabase
        .from('polls')
        .insert({
          question: question.trim(),
          option_a: optionA.trim(),
          option_b: optionB.trim(),
          image_a_url: imgA,
          image_b_url: imgB,
          category: category.trim() || null,
          is_active: true,
          expiry_type: 'trending',
          ends_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
          created_by: user.id,
        } as any)
        .select('id')
        .single();
      if (pErr) throw pErr;

      // 2. Approve + link the suggestion (trigger awards +5 credits + notifies user)
      const { error: sErr } = await supabase
        .from('poll_suggestions')
        .update({ status: 'approved' as any, published_poll_id: poll.id } as any)
        .eq('id', suggestion.id);
      if (sErr) throw sErr;

      return poll.id;
    },
    onSuccess: () => {
      toast.success('Poll published! Suggester earned +5 credits.');
      qc.invalidateQueries({ queryKey: ['admin-poll-suggestions'] });
      qc.invalidateQueries({ queryKey: ['admin-pending-suggestions-count'] });
      qc.invalidateQueries({ queryKey: ['admin-polls'] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to publish'),
  });

  if (!suggestion) return null;

  const ImageSlot = ({
    side, preview, inputRef,
  }: { side: 'A' | 'B'; preview: string; inputRef: React.RefObject<HTMLInputElement> }) => (
    <div className="space-y-1.5">
      <Label className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">
        Image {side}
      </Label>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f, side); }}
      />
      {preview ? (
        <div className="relative aspect-[4/5] rounded-xl overflow-hidden border border-border">
          <img src={preview} alt={`Option ${side}`} className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => { side === 'A' ? (setFileA(null), setPreviewA('')) : (setFileB(null), setPreviewB('')); }}
            className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-background/90 backdrop-blur flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="aspect-[4/5] w-full rounded-xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition flex flex-col items-center justify-center gap-1.5 text-muted-foreground"
        >
          <ImagePlus className="h-6 w-6" />
          <span className="text-[11px] font-bold">Upload {side}</span>
          <span className="text-[10px]">Max 5MB</span>
        </button>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create poll from suggestion</DialogTitle>
          <DialogDescription>
            Pre-filled from the user's suggestion. Add images and publish — the suggester will be auto-rewarded with +5 credits and a notification.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Question</Label>
            <Input value={question} onChange={(e) => setQuestion(e.target.value)} className="bg-secondary" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Option A</Label>
              <Input value={optionA} onChange={(e) => setOptionA(e.target.value)} className="bg-secondary" />
            </div>
            <div className="space-y-1.5">
              <Label>Option B</Label>
              <Input value={optionB} onChange={(e) => setOptionB(e.target.value)} className="bg-secondary" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Category (optional)</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Food, Telecom, Lifestyle" className="bg-secondary" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <ImageSlot side="A" preview={previewA} inputRef={inputA} />
            <ImageSlot side="B" preview={previewB} inputRef={inputB} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={submit.isPending}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={() => submit.mutate()}
              disabled={submit.isPending || !fileA || !fileB || !question.trim() || !optionA.trim() || !optionB.trim()}
            >
              {submit.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Publishing…</>
              ) : (
                <><Check className="h-4 w-4 mr-2" /> Publish & reward</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
