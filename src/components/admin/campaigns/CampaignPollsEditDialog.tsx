import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Pencil, ListOrdered, Loader2 } from 'lucide-react';
import PollEditDialog from '../PollEditDialog';

interface Props {
  campaignId: string;
  campaignName: string;
}

export default function CampaignPollsEditDialog({ campaignId, campaignName }: Props) {
  const [open, setOpen] = useState(false);
  const [editingPoll, setEditingPoll] = useState<any | null>(null);

  const { data: polls, isLoading, refetch } = useQuery({
    queryKey: ['campaign-polls-edit', campaignId],
    enabled: open,
    queryFn: async () => {
      const { data: links } = await supabase
        .from('campaign_polls')
        .select('poll_id')
        .eq('campaign_id', campaignId);
      const ids = (links || []).map((l: any) => l.poll_id);
      if (!ids.length) return [];
      const { data } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, image_a_url, image_b_url, category, intent_tag, starts_at, ends_at, is_active, target_gender, target_age_range, target_country, target_countries, expiry_type, batch_slot, is_hot_take')
        .in('id', ids)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="ghost" title="Edit polls in this campaign">
            <ListOrdered className="w-4 h-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit polls in “{campaignName}”</DialogTitle>
            <DialogDescription>
              {polls?.length || 0} poll{(polls?.length || 0) === 1 ? '' : 's'} linked to this campaign.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : !polls || polls.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No polls linked yet.</p>
          ) : (
            <div className="space-y-2">
              {polls.map((p: any) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/30"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.question}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {p.option_a} vs {p.option_b}
                      {p.is_active === false && ' · Paused'}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => setEditingPoll(p)}
                  >
                    <Pencil className="w-3 h-3" />
                    Edit
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <PollEditDialog
        poll={editingPoll}
        open={!!editingPoll}
        onOpenChange={(o) => {
          if (!o) {
            setEditingPoll(null);
            refetch();
          }
        }}
      />
    </>
  );
}
