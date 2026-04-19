import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Search, Loader2, Scale, FlaskConical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import VerdictCard, { type Verdict } from '@/components/ask/VerdictCard';
import ResearchBrief from '@/components/ask/ResearchBrief';
import SuggestionChips from '@/components/ask/SuggestionChips';
import type { ResearchPoll } from '@/lib/askExport';

type Mode = 'decide' | 'research';

const DECIDE_SUGGESTIONS = [
  'Costa or Cilantro for studying?',
  'iPhone or Samsung — which lasts longer?',
  'Should I order Talabat or Elmenus tonight?',
  'Vodafone or Orange for university?',
];

const RESEARCH_SUGGESTIONS = [
  'How do students feel about online learning?',
  'What do people think about marriage age in Egypt?',
  'Cairo vs Alexandria lifestyle differences',
  'Which fast food brand wins with 18–24?',
  'How divided are Egyptians on Ahly vs Zamalek?',
];

export default function Ask() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [mode, setMode] = useState<Mode>('decide');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [polls, setPolls] = useState<ResearchPoll[]>([]);
  const [lowData, setLowData] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 200);
  }, []);

  const reset = () => {
    setQuery('');
    setSearched(false);
    setSummary(null);
    setVerdict(null);
    setPolls([]);
    setLowData(false);
    setSuggestions([]);
  };

  const switchMode = (m: Mode) => {
    if (m === mode) return;
    setMode(m);
    reset();
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const runSearch = async (q?: string) => {
    const question = (q ?? query).trim();
    if (question.length < 3) {
      toast.error('Type a fuller question');
      return;
    }
    setQuery(question);
    setLoading(true);
    setSummary(null);
    setVerdict(null);
    setPolls([]);
    setLowData(false);
    setSuggestions([]);
    setSearched(true);
    try {
      const viewer = profile ? {
        age_range: profile.age_range || undefined,
        city: profile.city || undefined,
        gender: profile.gender || undefined,
      } : undefined;
      const { data, error } = await supabase.functions.invoke('ask-versa', {
        body: { question, mode, viewer },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setSummary(data.summary || null);
      setVerdict(data.verdict || null);
      setPolls(data.polls || []);
      setLowData(!!data.low_data);
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const placeholder = mode === 'decide'
    ? 'e.g. Costa or Cilantro?'
    : 'e.g. What do students think about online learning?';

  const promptSuggestions = mode === 'decide' ? DECIDE_SUGGESTIONS : RESEARCH_SUGGESTIONS;

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

        {/* Mode tabs */}
        <div className="px-3 pb-2">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-full bg-muted">
            <button
              onClick={() => switchMode('decide')}
              className={`h-8 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                mode === 'decide' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              <Scale className="h-3.5 w-3.5" />
              Decide
            </button>
            <button
              onClick={() => switchMode('research')}
              className={`h-8 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                mode === 'research' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              <FlaskConical className="h-3.5 w-3.5" />
              Research
            </button>
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
              placeholder={placeholder}
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
          <p className="text-[10px] text-muted-foreground mt-2 px-2">
            {mode === 'decide'
              ? 'Get a clear pick backed by real Egyptian votes.'
              : 'Get a research brief — copy or download as PDF.'}
          </p>
        </form>
      </div>

      {/* Body */}
      <div className="px-3 pt-4 space-y-4">
        {!searched && (
          <SuggestionChips
            label={mode === 'decide' ? 'Stuck on a choice?' : 'Try a research question'}
            suggestions={promptSuggestions}
            onPick={runSearch}
          />
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">
              {mode === 'decide' ? 'Reading the pulse…' : 'Building your brief…'}
            </p>
          </div>
        )}

        {/* Low-data guardrail state */}
        {!loading && lowData && summary && (
          <div className="space-y-3">
            <div className="rounded-2xl bg-muted/40 border border-border p-4 space-y-2">
              <p className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Not enough data yet</p>
              <p className="text-sm text-foreground leading-relaxed">{summary}</p>
            </div>
            {suggestions.length > 0 && (
              <SuggestionChips
                label="Try one of these instead"
                suggestions={suggestions}
                onPick={runSearch}
              />
            )}
          </div>
        )}

        {!loading && !lowData && mode === 'decide' && verdict && (
          <VerdictCard verdict={verdict} />
        )}

        {!loading && !lowData && mode === 'decide' && !verdict && summary && (
          <div className="rounded-2xl bg-card border border-border p-4">
            <p className="text-sm text-foreground">{summary}</p>
          </div>
        )}

        {!loading && !lowData && mode === 'research' && summary && polls.length > 0 && (
          <ResearchBrief question={query} summary={summary} polls={polls} />
        )}

        {!loading && !lowData && mode === 'research' && summary && polls.length === 0 && (
          <div className="rounded-2xl bg-card border border-border p-4">
            <p className="text-sm text-foreground">{summary}</p>
          </div>
        )}

        {!loading && searched && (
          <div className="text-center pt-2 pb-6">
            <button
              onClick={reset}
              className="text-xs text-primary font-semibold underline"
            >
              Ask another question
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
