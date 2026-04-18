import { ArrowRight } from 'lucide-react';

interface Props {
  label: string;
  suggestions: string[];
  onPick: (s: string) => void;
}

export default function SuggestionChips({ label, suggestions, onPick }: Props) {
  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold px-1">
        {label}
      </p>
      <div className="space-y-2">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="w-full text-left p-3 rounded-2xl bg-card border border-border hover:bg-muted/40 active:scale-[0.99] transition text-sm flex items-center justify-between gap-2"
          >
            <span className="text-foreground">{s}</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
