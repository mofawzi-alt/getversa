import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Loader2, Scale, FlaskConical, ArrowUp, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import SuggestionChips from '@/components/ask/SuggestionChips';
import AskThread, { type AskTurn, type Mode } from '@/components/ask/AskThread';

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

function buildHistoryFromTurns(turns: AskTurn[]) {
  // Convert prior turns into role/content pairs the model can use as context
  const out: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const t of turns) {
    if (t.loading) continue;
    out.push({ role: 'user', content: t.question });
    let assistant = t.summary || '';
    if (t.verdict) {
      assistant = `Verdict: pick ${t.verdict.winner_label} (${t.verdict.winner_pct}% of ${t.verdict.total_votes} votes). Question: ${t.verdict.question}. ${t.verdict.reason || ''}`.trim();
    }
    if (assistant) out.push({ role: 'assistant', content: assistant });
  }
  return out;
}

export default function Ask() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [mode, setMode] = useState<Mode>('decide');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [turns, setTurns] = useState<AskTurn[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 200);
  }, []);

  // Auto-scroll on new turn
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns]);

  const reset = () => {
    setQuery('');
    setTurns([]);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const switchMode = (m: Mode) => {
    if (m === mode) return;
    setMode(m);
    reset();
  };

  const runSearch = async (q?: string) => {
    const question = (q ?? query).trim();
    if (question.length < 3) {
      toast.error('Type a fuller question');
      return;
    }
    if (loading) return;

    setQuery('');
    setLoading(true);

    const turnId = crypto.randomUUID();
    const placeholder: AskTurn = { id: turnId, question, mode, loading: true };
    const historyForRequest = buildHistoryFromTurns(turns);
    setTurns((prev) => [...prev, placeholder]);

    try {
      const viewer = profile ? {
        age_range: profile.age_range || undefined,
        city: profile.city || undefined,
        gender: profile.gender || undefined,
      } : undefined;
      const { data, error } = await supabase.functions.invoke('ask-versa', {
        body: { question, mode, viewer, history: historyForRequest },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        setTurns((prev) => prev.filter((t) => t.id !== turnId));
        return;
      }
      setTurns((prev) => prev.map((t) => t.id === turnId ? {
        ...t,
        loading: false,
        summary: data.summary || null,
        verdict: data.verdict || null,
        polls: data.polls || [],
        lowData: !!data.low_data,
        suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
      } : t));
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Search failed');
      setTurns((prev) => prev.filter((t) => t.id !== turnId));
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const placeholder = mode === 'decide'
    ? (turns.length > 0 ? 'Ask a follow-up…' : 'e.g. Costa or Cilantro?')
    : (turns.length > 0 ? 'Ask a follow-up…' : 'e.g. What do students think about online learning?');

  const promptSuggestions = mode === 'decide' ? DECIDE_SUGGESTIONS : RESEARCH_SUGGESTIONS;
  const empty = turns.length === 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between gap-2 px-3 py-3">
          <div className="flex items-center gap-2">
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
          {turns.length > 0 && (
            <button
              onClick={reset}
              className="flex items-center gap-1 h-8 px-3 rounded-full bg-muted text-xs font-semibold text-foreground active:scale-95 transition"
            >
              <RotateCcw className="h-3 w-3" />
              New
            </button>
          )}
        </div>

        {/* Mode tabs */}
        <div className="px-3 pb-3">
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
      </div>

      {/* Body */}
      <div className="flex-1 px-3 pt-4 pb-32 space-y-4">
        {empty && (
          <>
            <div className="text-center pt-4 pb-2">
              <div className="inline-flex h-12 w-12 rounded-full bg-primary/10 items-center justify-center mb-3">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                {mode === 'decide' ? 'Get a clear pick backed by real votes' : 'Get a research brief from Egypt\'s pulse'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {mode === 'decide' ? 'Ask follow-ups to dig deeper.' : 'Copy or download as PDF.'}
              </p>
            </div>
            <SuggestionChips
              label={mode === 'decide' ? 'Stuck on a choice?' : 'Try a research question'}
              suggestions={promptSuggestions}
              onPick={runSearch}
            />
          </>
        )}

        {!empty && (
          <AskThread turns={turns} onPickSuggestion={runSearch} />
        )}

        <div ref={threadEndRef} />
      </div>

      {/* Pinned input */}
      <form
        onSubmit={(e) => { e.preventDefault(); runSearch(); }}
        className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border px-3 py-3 safe-area-bottom z-30"
      >
        <div className="relative max-w-lg mx-auto">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            disabled={loading}
            className="w-full h-12 pl-4 pr-14 rounded-full border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || query.trim().length < 3}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-primary text-primary-foreground disabled:opacity-40 active:scale-95 transition flex items-center justify-center"
            aria-label="Send"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}
