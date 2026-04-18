import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Search, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getPollDisplayImageSrc, handlePollImageError } from '@/lib/pollImages';
import { mapToVersaCategory } from '@/lib/categoryMeta';
import CategoryBadge from '@/components/category/CategoryBadge';
import { toast } from 'sonner';

interface MatchedPoll {
  id: string;
  question: string;
  subtitle: string | null;
  option_a: string;
  option_b: string;
  image_a_url: string | null;
  image_b_url: string | null;
  category: string | null;
}

const SUGGESTIONS = [
  'Most controversial Ramadan series debates',
  'Brands Gen Z loves but millennials hate',
  'Polls where women disagreed with men on food',
  'Cairo vs Alexandria lifestyle splits',
  'Football debates about Ahly and Zamalek',
  'Closest 50/50 splits on lifestyle',
];

export default function Ask() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [polls, setPolls] = useState<MatchedPoll[]>([]);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 200);
  }, []);

  const runSearch = async (q?: string) => {
    const question = (q ?? query).trim();
    if (question.length < 3) {
      toast.error('Type a fuller question');
      return;
    }
    setQuery(question);
    setLoading(true);
    setSummary(null);
    setPolls([]);
    setSearched(true);
    try {
      const { data, error } = await supabase.functions.invoke('ask-versa', {
        body: { question },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        setSummary(null);
        return;
      }
      setSummary(data.summary || null);
      setPolls(data.polls || []);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-2 px-3 py-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-full hover:bg-muted active:scale-95 transition"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" />
            <h1 className="text-base font-bold">Ask Versa</h1>
          </div>
        </div>

        {/* Input */}
        <form
          onSubmit={(e) => { e.preventDefault(); runSearch(); }}
          className="px-3 pb-3"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask anything about polls…"
              className="w-full h-11 pl-9 pr-20 rounded-full border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="submit"
              disabled={loading || query.trim().length < 3}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 px-3 rounded-full bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50 active:scale-95 transition flex items-center gap-1"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Ask'}
            </button>
          </div>
        </form>
      </div>

      {/* Body */}
      <div className="px-3 pt-4 space-y-4">
        {!searched && (
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold px-1">
              Try asking
            </p>
            <div className="space-y-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => runSearch(s)}
                  className="w-full text-left p-3 rounded-2xl bg-card border border-border hover:bg-muted/40 active:scale-[0.99] transition text-sm flex items-center justify-between gap-2"
                >
                  <span className="text-foreground">{s}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Reading the pulse…</p>
          </div>
        )}

        {!loading && summary && (
          <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-4">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-sm leading-relaxed text-foreground">{summary}</p>
            </div>
          </div>
        )}

        {!loading && polls.length > 0 && (
          <>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold px-1">
              {polls.length} matching {polls.length === 1 ? 'poll' : 'polls'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {polls.map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/poll/${p.id}`)}
                  className="text-left rounded-2xl overflow-hidden bg-card border border-border active:scale-[0.98] transition"
                >
                  <div className="grid grid-cols-2 aspect-[4/5]">
                    <img
                      src={getPollDisplayImageSrc({ imageUrl: p.image_a_url, question: p.question, option: p.option_a, side: 'A' })}
                      onError={(e) => handlePollImageError(e, { question: p.question, option: p.option_a, side: 'A' })}
                      alt={p.option_a}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <img
                      src={getPollDisplayImageSrc({ imageUrl: p.image_b_url, question: p.question, option: p.option_b, side: 'B' })}
                      onError={(e) => handlePollImageError(e, { question: p.question, option: p.option_b, side: 'B' })}
                      alt={p.option_b}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-2.5 space-y-1.5">
                    {p.category && (
                      <CategoryBadge category={mapToVersaCategory(p.category)} size="xs" />
                    )}
                    <p className="text-xs font-semibold leading-snug line-clamp-2">{p.question}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {!loading && searched && polls.length === 0 && summary && (
          <div className="text-center py-8">
            <button
              onClick={() => { setQuery(''); setSearched(false); setSummary(null); inputRef.current?.focus(); }}
              className="text-xs text-primary font-semibold underline"
            >
              Try another question
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
