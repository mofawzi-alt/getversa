import { ArrowRight, Flame, TrendingUp, Zap, Users } from 'lucide-react';

interface Suggestion {
  text: string;
  tag?: string;
  icon?: 'flame' | 'trending' | 'zap' | 'users';
}

interface Props {
  label: string;
  suggestions: (string | Suggestion)[];
  onPick: (s: string) => void;
}

const ICON_MAP = {
  flame: Flame,
  trending: TrendingUp,
  zap: Zap,
  users: Users,
};

export default function SuggestionChips({ label, suggestions, onPick }: Props) {
  return (
    <div className="space-y-3 w-full min-w-0 max-w-full overflow-hidden">
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold px-1">
        {label}
      </p>
      <div className="space-y-2 w-full min-w-0">
        {suggestions.map((s, i) => {
          const item: Suggestion = typeof s === 'string' ? { text: s } : s;
          const IconComp = item.icon ? ICON_MAP[item.icon] : null;

          return (
            <button
              key={item.text}
              onClick={() => onPick(item.text)}
              className="group w-full min-w-0 max-w-full text-left p-3 rounded-2xl bg-card border border-border hover:border-primary/30 hover:bg-primary/[0.03] active:scale-[0.98] transition-all duration-200 text-sm flex items-center justify-between gap-2 overflow-hidden"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {IconComp && (
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <IconComp className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div className="min-w-0">
                  <span className="text-foreground font-medium min-w-0 break-words">{item.text}</span>
                  {item.tag && (
                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full bg-primary/10 text-[9px] font-bold uppercase tracking-wider text-primary align-middle">
                      {item.tag}
                    </span>
                  )}
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
