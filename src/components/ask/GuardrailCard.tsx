import { AlertCircle } from 'lucide-react';
import SuggestPollButton from './SuggestPollButton';

interface SuggestedPoll {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  image_a_url?: string | null;
  image_b_url?: string | null;
  category?: string | null;
}

interface Props {
  summary: string;
  polls: SuggestedPoll[];
  question: string;
  askQueryId?: string | null;
}

export default function GuardrailCard({ summary, polls, question, askQueryId }: Props) {

  return (
    <div className="space-y-3">
      <div className="rounded-2xl rounded-tl-sm bg-muted/40 border border-border p-3.5 space-y-2">
        <div className="flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Not enough data yet</p>
        </div>
        <p className="text-sm text-foreground leading-relaxed">{summary}</p>
        <p className="text-[11px] text-muted-foreground">No credits charged.</p>
      </div>

      {/* Suggest-a-poll CTA — turns curiosity gaps into earn opportunities */}
      <SuggestPollButton question={question} askQueryId={askQueryId} />

      {polls.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground px-1">
            Vote on these to build the data
          </p>
          {polls.map((p) => (
            <div
              key={p.id}
              className="w-full flex items-center gap-3 rounded-2xl bg-card border border-border p-2.5 text-left"
            >
              <div className="flex gap-1 shrink-0">
                {p.image_a_url && (
                  <div className="h-12 w-10 rounded-lg bg-muted overflow-hidden">
                    <img src={p.image_a_url} alt={p.option_a} className="h-full w-full object-cover" />
                  </div>
                )}
                {p.image_b_url && (
                  <div className="h-12 w-10 rounded-lg bg-muted overflow-hidden">
                    <img src={p.image_b_url} alt={p.option_b} className="h-full w-full object-cover" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground line-clamp-2">{p.question}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Vote in the feed to build this answer</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
