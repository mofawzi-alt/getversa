import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Camera, Sparkles } from 'lucide-react';

interface ActiveAsk {
  id: string;
  photo_url: string;
  question: string;
  vote_count: number;
}

export default function LiveAskEntry() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [asks, setAsks] = useState<ActiveAsk[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from('live_asks')
        .select('id,photo_url,question,vote_count,asker_id')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(8);
      if (!mounted) return;
      const filtered = (data ?? []).filter((a: any) => !user || a.asker_id !== user.id);
      setAsks(filtered as ActiveAsk[]);
    })();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  return (
    <div className="px-4 mt-4 mb-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-[#E8392A]" />
          <span className="text-[13px] font-bold tracking-tight text-foreground">Ask the Crowd</span>
          {asks.length > 0 && (
            <span className="ml-1 inline-flex items-center gap-1 text-[10px] font-semibold text-[#E8392A]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#E8392A] animate-pulse" />
              LIVE
            </span>
          )}
        </div>
        <button
          onClick={() => nav('/live-ask/new')}
          className="text-[11px] font-semibold text-muted-foreground"
        >
          Start one →
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 scrollbar-hide">
        {/* Always-on Create card */}
        <button
          onClick={() => nav('/live-ask/new')}
          className="flex-shrink-0 w-[110px] h-[140px] rounded-2xl border-2 border-dashed border-[#E8392A]/40 bg-[#E8392A]/5 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-transform"
        >
          <div className="h-9 w-9 rounded-full bg-[#E8392A] flex items-center justify-center">
            <Camera className="h-4 w-4 text-white" />
          </div>
          <span className="text-[11px] font-bold text-[#E8392A] leading-tight text-center px-2">
            Snap & ask
          </span>
        </button>

        {asks.map((a) => (
          <button
            key={a.id}
            onClick={() => nav(`/live-ask/${a.id}`)}
            className="flex-shrink-0 w-[110px] h-[140px] rounded-2xl overflow-hidden relative bg-muted active:scale-95 transition-transform"
          >
            <img
              src={a.photo_url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-1.5 left-1.5 right-1.5">
              <p className="text-[10px] font-semibold text-white leading-tight line-clamp-2">
                {a.question}
              </p>
              <p className="text-[9px] text-white/80 mt-0.5">{a.vote_count} votes</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
