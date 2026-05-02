import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { VERSA_CATEGORIES, getCategoryIcon, getCategoryColorClass } from '@/lib/categoryMeta';
import { getHiddenCategories, setHiddenCategories } from '@/hooks/useCategoryStories';
import { SlidersHorizontal } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export default function CategoryStoriesFilter({ open, onOpenChange, onUpdate }: Props) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) setHidden(getHiddenCategories());
  }, [open]);

  const toggle = (cat: string) => {
    const next = new Set(hidden);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    setHidden(next);
    setHiddenCategories(next);
    onUpdate();
  };

  const showAll = () => {
    setHidden(new Set());
    setHiddenCategories(new Set());
    onUpdate();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[70vh] overflow-y-auto">
        <SheetHeader className="mb-3">
          <SheetTitle className="text-left flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Story Categories
          </SheetTitle>
          <p className="text-xs text-muted-foreground text-left">Choose which categories appear in your stories</p>
        </SheetHeader>

        <button
          onClick={showAll}
          className="text-xs font-medium text-primary mb-3 active:opacity-70"
        >
          Show all
        </button>

        <div className="space-y-1 pb-6">
          {VERSA_CATEGORIES.map((cat) => {
            const Icon = getCategoryIcon(cat);
            const colorClass = getCategoryColorClass(cat);
            const isVisible = !hidden.has(cat);
            return (
              <button
                key={cat}
                onClick={() => toggle(cat)}
                className="flex items-center gap-3 w-full rounded-xl px-3 py-2.5 transition-all active:scale-[0.98] hover:bg-muted/50"
              >
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${colorClass}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="text-sm font-medium text-foreground flex-1 text-left">{cat}</span>
                <Checkbox checked={isVisible} />
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
