import { Sparkles, User } from 'lucide-react';
import VerdictCard, { type Verdict } from './VerdictCard';
import ResearchBrief from './ResearchBrief';
import SuggestionChips from './SuggestionChips';
import GuardrailCard from './GuardrailCard';
import EarnCreditsCTA from './EarnCreditsCTA';
import type { ResearchPoll } from '@/lib/askExport';

export type Mode = 'decide' | 'research';

export interface AskTurn {
  id: string;
  question: string;
  mode: Mode;
  loading?: boolean;
  summary?: string | null;
  verdict?: Verdict | null;
  polls?: ResearchPoll[];
  lowData?: boolean;
  suggestions?: string[];
  guardrailPolls?: Array<{ id: string; question: string; option_a: string; option_b: string; image_a_url?: string | null; image_b_url?: string | null; category?: string | null }>;
  creditsCharged?: number;
  creditsBalance?: number;
}

interface Props {
  turns: AskTurn[];
  onPickSuggestion: (s: string) => void;
}

const DECIDE_FOLLOWUPS = [
  'Why do people pick it?',
  'What\'s the runner-up argument?',
  'Compare with another option',
];

const RESEARCH_FOLLOWUPS = [
  'Summarize the main takeaway',
  'What\'s the most divisive poll?',
  'Show a related question',
];

export default function AskThread({ turns, onPickSuggestion }: Props) {
  return (
    <div className="space-y-6">
      {turns.map((t, idx) => {
        const isLast = idx === turns.length - 1;
        const followups = t.mode === 'decide' ? DECIDE_FOLLOWUPS : RESEARCH_FOLLOWUPS;
        const showFollowups = isLast && !t.loading && !t.lowData &&
          (t.verdict || (t.polls && t.polls.length > 0));

        return (
          <div key={t.id} className="space-y-3">
            {/* User question bubble */}
            <div className="flex items-start gap-2 justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-3.5 py-2.5 text-sm font-medium">
                {t.question}
              </div>
              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </div>

            {/* Versa response */}
            <div className="flex items-start gap-2">
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0 space-y-3">
                {t.loading && (
                  <div className="flex items-center gap-2 px-3.5 py-3 rounded-2xl rounded-tl-sm bg-muted/40">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-pulse" />
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-pulse [animation-delay:120ms]" />
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-pulse [animation-delay:240ms]" />
                    <span className="text-xs text-muted-foreground ml-1">
                      {t.mode === 'decide' ? 'Reading the pulse…' : 'Building your brief…'}
                    </span>
                  </div>
                )}

                {!t.loading && t.lowData && t.summary && (
                  <GuardrailCard summary={t.summary} polls={t.guardrailPolls || []} question={t.question} askQueryId={t.askQueryId} />
                )}

                {!t.loading && !t.lowData && t.mode === 'decide' && t.verdict && (
                  <VerdictCard verdict={t.verdict} />
                )}

                {!t.loading && !t.lowData && t.mode === 'decide' && !t.verdict && t.summary && (
                  <div className="rounded-2xl rounded-tl-sm bg-card border border-border p-3.5">
                    <p className="text-sm text-foreground">{t.summary}</p>
                  </div>
                )}

                {!t.loading && !t.lowData && t.mode === 'research' && t.summary && t.polls && t.polls.length > 0 && (
                  <ResearchBrief question={t.question} summary={t.summary} polls={t.polls} />
                )}

                {!t.loading && !t.lowData && t.mode === 'research' && t.summary && (!t.polls || t.polls.length === 0) && (
                  <div className="rounded-2xl rounded-tl-sm bg-card border border-border p-3.5">
                    <p className="text-sm text-foreground">{t.summary}</p>
                  </div>
                )}

                {/* Earn credits CTA after a successful paid answer */}
                {!t.loading && !t.lowData && typeof t.creditsBalance === 'number' && (t.verdict || (t.polls && t.polls.length > 0) || t.summary) && (
                  <EarnCreditsCTA balance={t.creditsBalance} charged={t.creditsCharged ?? 0} />
                )}

                {/* Follow-up chips on the latest answered turn */}
                {showFollowups && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {followups.map((f) => (
                      <button
                        key={f}
                        onClick={() => onPickSuggestion(f)}
                        className="h-7 px-3 rounded-full bg-muted hover:bg-muted/70 text-[11px] font-semibold text-foreground active:scale-95 transition"
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
