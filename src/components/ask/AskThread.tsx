import { Sparkles, User, Brain, Users, Globe, Zap, BarChart3, Target, TrendingUp, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ShareToStoryButton from '@/components/stories/ShareToStoryButton';
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
  variant?: 'offscope' | 'factual' | 'clarify' | 'smart_answer' | null;
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

/* ── DECIDE animation variants — fast, spring-loaded, punchy ── */
const decideBubbleIn = {
  initial: { opacity: 0, y: 20, scale: 0.9 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: 0.25, type: 'spring' as const, damping: 15, stiffness: 300 },
};

/* ── RESEARCH animation variants — smooth, deliberate, analytical ── */
const researchBubbleIn = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.08 } },
};

const fadeUpChild = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

/* ── Decide typing indicator — fast pulse ── */
function DecideTypingBubble() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', damping: 12 }}
      className="flex items-center gap-2 px-4 py-3 rounded-2xl rounded-tl-md bg-primary/5 border border-primary/20 shadow-sm max-w-[200px]"
    >
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="block h-2.5 w-2.5 rounded-full bg-primary"
            animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
            transition={{
              duration: 0.5,
              repeat: Infinity,
              delay: i * 0.12,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
      <span className="text-[11px] text-primary font-bold ml-0.5">
        Checking votes…
      </span>
    </motion.div>
  );
}

/* ── Research typing indicator — calm, analytical ── */
function ResearchTypingBubble() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="flex items-center gap-2 px-4 py-3 rounded-2xl rounded-tl-md bg-card border border-border shadow-sm max-w-[240px]"
    >
      <BarChart3 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
      <div className="flex items-center gap-1">
        <motion.div
          className="h-1 rounded-full bg-blue-400"
          animate={{ width: ['12px', '28px', '20px', '36px'] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <span className="text-[11px] text-muted-foreground font-medium">
        Analyzing data…
      </span>
    </motion.div>
  );
}

/* ── Decide insight row — punchy, bold ── */
function DecideInsightRow({ icon: Icon, label, color, children }: { icon: any; label: string; color: string; children: React.ReactNode }) {
  return (
    <motion.div variants={fadeUpChild} className="flex items-start gap-2.5 px-3.5 py-2.5">
      <div className={`h-6 w-6 rounded-full ${color} flex items-center justify-center shrink-0 mt-0.5`}>
        <Icon className="h-3 w-3 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground mb-0.5">{label}</p>
        <p className="text-[14px] text-foreground leading-snug font-bold">{children}</p>
      </div>
    </motion.div>
  );
}

/* ── Research insight row — structured, analytical ── */
function ResearchInsightRow({ icon: Icon, label, color, children }: { icon: any; label: string; color: string; children: React.ReactNode }) {
  return (
    <motion.div variants={fadeUpChild} className="flex items-start gap-3 px-4 py-3">
      <div className={`h-7 w-7 rounded-lg ${color} flex items-center justify-center shrink-0 mt-0.5`}>
        <Icon className="h-3.5 w-3.5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">{label}</p>
        <p className="text-[13px] text-foreground leading-relaxed font-medium">{children}</p>
      </div>
    </motion.div>
  );
}

export default function AskThread({ turns, onPickSuggestion }: Props) {
  return (
    <div className="space-y-5 w-full min-w-0">
      <AnimatePresence mode="popLayout">
        {turns.map((t, idx) => {
          const isLast = idx === turns.length - 1;
          const isDecide = t.mode === 'decide';
          const followups = isDecide ? DECIDE_FOLLOWUPS : RESEARCH_FOLLOWUPS;
          const showFollowups = isLast && !t.loading && !t.lowData &&
            (t.verdict || (t.polls && t.polls.length > 0));
          const bubble = isDecide ? decideBubbleIn : researchBubbleIn;

          return (
            <motion.div
              key={t.id}
              layout
              className="space-y-3 w-full min-w-0"
            >
              {/* ── User question bubble ── */}
              <motion.div {...bubble} className="flex items-end gap-2 justify-end w-full min-w-0">
                <div className={`max-w-[80%] rounded-2xl rounded-br-md px-4 py-3 text-[15px] font-medium leading-snug break-words shadow-sm ${
                  isDecide
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-foreground/90 text-background'
                }`}>
                  {t.question}
                </div>
              </motion.div>

              {/* ── Versa response ── */}
              <motion.div {...bubble} transition={{ ...bubble.transition, delay: 0.1 }} className="flex items-start gap-2.5 w-full min-w-0">
                {/* Avatar */}
                <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ring-2 ${
                  isDecide
                    ? 'bg-gradient-to-br from-primary/30 to-primary/10 ring-primary/15'
                    : 'bg-gradient-to-br from-blue-500/20 to-blue-500/5 ring-blue-500/10'
                }`}>
                  {isDecide
                    ? <Sparkles className="h-4 w-4 text-primary" />
                    : <BarChart3 className="h-4 w-4 text-blue-500" />
                  }
                </div>

                <div className="flex-1 min-w-0 space-y-3">
                  {/* Loading / typing */}
                  {t.loading && (isDecide ? <DecideTypingBubble /> : <ResearchTypingBubble />)}

                  {/* Off-scope */}
                  {!t.loading && t.variant === 'offscope' && t.summary && (
                    <motion.div {...bubble}>
                      <div className="rounded-2xl rounded-tl-md bg-card border border-border shadow-sm p-4 space-y-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">🤔</span>
                          <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">No polls on this yet</p>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed break-words">{t.summary}</p>
                        <p className="text-[11px] text-muted-foreground/70">No credits charged.</p>
                      </div>
                      <div className="mt-2">
                        <SuggestPollButton question={t.question} askQueryId={t.askQueryId} />
                      </div>
                    </motion.div>
                  )}

                  {/* Clarify */}
                  {!t.loading && t.variant === 'clarify' && t.summary && (
                    <motion.div {...bubble} className="rounded-2xl rounded-tl-md bg-card border border-border shadow-sm p-4 space-y-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">💡</span>
                        <p className="text-[10px] uppercase tracking-wider font-bold text-primary">Be more specific</p>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed break-words">{t.summary}</p>
                      {t.clarifications && t.clarifications.length > 0 && (
                        <div className="flex flex-col gap-2 pt-1">
                          {t.clarifications.map((c, ci) => (
                            <motion.button
                              key={c.question}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: ci * 0.1 + 0.2 }}
                              onClick={() => onPickSuggestion(c.question)}
                              className="w-full text-left px-4 py-3 rounded-xl bg-primary/5 hover:bg-primary/10 border border-primary/15 active:scale-[0.99] transition-all group"
                            >
                              <p className="text-[10px] font-bold text-primary uppercase tracking-wide">{c.label}</p>
                              <p className="text-sm font-semibold text-foreground mt-0.5 break-words group-hover:text-primary transition-colors">{c.question}</p>
                            </motion.button>
                          ))}
                        </div>
                      )}
                      <p className="text-[11px] text-muted-foreground/70">No credits charged.</p>
                    </motion.div>
                  )}

                  {/* Factual */}
                  {!t.loading && t.variant === 'factual' && t.summary && (
                    <motion.div {...bubble} className="rounded-2xl rounded-tl-md bg-card border border-border shadow-sm p-4 space-y-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">📚</span>
                        <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground break-words">
                          {t.notice || 'General knowledge — not from Versa votes.'}
                        </p>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed break-words">{t.summary}</p>
                      <p className="text-[11px] text-muted-foreground/70">No credits charged.</p>
                    </motion.div>
                  )}

                  {/* Smart answer */}
                  {!t.loading && t.variant === 'smart_answer' && t.summary && (
                    <motion.div {...bubble}>
                      <div className="rounded-2xl rounded-tl-md bg-card border border-border shadow-sm p-4 space-y-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">🔍</span>
                          <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">No direct poll data yet</p>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-line break-words">{t.summary}</p>
                        {t.guardrailPolls && t.guardrailPolls.length > 0 && (
                          <div className="pt-2 border-t border-border space-y-2">
                            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Vote on related polls to build this data</p>
                            {t.guardrailPolls.map((p) => (
                              <button key={p.id} onClick={() => onPickSuggestion?.(p.question)} className="w-full text-left p-2.5 rounded-xl bg-muted/50 hover:bg-muted transition text-xs font-medium text-foreground break-words">
                                {p.question}
                              </button>
                            ))}
                          </div>
                        )}
                        <p className="text-[11px] text-muted-foreground/70">No credits charged.</p>
                      </div>
                      <div className="mt-2">
                        <SuggestPollButton question={t.question} askQueryId={t.askQueryId} />
                      </div>
                    </motion.div>
                  )}

                  {/* Guardrail / low data */}
                  {!t.loading && !t.variant && t.lowData && t.summary && (
                    <motion.div {...bubble}>
                      <GuardrailCard summary={t.summary} polls={t.guardrailPolls || []} question={t.question} askQueryId={t.askQueryId} />
                    </motion.div>
                  )}

                  {/* ════════════════════════════════════════════ */}
                  {/* DECIDE MODE — Verdict card (punchy, fast)   */}
                  {/* ════════════════════════════════════════════ */}
                  {!t.loading && !t.lowData && !t.variant && isDecide && t.verdict && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.85, y: 24 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: 'spring', damping: 14, stiffness: 200 }}
                    >
                      <VerdictCard verdict={t.verdict} />
                    </motion.div>
                  )}

                  {/* Decide plain summary (no verdict) */}
                  {!t.loading && !t.lowData && !t.variant && isDecide && !t.verdict && t.summary && (
                    <motion.div {...decideBubbleIn} className="rounded-2xl rounded-tl-md bg-primary/5 border border-primary/20 shadow-sm p-4">
                      <p className="text-sm text-foreground break-words leading-relaxed font-semibold">{t.summary}</p>
                    </motion.div>
                  )}

                  {/* DECIDE — Data provenance badge (pulse, fast) */}
                  {!t.loading && !t.lowData && !t.variant && isDecide && t.verdict && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3, type: 'spring', damping: 12 }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/15 w-fit"
                    >
                      <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      <span className="text-[10px] font-bold text-primary">
                        {t.verdict.total_votes.toLocaleString()} real votes
                        {t.verdict.real_votes && t.verdict.real_votes !== t.verdict.total_votes ? ` · ${t.verdict.real_votes.toLocaleString()} organic` : ''}
                      </span>
                    </motion.div>
                  )}

                  {/* DECIDE — Insight breakdown (max 2 rows, punchy) */}
                  {!t.loading && !t.lowData && !t.variant && isDecide && t.insightParts && (
                    <motion.div
                      variants={staggerContainer}
                      initial="initial"
                      animate="animate"
                      className="rounded-2xl bg-card border border-primary/10 shadow-sm overflow-hidden divide-y divide-border/20"
                    >
                      {t.insightParts.why && (
                        <DecideInsightRow icon={Zap} label="The vibe" color="bg-primary">
                          {t.insightParts.why}
                        </DecideInsightRow>
                      )}
                      {t.insightParts.demographic_split && (
                        <DecideInsightRow icon={Users} label="Plot twist" color="bg-amber-500">
                          {t.insightParts.demographic_split}
                        </DecideInsightRow>
                      )}
                    </motion.div>
                  )}

                  {/* ════════════════════════════════════════════════ */}
                  {/* RESEARCH MODE — Structured brief (analytical)   */}
                  {/* ════════════════════════════════════════════════ */}
                  {!t.loading && !t.lowData && !t.variant && !isDecide && t.verdict && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
                    >
                      <VerdictCard verdict={t.verdict} variant="research" />
                    </motion.div>
                  )}

                  {/* RESEARCH — Data provenance (clean, trustworthy) */}
                  {!t.loading && !t.lowData && !t.variant && !isDecide && t.verdict && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.6 }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100 w-fit"
                    >
                      <BarChart3 className="h-3 w-3 text-blue-500" />
                      <span className="text-[10px] font-semibold text-blue-600">
                        Based on {t.verdict.total_votes.toLocaleString()} verified votes
                      </span>
                    </motion.div>
                  )}

                  {/* RESEARCH — Full insight breakdown (all sections) */}
                  {!t.loading && !t.lowData && !t.variant && !isDecide && t.insightParts && (
                    <motion.div
                      variants={staggerContainer}
                      initial="initial"
                      animate="animate"
                      className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden"
                    >
                      {/* Section header */}
                      <div className="px-4 py-2.5 bg-muted/30 border-b border-border">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Analysis Breakdown</p>
                      </div>
                      <div className="divide-y divide-border/30">
                        {t.insightParts.why && (
                          <ResearchInsightRow icon={Target} label="Main Finding" color="bg-blue-500">
                            {t.insightParts.why}
                          </ResearchInsightRow>
                        )}
                        {t.insightParts.demographic_split && (
                          <ResearchInsightRow icon={Users} label="Demographic Insight" color="bg-violet-500">
                            {t.insightParts.demographic_split}
                          </ResearchInsightRow>
                        )}
                        {t.insightParts.cultural_context && (
                          <ResearchInsightRow icon={Globe} label="Cultural Context" color="bg-emerald-500">
                            {t.insightParts.cultural_context}
                          </ResearchInsightRow>
                        )}
                        {t.insightParts.action_line && (
                          <ResearchInsightRow icon={TrendingUp} label="Strategic Takeaway" color="bg-amber-500">
                            {t.insightParts.action_line}
                          </ResearchInsightRow>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* Research brief (polls data) */}
                  {!t.loading && !t.lowData && !t.variant && !isDecide && t.summary && t.polls && t.polls.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.3 }}
                    >
                      <ResearchBrief question={t.question} summary={t.summary} polls={t.polls} />
                    </motion.div>
                  )}

                  {/* Research plain summary */}
                  {!t.loading && !t.lowData && !t.variant && !isDecide && t.summary && (!t.polls || t.polls.length === 0) && !t.verdict && (
                    <motion.div {...researchBubbleIn} className="rounded-2xl rounded-tl-md bg-card border border-border shadow-sm p-4">
                      <p className="text-sm text-foreground break-words leading-relaxed">{t.summary}</p>
                    </motion.div>
                  )}

                  {/* Share button */}
                  {!t.loading && !t.lowData && !t.variant && (t.verdict || t.summary) && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: isDecide ? 0.4 : 0.7 }}>
                      <ShareToStoryButton
                        storyType="poll_result"
                        content={{
                          question: t.question,
                          option_a: t.verdict?.option_a || 'Option A',
                          option_b: t.verdict?.option_b || 'Option B',
                          pct_a: t.verdict ? (t.verdict.winner_side === 'A' ? t.verdict.winner_pct : t.verdict.loser_pct) : 50,
                          pct_b: t.verdict ? (t.verdict.winner_side === 'B' ? t.verdict.winner_pct : t.verdict.loser_pct) : 50,
                          total_votes: t.verdict?.total_votes || 0,
                          winning_option: t.verdict?.winner_label || '',
                          winning_pct: t.verdict?.winner_pct || 0,
                          image_a_url: t.verdict?.image_a_url,
                          image_b_url: t.verdict?.image_b_url,
                          poll_id: t.verdict?.poll_id,
                        }}
                        imageUrl={t.verdict?.image_a_url || t.verdict?.image_b_url}
                        variant="compact"
                      />
                    </motion.div>
                  )}

                  {/* Earn credits CTA */}
                  {!t.loading && !t.lowData && !t.variant && typeof t.creditsBalance === 'number' && (t.verdict || (t.polls && t.polls.length > 0) || t.summary) && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                      <EarnCreditsCTA balance={t.creditsBalance} charged={t.creditsCharged ?? 0} />
                    </motion.div>
                  )}

                  {/* Follow-up chips */}
                  {showFollowups && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: isDecide ? 0.5 : 0.8 }}
                      className="flex flex-wrap gap-1.5 pt-1"
                    >
                      {followups.map((f, fi) => (
                        <motion.button
                          key={f}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: (isDecide ? 0.6 : 0.9) + fi * 0.08 }}
                          onClick={() => onPickSuggestion(f)}
                          className={`h-8 px-3.5 rounded-full text-[12px] font-semibold active:scale-95 transition-all shadow-sm ${
                            isDecide
                              ? 'bg-primary/5 border border-primary/20 hover:bg-primary/10 text-foreground'
                              : 'bg-card border border-border hover:border-blue-200 hover:bg-blue-50/50 text-foreground'
                          }`}
                        >
                          {f}
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
