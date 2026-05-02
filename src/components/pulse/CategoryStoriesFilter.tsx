import { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { VERSA_CATEGORIES, getCategoryIcon, getCategoryColorClass } from '@/lib/categoryMeta';
import { getHiddenCategories, setHiddenCategories } from '@/hooks/useCategoryStories';
import { Label } from '@/components/ui/label';

export default function CategoryStoriesFilter() {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    setHidden(getHiddenCategories());
  }, []);

  const toggle = (cat: string) => {
    const next = new Set(hidden);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    setHidden(next);
    setHiddenCategories(next);
    window.dispatchEvent(new Event('versa-category-filter-changed'));
  };

  const showAll = () => {
    setHidden(new Set());
    setHiddenCategories(new Set());
    window.dispatchEvent(new Event('versa-category-filter-changed'));
  };

  const visibleCount = VERSA_CATEGORIES.length - hidden.size;

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="p-4 flex items-center justify-between border-b border-border">
        <div className="space-y-0.5">
          <Label className="text-base font-medium">Story Categories</Label>
          <p className="text-sm text-muted-foreground">
            {visibleCount}/{VERSA_CATEGORIES.length} visible in stories
          </p>
        </div>
        <button
          onClick={showAll}
          className="text-xs font-medium text-primary active:opacity-70"
        >
          Show all
        </button>
      </div>
      <div className="divide-y divide-border">
        {VERSA_CATEGORIES.map((cat) => {
          const Icon = getCategoryIcon(cat);
          const colorClass = getCategoryColorClass(cat);
          const isVisible = !hidden.has(cat);
          return (
            <button
              key={cat}
              onClick={() => toggle(cat)}
              className="flex items-center gap-3 w-full px-4 py-3 transition-all active:scale-[0.98] hover:bg-muted/50"
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
    </div>
  );
}
