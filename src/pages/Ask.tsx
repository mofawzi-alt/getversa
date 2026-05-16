import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Loader2, Scale, FlaskConical, ArrowUp, RotateCcw, Lock, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useAskCredits } from '@/hooks/useAskCredits';
import { useUserVoteCount } from '@/hooks/useUserVoteCount';
import { Progress } from '@/components/ui/progress';
import SuggestionChips from '@/components/ask/SuggestionChips';
import AskThread, { type AskTurn, type Mode } from '@/components/ask/AskThread';
import CreditBalance from '@/components/ask/CreditBalance';
import UnlockModal from '@/components/ask/UnlockModal';

const DECIDE_SUGGESTIONS = [
  { text: 'Costa or Cilantro for studying?', tag: 'Trending', icon: 'flame' as const },
  { text: 'iPhone or Samsung — which lasts longer?', tag: '2.4K voted', icon: 'users' as const },
  { text: 'Should I order Talabat or Elmenus tonight?', tag: 'Hot', icon: 'zap' as const },
  { text: 'Nike or Adidas for everyday wear?', tag: '50/50 split', icon: 'trending' as const },
];

const RESEARCH_SUGGESTIONS = [
  { text: 'How do students feel about online learning?', tag: 'Popular', icon: 'flame' as const },
  { text: 'What do people think about marriage age in Egypt?', tag: 'Divisive', icon: 'trending' as const },
  { text: 'Cairo vs Alexandria lifestyle differences', tag: '1.8K votes', icon: 'users' as const },
  { text: 'Which fast food brand wins with 18–24?', tag: 'Hot', icon: 'zap' as const },
  { text: 'How divided are Egyptians on Ahly vs Zamalek?', tag: '50/50', icon: 'flame' as const },
];

/* Rotating placeholder phrases */
const DECIDE_PLACEHOLDERS = [
  'Ask what Egypt thinks…',
  'What are people choosing?',
  'Ask the pulse of Egypt…',
  'What would Egypt pick?',
  'Help me decide…',
];

const RESEARCH_PLACEHOLDERS = [
  'Explore public sentiment…',
  'What does Egypt really think?',
  'Discover opinion patterns…',
  'Analyze the public mood…',
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

function createTurnId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `turn-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
  prefill?: string;
}

export default function Ask() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const { data: askCredits = 0 } = useAskCredits();
  const { totalVotes, askLevel, levelLabel } = useUserVoteCount();
  const [mode, setMode] = useState<Mode>('decide');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [turns, setTurns] = useState<AskTurn[]>([]);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  /* Rotating placeholder */
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholderIdx((prev) => prev + 1);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const placeholders = mode === 'decide' ? DECIDE_PLACEHOLDERS : RESEARCH_PLACEHOLDERS;
  const currentPlaceholder = turns.length > 0
    ? 'Ask a follow-up…'
    : placeholders[placeholderIdx % placeholders.length];

  const focusInputIfDesktop = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches) {
      inputRef.current?.focus();
    }
  };

  useEffect(() => { setTimeout(focusInputIfDesktop, 200); }, []);
  useEffect(() => { threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [turns]);

  const [pendingAutoSubmit, setPendingAutoSubmit] = useState<string | null>(null);

  useEffect(() => {
    const state = location.state as AskLocationState | null;
    if (state?.prefill && !turns.length) {
      setQuery(state.prefill);
      setPendingAutoSubmit(state.prefill);
      window.history.replaceState({ ...window.history.state, usr: { ...state, prefill: undefined } }, '');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pendingAutoSubmit && !loading && !confirming) {
      const q = pendingAutoSubmit;
      const timer = setTimeout(() => {
        setPendingAutoSubmit(null);
        runPreview(q);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [pendingAutoSubmit]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const vv = (typeof window !== 'undefined' ? window.visualViewport : null);
    if (!vv || typeof vv.addEventListener !== 'function') return;
    const update = () => {
      const height = Number(vv.height) || window.innerHeight;
      const offsetTop = Number(vv.offsetTop) || 0;
      const offset = Math.max(0, window.innerHeight - height - offsetTop);
      document.documentElement.style.setProperty('--ask-kb-offset', `${offset}px`);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      document.documentElement.style.removeProperty('--ask-kb-offset');
    };
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
    ask_level: askLevel,
  } : undefined;

  const autoConfirm = async (previewData: PreviewState) => {
    setConfirming(true);
    const turnId = createTurnId();
    const placeholder: AskTurn = { id: turnId, question: previewData.question, mode: previewData.mode, loading: true };
    setTurns((prev) => [...prev, placeholder]);

    try {
      const { data, error } = await supabase.functions.invoke('ask-versa', {
        body: { question: previewData.question, mode: 'auto', viewer, history: previewData.history, stage: 'confirm' },
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
        insightParts: data.insight_parts || null,
      } as AskTurn : t));
      qc.invalidateQueries({ queryKey: ['ask-credits'] });

      const remaining = data.credits_balance ?? 0;
      if (remaining <= 10 && remaining > 0) {
        toast(`You have ${remaining} credit${remaining === 1 ? '' : 's'} left — vote on more polls to earn more!`, { icon: '💡' });
      } else if (remaining <= 0) {
        toast('You\'re out of credits! Vote on polls to earn more.', { icon: '🗳️' });
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed');
      setTurns((prev) => prev.filter((t) => t.id !== turnId));
    } finally {
      setConfirming(false);
    }
  };

  const runPreview = async (q?: string) => {
    const question = (q ?? query).trim();
    if (question.length < 3) { toast.error('Type a fuller question'); return; }
    if (loading) return;

    setQuery('');
    setLoading(true);
    const history = buildHistoryFromTurns(turns);

    try {
      const { data, error } = await supabase.functions.invoke('ask-versa', {
        body: { question, mode: 'auto', viewer, history, stage: 'preview' },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }

      if (data.stage === 'offscope') {
        const turnId = createTurnId();
        setTurns((prev) => [...prev, { id: turnId, question, mode, loading: false, summary: data.summary, variant: 'offscope' } as AskTurn]);
        return;
      }

      if (data.stage === 'vague') {
        const turnId = createTurnId();
        setTurns((prev) => [...prev, { id: turnId, question, mode, loading: false, summary: data.summary, variant: 'offscope' } as AskTurn]);
        return;
      }

      if (data.stage === 'clarify') {
        const turnId = createTurnId();
        setTurns((prev) => [...prev, { id: turnId, question, mode, loading: false, summary: data.summary, variant: 'clarify', clarifications: data.clarifications || [], askQueryId: data.query_id || null } as AskTurn]);
        return;
      }

      if (data.stage === 'factual' || data.stage === 'about') {
        const turnId = createTurnId();
        setTurns((prev) => [...prev, { id: turnId, question, mode, loading: false, summary: data.summary, notice: data.notice, variant: 'factual' } as AskTurn]);
        return;
      }

      if (data.stage === 'smart_answer') {
        const turnId = createTurnId();
        setTurns((prev) => [...prev, { id: turnId, question, mode, loading: false, summary: data.summary, guardrailPolls: data.suggested_polls || [], variant: 'smart_answer', askQueryId: data.query_id || null } as AskTurn]);
        return;
      }

      if (data.stage === 'guardrail') {
        const turnId = createTurnId();
        setTurns((prev) => [...prev, { id: turnId, question, mode, loading: false, summary: data.summary, lowData: true, guardrailPolls: data.suggested_polls || [], askQueryId: data.query_id || null } as AskTurn]);
        return;
      }

      if (data.stage === 'preview') {
        const balance = data.credits_balance ?? askCredits;
        const cost = data.cost ?? 1;
        const previewState: PreviewState = { question, mode, route: data.route, cost, balance, teaser: data.teaser, history };

        if (pendingAutoSubmit || balance >= cost) {
          await autoConfirm(previewState);
        } else {
          setPreview(previewState);
        }
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Search failed');
    } finally {
      setLoading(false);
      setTimeout(focusInputIfDesktop, 50);
    }
  };

  const promptSuggestions = mode === 'decide' ? DECIDE_SUGGESTIONS : RESEARCH_SUGGESTIONS;
  const empty = turns.length === 0;
  const isDecide = mode === 'decide';

  return (
    <div
      className="fixed inset-0 bg-background flex flex-col overflow-hidden w-full max-w-full touch-pan-y"
      style={{ height: '100vh', width: '100%', maxWidth: '100%' }}
    >
      {/* ── Header ── */}
      <div
        className="flex-shrink-0 bg-background/95 backdrop-blur-lg border-b border-border/60 w-full max-w-[100vw] overflow-x-hidden"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center justify-between gap-1.5 px-3 py-2 w-full min-w-0 max-w-lg mx-auto overflow-hidden">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <button onClick={handleBack} className="p-1.5 -ml-1 rounded-full hover:bg-muted active:scale-95 transition shrink-0" aria-label="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="relative">
                <Sparkles className="h-4 w-4 text-primary shrink-0" />
                <div className="absolute inset-0 animate-ping opacity-20">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
              </div>
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
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 pt-4 pb-4 space-y-4 w-full max-w-lg mx-auto min-w-0 max-w-[100vw]">
        {/* Locked state */}
        {empty && askLevel === 0 && (
          <div className="text-center pt-8 pb-4 w-full min-w-0 px-4">
            <div className="inline-flex h-14 w-14 rounded-full bg-muted items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-base font-bold text-foreground mb-2">Vote on 15 polls to unlock Ask Versa</p>
            <div className="max-w-[200px] mx-auto mb-2">
              <Progress value={(totalVotes / 15) * 100} className="h-2" />
            </div>
            <p className="text-xs text-muted-foreground">{totalVotes} of 15 polls voted</p>
            <button
              onClick={() => navigate('/home')}
              className="mt-4 h-10 px-6 rounded-full bg-primary text-primary-foreground text-sm font-bold active:scale-95 transition"
            >
              Start voting
            </button>
          </div>
        )}

        {/* ── DECIDE empty state ── */}
        {empty && askLevel > 0 && isDecide && (
          <>
            <motion.div
              key="decide-empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="text-center pt-4 pb-3 w-full min-w-0">
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 8, stiffness: 200 }}
                  className="inline-flex h-16 w-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 items-center justify-center mb-3 shadow-lg shadow-primary/10"
                >
                  <Scale className="h-7 w-7 text-primary" />
                </motion.div>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="text-lg font-black text-foreground break-words"
                >
                  Can't decide? Egypt already did.
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-xs text-muted-foreground mt-1 break-words"
                >
                  Instant answers backed by real public votes
                </motion.p>
              </div>
              <SuggestionChips label="🔥 Everyone's asking right now" suggestions={promptSuggestions} onPick={runPreview} variant="decide" />
            </motion.div>
          </>
        )}

        {/* ── RESEARCH empty state ── */}
        {empty && askLevel > 0 && !isDecide && (
          <>
            <motion.div
              key="research-empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="text-center pt-4 pb-3 w-full min-w-0">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="inline-flex h-16 w-16 rounded-2xl bg-gradient-to-br from-foreground/8 to-foreground/3 items-center justify-center mb-3 border border-border/50"
                >
                  <BarChart3 className="h-7 w-7 text-foreground/50" />
                </motion.div>
                <motion.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                  className="text-base font-semibold text-foreground break-words"
                >
                  Understand what Egypt really thinks
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-xs text-muted-foreground mt-1 break-words"
                >
                  Deep patterns from real voter data · Demographics · Cultural splits
                </motion.p>
              </div>
              <SuggestionChips label="📊 Trending research questions" suggestions={promptSuggestions} onPick={runPreview} variant="research" />
            </motion.div>
          </>
        )}

        {!empty && <AskThread turns={turns} onPickSuggestion={runPreview} />}
        <div ref={threadEndRef} />
      </div>

      {/* ── Input bar ── */}
      {askLevel > 0 && (
        <form
          onSubmit={(e) => { e.preventDefault(); runPreview(); }}
          className="flex-shrink-0 bg-background/95 backdrop-blur-lg border-t border-border/60 px-3 py-3 w-full max-w-[100vw] overflow-x-hidden transition-transform duration-150"
          style={{
            paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)',
            transform: 'translateY(calc(-1 * var(--ask-kb-offset, 0px)))',
          }}
        >
          <div className={`relative max-w-lg mx-auto w-full min-w-0 overflow-hidden rounded-full transition-shadow duration-300 ${
            isDecide
              ? 'shadow-md shadow-primary/5 focus-within:shadow-lg focus-within:shadow-primary/10'
              : 'shadow-sm focus-within:shadow-md'
          }`}>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={currentPlaceholder}
              disabled={loading}
              className={`block w-full min-w-0 max-w-full h-12 pl-4 pr-14 rounded-full border text-base transition-all duration-200 focus:outline-none disabled:opacity-60 ${
                isDecide
                  ? 'border-primary/20 bg-card focus:border-primary/40 focus:ring-2 focus:ring-primary/15'
                  : 'border-border bg-card focus:border-blue-200 focus:ring-2 focus:ring-blue-100/50'
              }`}
            />
            <button
              type="submit"
              disabled={loading || query.trim().length < 3}
              className={`absolute right-1.5 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full disabled:opacity-40 active:scale-90 transition-all flex items-center justify-center ${
                isDecide
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                  : 'bg-foreground/90 text-background shadow-sm'
              }`}
              aria-label="Send"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </button>
          </div>
        </form>
      )}

      <UnlockModal
        open={!!preview}
        cost={preview?.cost ?? 0}
        balance={preview?.balance ?? 0}
        teaser={preview?.teaser ?? ''}
        route={preview?.route ?? 'simple'}
        loading={confirming}
        onConfirm={() => preview && autoConfirm(preview)}
        onCancel={() => setPreview(null)}
        onEarn={() => { setPreview(null); navigate('/browse'); }}
      />
    </div>
  );
}
