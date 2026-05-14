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
  variant?: 'decide' | 'research';
}

const ICON_MAP = {
  flame: Flame,
  trending: TrendingUp,
  zap: Zap,
  users: Users,
};

export default function SuggestionChips({ label, suggestions, onPick, variant = 'decide' }: Props) {
  const isDecide = variant === 'decide';

  return (
    <div className="space-y-3 w-full min-w-0 max-w-full overflow-hidden">
      <p className={`text-xs uppercase tracking-wider font-semibold px-1 ${
        isDecide ? 'text-primary/70' : 'text-muted-foreground'
      }`}>
        {label}
      </p>
      <div className="space-y-2 w-full min-w-0">
        {suggestions.map((s) => {
          const item: Suggestion = typeof s === 'string' ? { text: s } : s;
          const IconComp = item.icon ? ICON_MAP[item.icon] : null;

          return (
            <button
              key={item.text}
              onClick={() => onPick(item.text)}
              className={`group w-full min-w-0 max-w-full text-left p-3.5 rounded-2xl border active:scale-[0.97] transition-all duration-200 text-sm flex items-center justify-between gap-2 overflow-hidden ${
                isDecide
                  ? 'bg-card border-border/60 hover:border-primary/40 hover:bg-primary/[0.04] shadow-sm hover:shadow-md'
                  : 'bg-card border-border hover:border-blue-200 hover:bg-blue-50/30 shadow-sm'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {IconComp && (
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                    isDecide
                      ? 'bg-primary/10 group-hover:bg-primary/15 transition-colors'
                      : 'bg-blue-50 group-hover:bg-blue-100/60 transition-colors'
                  }`}>
                    <IconComp className={`h-3.5 w-3.5 ${isDecide ? 'text-primary' : 'text-blue-500'}`} />
                  </div>
                )}
                <div className="min-w-0">
                  <span className="text-foreground font-medium min-w-0 break-words leading-snug">{item.text}</span>
                  {item.tag && (
                    <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider align-middle ${
                      isDecide
                        ? 'bg-primary/10 text-primary'
                        : 'bg-blue-50 text-blue-500'
                    }`}>
                      {item.tag}
                    </span>
                  )}
                </div>
              </div>
              <ArrowRight className={`h-4 w-4 group-hover:translate-x-0.5 transition-all shrink-0 ${
                isDecide ? 'text-muted-foreground group-hover:text-primary' : 'text-muted-foreground group-hover:text-blue-500'
              }`} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
