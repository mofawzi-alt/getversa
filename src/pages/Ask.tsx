import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Loader2, Scale, FlaskConical, ArrowUp, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import SuggestionChips from '@/components/ask/SuggestionChips';
import AskThread, { type AskTurn, type Mode } from '@/components/ask/AskThread';
import CreditBalance from '@/components/ask/CreditBalance';
import UnlockModal from '@/components/ask/UnlockModal';

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

interface PreviewState {
  question: string;
  mode: Mode;
  route: 'simple' | 'medium' | 'complex';
  cost: number;
  balance: number;
  teaser: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
}

interface AskLocationState {
  fromLiveDebate?: boolean;
  fallbackTo?: string;
}

export default function Ask() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>('decide');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [turns, setTurns] = useState<AskTurn[]>([]);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [viewportHeight, setViewportHeight] = useState<number>(
    typeof window !== 'undefined' ? window.innerHeight : 0
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const focusInputIfDesktop = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches) {
      inputRef.current?.focus();
    }
  };

  useEffect(() => { setTimeout(focusInputIfDesktop, 200); }, []);
  useEffect(() => { threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [turns]);

  // Track visual viewport so layout shrinks correctly when mobile keyboard opens
  useEffect(() => {
    const vv = (typeof window !== 'undefined' ? window.visualViewport : null);
    const update = () => {
      const h = vv?.height ?? window.innerHeight;
      setViewportHeight(h);
    };
    update();
    if (vv) {
      vv.addEventListener('resize', update);
      vv.addEventListener('scroll', update);
      return () => {
        vv.removeEventListener('resize', update);
        vv.removeEventListener('scroll', update);
      };
    }
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const handleBack = () => {
    const state = location.state as AskLocationState | null;
    if (state?.fromLiveDebate) {
      navigate(state.fallbackTo || '/home', { replace: true });
      return;
    }
    if (window.history.state?.idx > 0) {
      navigate(-1);
      return;
    }
    navigate('/home', { replace: true });
  };

  const reset = () => {
    setQuery('');
    setTurns([]);
    setPreview(null);
    setTimeout(focusInputIfDesktop, 100);
  };

  const switchMode = (m: Mode) => {
    if (m === mode) return;
    setMode(m);
    reset();
  };

  const viewer = profile ? {
    age_range: profile.age_range || undefined,
    city: profile.city || undefined,
    gender: profile.gender || undefined,
  } : undefined;

  const runPreview = async (q?: string) => {
    const question = (q ?? query).trim();
    if (question.length < 3) { toast.error('Type a fuller question'); return; }
    if (loading) return;

    setQuery('');
    setLoading(true);
    const history = buildHistoryFromTurns(turns);

    try {
      const { data, error } = await supabase.functions.invoke('ask-versa', {
        body: { question, mode, viewer, history, stage: 'preview' },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }

      // Off-scope: polite refusal, no charge, no preview.
      if (data.stage === 'offscope') {
        const turnId = crypto.randomUUID();
        setTurns((prev) => [...prev, {
          id: turnId, question, mode,
          loading: false,
          summary: data.summary,
          variant: 'offscope',
        } as AskTurn]);
        return;
      }

      // Factual: general-knowledge answer, clearly labeled, no charge.
      if (data.stage === 'factual') {
        const turnId = crypto.randomUUID();
        setTurns((prev) => [...prev, {
          id: turnId, question, mode,
          loading: false,
          summary: data.summary,
          notice: data.notice,
          variant: 'factual',
        } as AskTurn]);
        return;
      }

      // Guardrail: render directly as a turn, no charge
      if (data.stage === 'guardrail') {
        const turnId = crypto.randomUUID();
        setTurns((prev) => [...prev, {
          id: turnId, question, mode,
          loading: false,
          summary: data.summary,
          lowData: true,
          guardrailPolls: data.suggested_polls || [],
          askQueryId: data.query_id || null,
        } as AskTurn]);
        return;
      }

      // Preview: show modal
      if (data.stage === 'preview') {
        setPreview({
          question, mode,
          route: data.route,
          cost: data.cost,
          balance: data.credits_balance,
          teaser: data.teaser,
          history,
        });
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Search failed');
    } finally {
      setLoading(false);
      setTimeout(focusInputIfDesktop, 50);
    }
  };

  const confirmAndAnswer = async () => {
    if (!preview) return;
    setConfirming(true);
    const turnId = crypto.randomUUID();
    const placeholder: AskTurn = { id: turnId, question: preview.question, mode: preview.mode, loading: true };
    setTurns((prev) => [...prev, placeholder]);
    setPreview(null);

    try {
      const { data, error } = await supabase.functions.invoke('ask-versa', {
        body: { question: preview.question, mode: preview.mode, viewer, history: preview.history, stage: 'confirm' },
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
        creditsCharged: data.credits_charged,
        creditsBalance: data.credits_balance,
      } as AskTurn : t));
      // Refresh balance pill
      qc.invalidateQueries({ queryKey: ['ask-credits'] });
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed');
      setTurns((prev) => prev.filter((t) => t.id !== turnId));
    } finally {
      setConfirming(false);
    }
  };

  const placeholder = mode === 'decide'
    ? (turns.length > 0 ? 'Ask a follow-up…' : 'e.g. Costa or Cilantro?')
    : (turns.length > 0 ? 'Ask a follow-up…' : 'e.g. What do students think about online learning?');

  const promptSuggestions = mode === 'decide' ? DECIDE_SUGGESTIONS : RESEARCH_SUGGESTIONS;
  const empty = turns.length === 0;

  return (
    <div
      className="fixed inset-0 bg-background flex flex-col overflow-hidden w-screen max-w-[100vw] touch-pan-y"
      style={{ height: viewportHeight ? `${viewportHeight}px` : '100dvh' }}
    >
      <div
        className="flex-shrink-0 bg-background/95 backdrop-blur border-b border-border w-full max-w-[100vw] overflow-x-hidden"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center justify-between gap-1.5 px-3 py-2 w-full min-w-0 max-w-lg mx-auto overflow-hidden">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <button onClick={handleBack} className="p-1.5 -ml-1 rounded-full hover:bg-muted active:scale-95 transition shrink-0" aria-label="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-1 min-w-0">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <h1 className="text-[15px] font-bold truncate">Ask Versa</h1>
            </div>
          </div>
          <div className="flex items-center justify-end gap-1.5 shrink-0">
            <CreditBalance compact />
            {turns.length > 0 && (
              <button onClick={reset} className="flex items-center justify-center h-7 w-7 rounded-full bg-muted text-foreground active:scale-95 transition shrink-0" aria-label="New chat">
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="px-3 pb-2 w-full min-w-0 max-w-lg mx-auto overflow-hidden">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-full bg-muted w-full min-w-0">
            <button onClick={() => switchMode('decide')} className={`h-7 rounded-full text-[11px] font-bold flex items-center justify-center gap-1 transition min-w-0 ${mode === 'decide' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}>
              <Scale className="h-3 w-3 shrink-0" /> <span className="truncate">Decide</span>
            </button>
            <button onClick={() => switchMode('research')} className={`h-7 rounded-full text-[11px] font-bold flex items-center justify-center gap-1 transition min-w-0 ${mode === 'research' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}>
              <FlaskConical className="h-3 w-3 shrink-0" /> <span className="truncate">Research</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 pt-4 pb-4 space-y-4 w-full max-w-lg mx-auto min-w-0 max-w-[100vw]">
        {empty && (
          <>
            <div className="text-center pt-4 pb-2 w-full min-w-0">
              <div className="inline-flex h-12 w-12 rounded-full bg-primary/10 items-center justify-center mb-3">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-semibold text-foreground break-words">
                {mode === 'decide' ? 'Get a clear pick backed by real votes' : 'Get a research brief from Egypt\'s pulse'}
              </p>
              <p className="text-xs text-muted-foreground mt-1 break-words">
                Each insight costs credits. Vote to earn more.
              </p>
            </div>
            <SuggestionChips label={mode === 'decide' ? 'Stuck on a choice?' : 'Try a research question'} suggestions={promptSuggestions} onPick={runPreview} />
          </>
        )}

        {!empty && <AskThread turns={turns} onPickSuggestion={runPreview} />}
        <div ref={threadEndRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); runPreview(); }}
        className="flex-shrink-0 bg-background/95 backdrop-blur border-t border-border px-3 py-3 w-full max-w-[100vw] overflow-x-hidden"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
      >
        <div className="relative max-w-lg mx-auto w-full min-w-0 overflow-hidden rounded-full">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            disabled={loading}
            className="block w-full min-w-0 max-w-full h-12 pl-4 pr-14 rounded-full border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
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

      <UnlockModal
        open={!!preview}
        cost={preview?.cost ?? 0}
        balance={preview?.balance ?? 0}
        teaser={preview?.teaser ?? ''}
        route={preview?.route ?? 'simple'}
        loading={confirming}
        onConfirm={confirmAndAnswer}
        onCancel={() => setPreview(null)}
        onEarn={() => { setPreview(null); navigate('/browse'); }}
      />
    </div>
  );
}
