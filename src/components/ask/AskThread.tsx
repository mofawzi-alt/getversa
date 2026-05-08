import { Sparkles, User, Brain, Users, Globe, Zap } from 'lucide-react';
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

/* ── Animation variants ── */
const bubbleIn = {
  initial: { opacity: 0, y: 12, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.08 } },
};

const fadeUpChild = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

/* ── Typing indicator ── */
function TypingBubble({ mode }: { mode: Mode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-1.5 px-4 py-3 rounded-2xl rounded-tl-md bg-card border border-border shadow-sm max-w-[200px]"
    >
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="block h-2 w-2 rounded-full bg-primary/60"
            animate={{ y: [0, -6, 0] }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.15,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
      <span className="text-[11px] text-muted-foreground font-medium ml-1">
        {mode === 'decide' ? 'Reading the pulse…' : 'Building your brief…'}
      </span>
    </motion.div>
  );
}

/* ── Insight section row ── */
function InsightRow({ icon: Icon, label, color, children }: { icon: any; label: string; color: string; children: React.ReactNode }) {
  return (
    <motion.div variants={fadeUpChild} className="flex items-start gap-2.5 px-4 py-3">
      <div className={`h-7 w-7 rounded-lg ${color} flex items-center justify-center shrink-0 mt-0.5`}>
        <Icon className="h-3.5 w-3.5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[10px] uppercase tracking-wider font-bold mb-0.5`} style={{ color: 'var(--color, inherit)' }}>{label}</p>
        <p className="text-sm text-foreground leading-relaxed">{children}</p>
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
          const followups = t.mode === 'decide' ? DECIDE_FOLLOWUPS : RESEARCH_FOLLOWUPS;
          const showFollowups = isLast && !t.loading && !t.lowData &&
            (t.verdict || (t.polls && t.polls.length > 0));

          return (
            <motion.div
              key={t.id}
              layout
              className="space-y-3 w-full min-w-0"
            >
              {/* ── User question bubble ── */}
              <motion.div {...bubbleIn} className="flex items-end gap-2 justify-end w-full min-w-0">
                <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary text-primary-foreground px-4 py-3 text-[15px] font-medium leading-snug break-words shadow-sm">
                  {t.question}
                </div>
              </motion.div>

              {/* ── Versa response ── */}
              <motion.div {...bubbleIn} transition={{ ...bubbleIn.transition, delay: 0.1 }} className="flex items-start gap-2.5 w-full min-w-0">
                {/* Avatar */}
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 mt-0.5 ring-2 ring-primary/10">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>

                <div className="flex-1 min-w-0 space-y-3">
                  {/* Loading / typing */}
                  {t.loading && <TypingBubble mode={t.mode} />}

                  {/* Off-scope */}
                  {!t.loading && t.variant === 'offscope' && t.summary && (
                    <motion.div {...bubbleIn}>
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
                    <motion.div {...bubbleIn} className="rounded-2xl rounded-tl-md bg-card border border-border shadow-sm p-4 space-y-3">
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
                    <motion.div {...bubbleIn} className="rounded-2xl rounded-tl-md bg-card border border-border shadow-sm p-4 space-y-2.5">
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

                  {/* Guardrail / low data */}
                  {!t.loading && !t.variant && t.lowData && t.summary && (
                    <motion.div {...bubbleIn}>
                      <GuardrailCard summary={t.summary} polls={t.guardrailPolls || []} question={t.question} askQueryId={t.askQueryId} />
                    </motion.div>
                  )}

                  {/* Verdict (decide mode) */}
                  {!t.loading && !t.lowData && !t.variant && t.mode === 'decide' && t.verdict && (
                    <motion.div {...bubbleIn}>
                      <VerdictCard verdict={t.verdict} />
                    </motion.div>
                  )}

                  {/* Plain summary (decide, no verdict) */}
                  {!t.loading && !t.lowData && !t.variant && t.mode === 'decide' && !t.verdict && t.summary && (
                    <motion.div {...bubbleIn} className="rounded-2xl rounded-tl-md bg-card border border-border shadow-sm p-4">
                      <p className="text-sm text-foreground break-words leading-relaxed">{t.summary}</p>
                    </motion.div>
                  )}

                  {/* 5-part insight breakdown */}
                  {!t.loading && !t.lowData && !t.variant && t.insightParts && (
                    <motion.div
                      variants={staggerContainer}
                      initial="initial"
                      animate="animate"
                      className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden divide-y divide-border/50"
                    >
                      {t.insightParts.why && (
                        <InsightRow icon={Brain} label="Why" color="bg-primary">
                          {t.insightParts.why}
                        </InsightRow>
                      )}
                      {t.insightParts.demographic_split && (
                        <InsightRow icon={Users} label="Demo Split" color="bg-blue-500">
                          {t.insightParts.demographic_split}
                        </InsightRow>
                      )}
                      {t.insightParts.cultural_context && (
                        <InsightRow icon={Globe} label="Cultural Context" color="bg-amber-500">
                          {t.insightParts.cultural_context}
                        </InsightRow>
                      )}
                      {t.insightParts.action_line && (
                        <InsightRow icon={Zap} label="Action" color="bg-emerald-500">
                          <span className="font-semibold">{t.insightParts.action_line}</span>
                        </InsightRow>
                      )}
                    </motion.div>
                  )}

                  {/* Research brief */}
                  {!t.loading && !t.lowData && !t.variant && t.mode === 'research' && t.summary && t.polls && t.polls.length > 0 && (
                    <motion.div {...bubbleIn}>
                      <ResearchBrief question={t.question} summary={t.summary} polls={t.polls} />
                    </motion.div>
                  )}

                  {/* Research plain summary */}
                  {!t.loading && !t.lowData && !t.variant && t.mode === 'research' && t.summary && (!t.polls || t.polls.length === 0) && (
                    <motion.div {...bubbleIn} className="rounded-2xl rounded-tl-md bg-card border border-border shadow-sm p-4">
                      <p className="text-sm text-foreground break-words leading-relaxed">{t.summary}</p>
                    </motion.div>
                  )}

                  {/* Share button */}
                  {!t.loading && !t.lowData && !t.variant && (t.verdict || t.summary) && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
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
                      transition={{ delay: 0.6 }}
                      className="flex flex-wrap gap-1.5 pt-1"
                    >
                      {followups.map((f, fi) => (
                        <motion.button
                          key={f}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.7 + fi * 0.08 }}
                          onClick={() => onPickSuggestion(f)}
                          className="h-8 px-3.5 rounded-full bg-card border border-border hover:border-primary/30 hover:bg-primary/[0.03] text-[12px] font-semibold text-foreground active:scale-95 transition-all shadow-sm"
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
