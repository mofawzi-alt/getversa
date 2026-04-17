import { useNavigate } from 'react-router-dom';
import { useActiveBrandCampaign } from '@/hooks/useActiveBrandCampaign';
import { Sparkles, ArrowRight } from 'lucide-react';

export default function BrandPackBanner() {
  const navigate = useNavigate();
  const { data: campaign } = useActiveBrandCampaign();

  if (!campaign) return null;

  const brand = campaign.brand_name || campaign.name;

  return (
    <button
      onClick={() => navigate(`/campaign/${campaign.id}`)}
      className="w-full mb-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-primary to-[hsl(15,85%,55%)] text-primary-foreground shadow-md flex items-center gap-3 active:scale-[0.99] transition-transform"
    >
      {campaign.brand_logo_url ? (
        <img
          src={campaign.brand_logo_url}
          alt={brand}
          className="w-10 h-10 rounded-full object-cover bg-white/20 border-2 border-white/30 flex-shrink-0"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
      )}
      <div className="flex-1 text-left min-w-0">
        <div className="text-[11px] uppercase tracking-wider opacity-90 font-semibold">Brand Pack</div>
        <div className="text-sm font-bold truncate">
          {brand} wants your opinion
        </div>
        <div className="text-xs opacity-90">
          {campaign.unvoted_polls} quick question{campaign.unvoted_polls === 1 ? '' : 's'}
        </div>
      </div>
      <ArrowRight className="w-5 h-5 flex-shrink-0" />
    </button>
  );
}
