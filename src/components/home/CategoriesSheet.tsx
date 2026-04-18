import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { VERSA_CATEGORIES, getCategoryIcon, getCategoryColorClass } from '@/lib/categoryMeta';

interface CategoriesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (category: string) => void;
  activeCategory?: string | null;
}

export default function CategoriesSheet({ open, onOpenChange, onSelect, activeCategory }: CategoriesSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[80vh] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-left">Browse by category</SheetTitle>
          <p className="text-xs text-muted-foreground text-left">Pick a category to filter the feed</p>
        </SheetHeader>
        <div className="grid grid-cols-2 gap-2 pb-6">
          {VERSA_CATEGORIES.map((cat) => {
            const Icon = getCategoryIcon(cat);
            const colorClass = getCategoryColorClass(cat);
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => {
                  onSelect(cat);
                  onOpenChange(false);
                }}
                className={`flex items-center gap-2.5 rounded-2xl border px-3 py-3 text-left transition-all active:scale-[0.98] ${
                  isActive ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/50'
                }`}
              >
                <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${colorClass}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold text-foreground leading-tight">{cat}</span>
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
