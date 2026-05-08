import { Sparkles, Users, MapPin, UserCircle2, BarChart3, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { mapToVersaCategory } from '@/lib/categoryMeta';
import CategoryBadge from '@/components/category/CategoryBadge';
import ExportButtons from './ExportButtons';
import type { ResearchPoll } from '@/lib/askExport';

interface Props {
  question: string;
  summary: string;
  polls: ResearchPoll[];
}

const fadeUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
};

export default function ResearchBrief({ question, summary, polls }: Props) {
  const totalVotes = polls.reduce((acc, p) => acc + p.total_votes, 0);

  return (
    <div className="space-y-3">
      {/* Summary card — clean research header */}
      <motion.div
        {...fadeUp}
        transition={{ duration: 0.5 }}
        className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden"
      >
        <div className="px-4 py-2.5 bg-muted/30 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <FileText className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Research Summary</span>
          </div>
          <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">{polls.length} polls · {totalVotes.toLocaleString()} votes</span>
        </div>
        <div className="p-4">
          <p className="text-[13px] leading-relaxed text-foreground font-medium">{summary}</p>
        </div>
      </motion.div>

      {/* Export */}
      <ExportButtons payload={{ question, summary, polls }} />

      {/* Source polls */}
      <div className="pt-1">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold px-1 mb-2 flex items-center gap-1.5">
          <BarChart3 className="h-3 w-3" />
          Source Data ({polls.length} polls)
        </p>
        <div className="space-y-2">
          {polls.map((p, idx) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * idx, duration: 0.4 }}
              className="w-full text-left rounded-xl bg-card border border-border p-3.5 space-y-2.5"
            >
              <div className="flex items-start gap-2">
                <span className="text-[10px] font-bold text-muted-foreground/50 mt-0.5 tabular-nums">#{idx + 1}</span>
                <div className="flex-1 min-w-0 space-y-1.5">
                  {p.category && (
                    <CategoryBadge category={mapToVersaCategory(p.category)} size="xs" />
                  )}
                  <p className="text-[13px] font-semibold leading-snug">{p.question}</p>
                </div>
              </div>

              {/* Horizontal comparison bars */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span className="truncate max-w-[45%]">{p.option_a}</span>
                  <span className="text-muted-foreground/40">vs</span>
                  <span className="truncate max-w-[45%] text-right">{p.option_b}</span>
                </div>
                <div className="flex h-2.5 rounded-full overflow-hidden bg-muted">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${p.percent_a}%` }}
                    transition={{ delay: 0.3 + idx * 0.1, duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
                    className="bg-blue-500 rounded-l-full"
                  />
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${p.percent_b}%` }}
                    transition={{ delay: 0.4 + idx * 0.1, duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
                    className="bg-foreground/60"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold tabular-nums">{p.percent_a}%</span>
                  <span className="text-muted-foreground font-medium tabular-nums">n={p.total_votes.toLocaleString()}</span>
                  <span className="font-bold tabular-nums">{p.percent_b}%</span>
                </div>
              </div>

              {/* Demographic lines */}
              {(p.viewer_age_line || p.viewer_city_line || p.gender_teaser) && (
                <div className="space-y-1 pt-1.5 border-t border-border/40">
                  {p.viewer_age_line && (
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Users className="h-3 w-3 shrink-0" />
                      <span>{p.viewer_age_line}</span>
                    </div>
                  )}
                  {p.viewer_city_line && (
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span>{p.viewer_city_line}</span>
                    </div>
                  )}
                  {p.gender_teaser && (
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <UserCircle2 className="h-3 w-3 shrink-0" />
                      <span>{p.gender_teaser}</span>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
