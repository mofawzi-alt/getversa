import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Camera, X } from 'lucide-react';

interface ActiveAsk {
  id: string;
  photo_url: string;
  question: string;
  vote_count: number;
  asker_id: string;
  reveal_at: string;
}

export default function LiveAskStrip() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [asks, setAsks] = useState<ActiveAsk[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from('live_asks')
        .select('id,photo_url,question,vote_count,asker_id,reveal_at')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(20);
      if (!mounted) return;
      const filtered = (data ?? []).filter((a: any) => !user || a.asker_id !== user.id);
      setAsks(filtered as ActiveAsk[]);
    };
    load();
    const ch = supabase
      .channel('live-asks-strip')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_asks' }, load)
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [user?.id]);

  if (asks.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mx-4 mt-3 mb-1 w-[calc(100%-2rem)] flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#E8392A]/10 border border-[#E8392A]/30 active:scale-[0.98] transition-transform"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E8392A] opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E8392A]" />
        </span>
        <span className="text-[13px] font-bold text-[#E8392A]">
          {asks.length} live ask{asks.length === 1 ? '' : 's'}
        </span>
        <span className="text-[12px] text-foreground/70 truncate flex-1 text-left">
          · {asks[0].question}
        </span>
        <span className="text-[11px] font-semibold text-[#E8392A]">Vote →</span>
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-end" onClick={() => setOpen(false)}>
          <div
            className="w-full bg-background rounded-t-3xl max-h-[85vh] overflow-hidden flex flex-col"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E8392A] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E8392A]" />
                </span>
                <h2 className="text-base font-bold">Live Asks</h2>
              </div>
              <button onClick={() => setOpen(false)} className="p-1 -mr-1">
                <X className="h-5 w-5 text-foreground/60" />
              </button>
            </div>

            <button
              onClick={() => { setOpen(false); nav('/live-ask/new'); }}
              className="mx-4 mb-3 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#E8392A] text-white font-semibold text-sm"
            >
              <Camera className="h-4 w-4" />
              Snap & ask the crowd
            </button>

            <div className="overflow-y-auto px-4 pb-4 space-y-2">
              {asks.map((a) => (
                <button
                  key={a.id}
                  onClick={() => { setOpen(false); nav(`/live-ask/${a.id}`); }}
                  className="w-full flex items-center gap-3 p-2 rounded-xl border border-border/50 active:scale-[0.99] transition-transform"
                >
                  <img
                    src={a.photo_url}
                    alt=""
                    className="h-16 w-16 rounded-lg object-cover bg-muted flex-shrink-0"
                    loading="lazy"
                  />
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-semibold leading-tight line-clamp-2">{a.question}</p>
                    <p className="text-[11px] text-foreground/60 mt-1">{a.vote_count} votes</p>
                  </div>
                  <span className="text-xs font-bold text-[#E8392A] flex-shrink-0">Vote →</span>
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
