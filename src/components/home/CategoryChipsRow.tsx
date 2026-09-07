import { VERSA_CATEGORIES, getCategoryIcon, getCategoryColorClass } from '@/lib/categoryMeta';
import { LayoutGrid, Sparkles } from 'lucide-react';

interface CategoryChipsRowProps {
  active: string | null;
  onSelect: (category: string | null) => void;
  onOpenAll?: () => void;
}

/**
 * Thin scrollable chip row under the Home header.
 * Tapping a chip filters the Home feed to that category.
 */
export default function CategoryChipsRow({ active, onSelect, onOpenAll }: CategoryChipsRowProps) {
  return (
    <div className="flex gap-2 overflow-x-auto px-3 pb-2 scrollbar-hide">
      <button
        onClick={() => onSelect(null)}
        className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold transition active:scale-[0.97] ${
          !active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground'
        }`}
      >
        <Sparkles className="h-3 w-3" />
        For you
      </button>

      {VERSA_CATEGORIES.map((cat) => {
        const Icon = getCategoryIcon(cat);
        const isActive = active === cat;
        return (
          <button
            key={cat}
            onClick={() => onSelect(isActive ? null : cat)}
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border pl-1 pr-3 py-1 text-[12px] font-semibold whitespace-nowrap transition active:scale-[0.97] ${
              isActive ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground'
            }`}
          >
            <span
              className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${
                isActive ? 'bg-primary-foreground/20 text-primary-foreground' : getCategoryColorClass(cat)
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            {cat}
          </button>
        );
      })}


      {onOpenAll && (
        <button
          onClick={onOpenAll}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-[12px] font-semibold text-muted-foreground transition active:scale-[0.97]"
        >
          <LayoutGrid className="h-3 w-3" />
          All
        </button>
      )}
    </div>
  );
}
