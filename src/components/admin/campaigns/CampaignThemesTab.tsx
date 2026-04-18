import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, MessageSquareQuote } from 'lucide-react';
import { toast } from 'sonner';

interface Props { campaignId: string }

interface Theme {
  id: string;
  theme_label: string;
  theme_summary: string;
  supporting_quote_count: number;
  sample_quotes: any;
  generated_at: string;
}

export default function CampaignThemesTab({ campaignId }: Props) {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);

  const { data: themes = [], isLoading } = useQuery({
    queryKey: ['campaign-themes', campaignId],
    queryFn: async (): Promise<Theme[]> => {
      const { data, error } = await supabase
        .from('campaign_verbatim_themes')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('supporting_quote_count', { ascending: false });
      if (error) throw error;
      return (data || []) as any;
    },
  });

  const handleGenerate = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('cluster-verbatim-themes', {
        body: { campaign_id: campaignId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Generated ${(data as any)?.themes_count || 0} themes`);
      qc.invalidateQueries({ queryKey: ['campaign-themes', campaignId] });
    } catch (e: any) {
      toast.error(e?.message || 'Failed to cluster themes');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          AI clusters open-ended responses into qualitative themes.
        </p>
        <Button size="sm" onClick={handleGenerate} disabled={running} className="gap-1.5">
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {themes.length > 0 ? 'Re-cluster' : 'Cluster themes'}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : themes.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          <MessageSquareQuote className="w-8 h-8 mx-auto mb-2 opacity-50" />
          No themes generated yet. Need at least 3 verbatim responses.
        </div>
      ) : (
        <div className="space-y-3">
          {themes.map((t) => {
            const quotes = Array.isArray(t.sample_quotes) ? t.sample_quotes : [];
            return (
              <div key={t.id} className="rounded-xl border border-border p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-semibold text-sm">{t.theme_label}</h4>
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold shrink-0">
                    {t.supporting_quote_count} quotes
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{t.theme_summary}</p>
                {quotes.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-border/50">
                    {quotes.slice(0, 3).map((q: any, i: number) => (
                      <div key={i} className="text-[11px] italic text-foreground/80 pl-2 border-l-2 border-primary/30">
                        "{q.quote}" <span className="text-muted-foreground not-italic">— {q.demo || q.choice}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
