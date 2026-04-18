import { useNavigate } from 'react-router-dom';
import { Sparkles, Users, MapPin, UserCircle2 } from 'lucide-react';
import { mapToVersaCategory } from '@/lib/categoryMeta';
import CategoryBadge from '@/components/category/CategoryBadge';
import ExportButtons from './ExportButtons';
import type { ResearchPoll } from '@/lib/askExport';

interface Props {
  question: string;
  summary: string;
  polls: ResearchPoll[];
}

export default function ResearchBrief({ question, summary, polls }: Props) {
  const navigate = useNavigate();
  const totalVotes = polls.reduce((acc, p) => acc + p.total_votes, 0);

  return (
    <div className="space-y-4">
      {/* Headline summary */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-4 space-y-3">
        <div className="flex items-start gap-2">
          <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-sm leading-relaxed text-foreground font-medium">{summary}</p>
        </div>
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider font-semibold text-muted-foreground border-t border-primary/10 pt-2">
          <span>{polls.length} polls · {totalVotes.toLocaleString()} votes</span>
          <span>Versa data</span>
        </div>
      </div>

      {/* Export */}
      <ExportButtons payload={{ question, summary, polls }} />

      {/* Source polls */}
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold px-1 pt-1">
        Source polls
      </p>
      <div className="space-y-2.5">
        {polls.map((p, idx) => (
          <button
            key={p.id}
            onClick={() => navigate(`/poll/${p.id}`)}
            className="w-full text-left rounded-2xl bg-card border border-border p-3.5 active:scale-[0.99] transition space-y-2.5"
          >
            <div className="flex items-start gap-2">
              <span className="text-[11px] font-bold text-muted-foreground mt-0.5">#{idx + 1}</span>
              <div className="flex-1 min-w-0 space-y-1.5">
                {p.category && (
                  <CategoryBadge category={mapToVersaCategory(p.category)} size="xs" />
                )}
                <p className="text-sm font-semibold leading-snug">{p.question}</p>
              </div>
            </div>

            {/* Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold">
                <span className="truncate max-w-[45%]">{p.option_a}</span>
                <span className="text-muted-foreground">vs</span>
                <span className="truncate max-w-[45%] text-right">{p.option_b}</span>
              </div>
              <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                <div className="bg-primary" style={{ width: `${p.percent_a}%` }} />
                <div className="bg-foreground/70" style={{ width: `${p.percent_b}%` }} />
              </div>
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span>{p.percent_a}%</span>
                <span className="text-muted-foreground font-normal">n={p.total_votes}</span>
                <span>{p.percent_b}%</span>
              </div>
            </div>

            {/* Personal lines */}
            {(p.viewer_age_line || p.viewer_city_line || p.gender_teaser) && (
              <div className="space-y-1 pt-1 border-t border-border/60">
                {p.viewer_age_line && (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {p.viewer_age_line}
                  </div>
                )}
                {p.viewer_city_line && (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {p.viewer_city_line}
                  </div>
                )}
                {p.gender_teaser && (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <UserCircle2 className="h-3 w-3" />
                    {p.gender_teaser}
                  </div>
                )}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
