import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useActiveBrandCampaigns } from '@/hooks/useActiveBrandCampaign';
import { Sparkles, ArrowRight } from 'lucide-react';

const AUTO_ROTATE_MS = 5000;
const SWIPE_THRESHOLD = 40;

export default function BrandPackBanner() {
  const navigate = useNavigate();
  const { data: campaigns } = useActiveBrandCampaigns();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const swiped = useRef(false);

  const count = campaigns?.length ?? 0;

  // Auto-rotate
  useEffect(() => {
    if (count <= 1 || paused) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, AUTO_ROTATE_MS);
    return () => clearInterval(t);
  }, [count, paused]);

  // Reset index if campaigns change
  useEffect(() => {
    if (index >= count && count > 0) setIndex(0);
  }, [count, index]);

  if (!campaigns || campaigns.length === 0) return null;

  const campaign = campaigns[Math.min(index, campaigns.length - 1)];
  const brand = campaign.brand_name || campaign.name;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    swiped.current = false;
    setPaused(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > SWIPE_THRESHOLD && !swiped.current) {
      swiped.current = true;
      if (dx < 0) {
        setIndex((i) => (i + 1) % count);
      } else {
        setIndex((i) => (i - 1 + count) % count);
      }
    }
  };

  const handleTouchEnd = () => {
    touchStartX.current = null;
    // Resume auto-rotate after a short delay
    setTimeout(() => setPaused(false), 2000);
  };

  const handleClick = () => {
    if (swiped.current) return;
    navigate(`/campaign/${campaign.id}`);
  };

  return (
    <div className="mb-3">
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="overflow-hidden rounded-2xl"
      >
        <button
          key={campaign.id}
          onClick={handleClick}
          className="w-full px-4 py-3 rounded-2xl bg-gradient-to-r from-primary to-[hsl(15,85%,55%)] text-primary-foreground shadow-md flex items-center gap-3 active:scale-[0.99] transition-all duration-300 animate-fade-in"
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
            <div className="text-sm font-bold truncate">{brand}</div>
            <div className="text-xs opacity-90">
              {campaign.unvoted_polls} quick question{campaign.unvoted_polls === 1 ? '' : 's'}
            </div>
          </div>
          <ArrowRight className="w-5 h-5 flex-shrink-0" />
        </button>
      </div>

      {count > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {campaigns.map((c, i) => (
            <button
              key={c.id}
              onClick={() => {
                setIndex(i);
                setPaused(true);
                setTimeout(() => setPaused(false), 4000);
              }}
              aria-label={`Show campaign ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-5 bg-primary' : 'w-1.5 bg-muted-foreground/30'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
