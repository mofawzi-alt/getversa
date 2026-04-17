import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Brain, Check, X, Sparkles } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { getPollDisplayImageSrc } from '@/lib/pollImages';

interface PollLite {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  image_a_url: string | null;
  image_b_url: string | null;
  category: string | null;
}

interface RoundResult {
  poll: PollLite;
  predicted: 'A' | 'B';
  actualMajority: 'A' | 'B' | null;
  actualPctA: number;
  actualPctB: number;
  correct: boolean;
}

const ROUND_SIZE = 5;

export default function PlayPredict() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [polls, setPolls] = useState<PollLite[]>([]);
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    loadRound();
  }, [user]);

  const loadRound = async () => {
    setLoading(true);
    setIdx(0);
    setResults([]);
    setDone(false);

    // Get polls user hasn't predicted on yet, with at least some votes for meaningful majority
    const { data: existingPreds } = await supabase
      .from('predictions')
      .select('poll_id')
      .eq('user_id', user!.id);
    const predictedIds = new Set((existingPreds || []).map((p) => p.poll_id));

    const { data, error } = await supabase
      .from('polls')
      .select('id, question, option_a, option_b, image_a_url, image_b_url, category')
      .eq('is_active', true)
      .limit(60);

    if (error || !data) {
      toast.error('Could not load polls');
      setLoading(false);
      return;
    }

    const eligible = data.filter((p) => !predictedIds.has(p.id));
    // Shuffle and take ROUND_SIZE
    const shuffled = eligible.sort(() => Math.random() - 0.5).slice(0, ROUND_SIZE);

    if (shuffled.length === 0) {
      toast.success("You've predicted everything — come back later!");
      setLoading(false);
      setDone(true);
      return;
    }

    setPolls(shuffled);
    setStartTime(Date.now());
    setLoading(false);
  };

  const handlePredict = async (choice: 'A' | 'B') => {
    if (submitting) return;
    setSubmitting(true);

    const poll = polls[idx];
    const decisionMs = Date.now() - startTime;

    // Get current actual results for this poll
    const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: [poll.id] });
    const r = results?.[0];
    const pctA = r?.percent_a ?? 0;
    const pctB = r?.percent_b ?? 0;
    const totalVotes = Number(r?.total_votes ?? 0);
    const actualMajority: 'A' | 'B' | null =
      totalVotes >= 3 ? (pctA >= pctB ? 'A' : 'B') : null;
    const correct = actualMajority !== null && choice === actualMajority;

    // Record prediction
    await supabase.from('predictions').insert({
      user_id: user!.id,
      poll_id: poll.id,
      predicted_choice: choice,
      actual_majority: actualMajority,
      is_correct: actualMajority === null ? null : correct,
      voter_age_range: profile?.age_range ?? null,
      voter_gender: profile?.gender ?? null,
      voter_country: profile?.country ?? null,
      voter_city: profile?.city ?? null,
      decision_time_ms: decisionMs,
    });

    setResults((prev) => [
      ...prev,
      { poll, predicted: choice, actualMajority, actualPctA: pctA, actualPctB: pctB, correct },
    ]);

    // Auto-advance after short reveal
    setTimeout(() => {
      if (idx + 1 >= polls.length) {
        setDone(true);
      } else {
        setIdx(idx + 1);
        setStartTime(Date.now());
      }
      setSubmitting(false);
    }, 1500);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto px-4 py-12 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (done) {
    const correctCount = results.filter((r) => r.correct).length;
    const scoredCount = results.filter((r) => r.actualMajority !== null).length;
    const accuracy = scoredCount > 0 ? Math.round((correctCount / scoredCount) * 100) : 0;

    return (
      <AppLayout>
        <div className="max-w-lg mx-auto px-4 py-6">
          <button
            onClick={() => navigate('/play')}
            className="flex items-center gap-1 text-sm text-muted-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Play
          </button>

          <div className="text-center mb-6">
            <div className="inline-flex w-16 h-16 rounded-full bg-primary/10 items-center justify-center mb-3">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Round Complete</h1>
            <p className="text-sm text-muted-foreground mt-1">
              You read the crowd <span className="font-bold text-primary">{accuracy}%</span> right.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {correctCount} of {scoredCount || results.length} correct
            </p>
          </div>

          <div className="space-y-2 mb-6">
            {results.map((r, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/40"
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                    r.actualMajority === null
                      ? 'bg-muted'
                      : r.correct
                      ? 'bg-green-500/15 text-green-600'
                      : 'bg-red-500/15 text-red-600'
                  }`}
                >
                  {r.actualMajority === null ? (
                    <span className="text-[10px] font-bold">—</span>
                  ) : r.correct ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground line-clamp-1">
                    {r.poll.question}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    You picked <span className="font-semibold">{r.predicted}</span> ·{' '}
                    {r.actualMajority === null
                      ? 'Not enough votes yet'
                      : `Crowd: ${r.actualMajority} (${
                          r.actualMajority === 'A' ? r.actualPctA : r.actualPctB
                        }%)`}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={loadRound}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm"
            >
              Play Again
            </button>
            <button
              onClick={() => navigate('/play')}
              className="flex-1 py-3 rounded-xl bg-muted text-foreground font-bold text-sm"
            >
              Back
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const poll = polls[idx];
  const lastResult = results[results.length - 1];
  const showingReveal = submitting && lastResult && lastResult.poll.id === poll.id;

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6">
        <button
          onClick={() => navigate('/play')}
          className="flex items-center gap-1 text-sm text-muted-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Exit
        </button>

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Predict the Crowd
            </span>
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            {idx + 1} / {polls.length}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1 rounded-full bg-muted mb-5 overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((idx + (showingReveal ? 1 : 0)) / polls.length) * 100}%` }}
          />
        </div>

        {/* Question */}
        <div className="mb-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
            What will the majority pick?
          </p>
          <h2 className="text-lg font-bold text-foreground leading-tight">{poll.question}</h2>
        </div>

        {/* Options */}
        <div className="grid grid-cols-2 gap-3">
          {(['A', 'B'] as const).map((opt) => {
            const label = opt === 'A' ? poll.option_a : poll.option_b;
            const img = opt === 'A' ? poll.image_a_url : poll.image_b_url;
            const src = getPollDisplayImageSrc(img, label);
            const isPicked = showingReveal && lastResult?.predicted === opt;
            const isMajority = showingReveal && lastResult?.actualMajority === opt;
            const pct = showingReveal
              ? opt === 'A'
                ? lastResult!.actualPctA
                : lastResult!.actualPctB
              : null;

            return (
              <button
                key={opt}
                onClick={() => handlePredict(opt)}
                disabled={submitting}
                className={`relative aspect-[4/5] rounded-2xl overflow-hidden border-2 transition-all ${
                  isMajority
                    ? 'border-primary shadow-lg'
                    : isPicked
                    ? 'border-foreground/40'
                    : 'border-border/40 hover:border-primary/40 active:scale-[0.98]'
                }`}
              >
                {src ? (
                  <img src={src} alt={label} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-muted" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                {showingReveal && pct !== null && (
                  <div className="absolute top-2 right-2 px-2 py-1 rounded-full bg-background/90 backdrop-blur text-[11px] font-bold text-foreground">
                    {pct}%
                  </div>
                )}

                {isMajority && (
                  <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wider">
                    Crowd
                  </div>
                )}
                {isPicked && (
                  <div className="absolute bottom-12 left-2 px-2 py-1 rounded-full bg-background/90 text-[9px] font-bold uppercase tracking-wider text-foreground">
                    Your Pick
                  </div>
                )}

                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-sm font-bold text-white drop-shadow text-left">{label}</p>
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Tap the option you think most people will pick
        </p>
      </div>
    </AppLayout>
  );
}
