import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BarChart3 } from 'lucide-react';
import CampaignDetailView from './campaigns/CampaignDetailView';

interface Props {
  campaignId: string;
  campaignName: string;
  brandName?: string | null;
}

export default function CampaignAnalyticsDialog({ campaignId, campaignName, brandName }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <BarChart3 className="w-4 h-4" />
          <span className="hidden sm:inline">Analytics</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-left">
            {campaignName}
            {brandName && (
              <div className="text-xs font-normal text-muted-foreground mt-1">{brandName}</div>
            )}
          </DialogTitle>
        </DialogHeader>

        {open && (
          <CampaignDetailView
            campaignId={campaignId}
            campaignName={campaignName}
            brandName={brandName}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
