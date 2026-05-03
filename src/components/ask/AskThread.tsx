import { Sparkles, User, Brain, Users, Globe, Zap } from 'lucide-react';
import VerdictCard, { type Verdict } from './VerdictCard';
import ResearchBrief from './ResearchBrief';
import SuggestionChips from './SuggestionChips';
import GuardrailCard from './GuardrailCard';
import EarnCreditsCTA from './EarnCreditsCTA';
import SuggestPollButton from './SuggestPollButton';
import type { ResearchPoll } from '@/lib/askExport';

export type Mode = 'decide' | 'research';

export interface InsightParts {
  verdict?: string;
  why?: string;
  demographic_split?: string;
  cultural_context?: string;
  action_line?: string;
}

export interface AskTurn {
  id: string;
  question: string;
  mode: Mode;
  loading?: boolean;
  summary?: string | null;
  verdict?: Verdict | null;
  polls?: ResearchPoll[];
  lowData?: boolean;
  /** "offscope" = polite refusal, "factual" = general-knowledge answer not from votes,
   *  "clarify" = broad question, show clarifier chips */
  variant?: 'offscope' | 'factual' | 'clarify' | null;
  notice?: string | null;
  suggestions?: string[];
  clarifications?: Array<{ label: string; question: string }>;
  guardrailPolls?: Array<{ id: string; question: string; option_a: string; option_b: string; image_a_url?: string | null; image_b_url?: string | null; category?: string | null }>;
  askQueryId?: string | null;
  creditsCharged?: number;
  creditsBalance?: number;
  insightParts?: InsightParts | null;
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
    <div className="space-y-6 w-full min-w-0">
      {turns.map((t, idx) => {
        const isLast = idx === turns.length - 1;
        const followups = t.mode === 'decide' ? DECIDE_FOLLOWUPS : RESEARCH_FOLLOWUPS;
        const showFollowups = isLast && !t.loading && !t.lowData &&
          (t.verdict || (t.polls && t.polls.length > 0));

        return (
          <div key={t.id} className="space-y-3 w-full min-w-0">
            {/* User question bubble */}
            <div className="flex items-start gap-2 justify-end w-full min-w-0">
              <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-3.5 py-2.5 text-sm font-medium break-words">
                {t.question}
              </div>
              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </div>

            {/* Versa response */}
            <div className="flex items-start gap-2 w-full min-w-0">
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

                {!t.loading && t.variant === 'offscope' && t.summary && (
                  <>
                    <div className="rounded-2xl rounded-tl-sm bg-muted/40 border border-border p-3.5 space-y-2">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">No polls on this yet</p>
                      <p className="text-sm text-foreground leading-relaxed break-words">{t.summary}</p>
                      <p className="text-[11px] text-muted-foreground">No credits charged.</p>
                    </div>
                    <SuggestPollButton question={t.question} askQueryId={t.askQueryId} />
                  </>
                )}

                {!t.loading && t.variant === 'clarify' && t.summary && (
                  <div className="rounded-2xl rounded-tl-sm bg-card border border-border p-3.5 space-y-3">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-primary">Quick clarifier</p>
                    <p className="text-sm text-foreground leading-relaxed break-words">{t.summary}</p>
                    {t.clarifications && t.clarifications.length > 0 && (
                      <div className="flex flex-col gap-2 pt-1">
                        {t.clarifications.map((c) => (
                          <button
                            key={c.question}
                            onClick={() => onPickSuggestion(c.question)}
                            className="w-full text-left px-3.5 py-2.5 rounded-xl bg-primary/5 hover:bg-primary/10 border border-primary/20 active:scale-[0.99] transition"
                          >
                            <p className="text-[11px] font-bold text-primary uppercase tracking-wide">{c.label}</p>
                            <p className="text-sm font-semibold text-foreground mt-0.5 break-words">{c.question}</p>
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="text-[11px] text-muted-foreground">No credits charged.</p>
                  </div>
                )}

                {!t.loading && t.variant === 'factual' && t.summary && (
                  <div className="rounded-2xl rounded-tl-sm bg-card border border-border p-3.5 space-y-2">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground break-words">
                      {t.notice || 'General knowledge — not from Versa votes.'}
                    </p>
                    <p className="text-sm text-foreground leading-relaxed break-words">{t.summary}</p>
                    <p className="text-[11px] text-muted-foreground">No credits charged.</p>
                  </div>
                )}

                {!t.loading && !t.variant && t.lowData && t.summary && (
                  <GuardrailCard summary={t.summary} polls={t.guardrailPolls || []} question={t.question} askQueryId={t.askQueryId} />
                )}

                {!t.loading && !t.lowData && !t.variant && t.mode === 'decide' && t.verdict && (
                  <VerdictCard verdict={t.verdict} />
                )}

                {!t.loading && !t.lowData && !t.variant && t.mode === 'decide' && !t.verdict && t.summary && (
                  <div className="rounded-2xl rounded-tl-sm bg-card border border-border p-3.5">
                    <p className="text-sm text-foreground break-words">{t.summary}</p>
                  </div>
                )}

                {!t.loading && !t.lowData && !t.variant && t.mode === 'research' && t.summary && t.polls && t.polls.length > 0 && (
                  <ResearchBrief question={t.question} summary={t.summary} polls={t.polls} />
                )}

                {!t.loading && !t.lowData && !t.variant && t.mode === 'research' && t.summary && (!t.polls || t.polls.length === 0) && (
                  <div className="rounded-2xl rounded-tl-sm bg-card border border-border p-3.5">
                    <p className="text-sm text-foreground break-words">{t.summary}</p>
                  </div>
                )}

                {/* Earn credits CTA after a successful paid answer */}
                {!t.loading && !t.lowData && !t.variant && typeof t.creditsBalance === 'number' && (t.verdict || (t.polls && t.polls.length > 0) || t.summary) && (
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
