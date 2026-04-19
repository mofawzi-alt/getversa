import { useNavigate } from 'react-router-dom';
import { Trophy, Users, ArrowRight } from 'lucide-react';
import PollOptionImage from '@/components/poll/PollOptionImage';

export interface Verdict {
  poll_id: string;
  question: string;
  option_a: string;
  option_b: string;
  image_a_url: string | null;
  image_b_url: string | null;
  winner_side: 'A' | 'B';
  winner_label: string;
  winner_pct: number;
  loser_pct: number;
  total_votes: number;
  reason: string;
  viewer_line: string | null;
}

export default function VerdictCard({ verdict }: { verdict: Verdict }) {
  const navigate = useNavigate();
  const winSideA = verdict.winner_side === 'A';

  return (
    <div className="rounded-3xl overflow-hidden bg-card border border-border shadow-sm">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-4 pb-3">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-primary font-bold mb-2">
          <Trophy className="h-3.5 w-3.5" />
          Versa says
        </div>
        <p className="text-2xl font-extrabold leading-tight">
          Pick <span className="text-primary">{verdict.winner_label}</span>
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          <span className="font-bold text-foreground">{verdict.winner_pct}%</span> of Egyptians agree
          <span className="text-muted-foreground"> · {verdict.total_votes.toLocaleString()} votes</span>
        </p>
      </div>

      {/* Images */}
      <div className="grid grid-cols-2 aspect-[5/3] relative">
        <div className={`relative ${winSideA ? '' : 'opacity-50 grayscale'}`}>
          <PollOptionImage
            imageUrl={verdict.image_a_url}
            option={verdict.option_a}
            question={verdict.question}
            side="A"
            variant="browse"
            loading="lazy"
          />
        </div>
        <div className={`relative ${!winSideA ? '' : 'opacity-50 grayscale'}`}>
          <PollOptionImage
            imageUrl={verdict.image_b_url}
            option={verdict.option_b}
            question={verdict.question}
            side="B"
            variant="browse"
            loading="lazy"
          />
        </div>
        {/* Center pct labels */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-between px-3 pointer-events-none">
          <div className={`px-2 py-1 rounded-md text-xs font-extrabold ${winSideA ? 'bg-primary text-primary-foreground' : 'bg-background/80 text-muted-foreground'}`}>
            {winSideA ? verdict.winner_pct : verdict.loser_pct}%
          </div>
          <div className={`px-2 py-1 rounded-md text-xs font-extrabold ${!winSideA ? 'bg-primary text-primary-foreground' : 'bg-background/80 text-muted-foreground'}`}>
            {!winSideA ? verdict.winner_pct : verdict.loser_pct}%
          </div>
        </div>
      </div>

      {/* Reason + viewer line */}
      <div className="p-4 space-y-2.5">
        {verdict.reason && (
          <p className="text-sm leading-relaxed text-foreground">{verdict.reason}</p>
        )}
        {verdict.viewer_line && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>{verdict.viewer_line}</span>
          </div>
        )}
        <button
          onClick={() => navigate(`/home?pollId=${verdict.poll_id}`)}
          className="w-full mt-2 h-10 rounded-full bg-foreground text-background text-sm font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
        >
          Cast your vote
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
