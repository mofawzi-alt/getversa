import { motion } from 'framer-motion';
import { LayoutGrid, Sparkles } from 'lucide-react';
import { useCategoryStories } from '@/hooks/useCategoryStories';
import { getCategoryIcon } from '@/lib/categoryMeta';
import { getPollDisplayImageSrc } from '@/lib/pollImages';

interface CategoryStoryCirclesProps {
  active: string | null;
  onSelect: (category: string | null) => void;
  /** Opens the full categories sheet; renders an "All" circle at the end. */
  onOpenAll?: () => void;
}

/**
 * Round category thumbnails (story-style) showing each category's
 * top poll of the day. Tapping filters the Home feed to that category.
 */
export default function CategoryStoryCircles({ active, onSelect, onOpenAll }: CategoryStoryCirclesProps) {
  const { data: stories = [] } = useCategoryStories();


  return (
    <div className="flex gap-3 overflow-x-auto px-3 pb-2 scrollbar-hide">
      {/* For you — clears the category filter */}
      <button
        onClick={() => onSelect(null)}
        className="flex flex-col items-center gap-1 shrink-0 w-[68px]"
      >
        <div
          className={`w-16 h-16 rounded-full p-[2px] ${
            !active
              ? 'bg-gradient-to-tr from-primary via-primary/70 to-primary/30'
              : 'bg-primary'
          }`}
        >
          <div
            className={`w-full h-full rounded-full overflow-hidden border-2 border-background flex items-center justify-center ${
              !active
                ? 'bg-gradient-to-br from-primary/15 via-background to-background'
                : 'bg-background'
            }`}
          >
            <Sparkles
              className={`h-5 w-5 ${!active ? 'text-primary' : 'text-primary'}`}
              fill="currentColor"
              fillOpacity={!active ? 0.15 : 0}
            />
          </div>
        </div>
        <span className="text-[9px] font-semibold text-foreground text-center leading-tight">For you</span>
      </button>

      {stories.map((s, i) => {
        const img =
          getPollDisplayImageSrc({ imageUrl: s.poll.image_a_url, option: s.poll.option_a, question: s.poll.question, side: 'A' }) ||
          getPollDisplayImageSrc({ imageUrl: s.poll.image_b_url, option: s.poll.option_b, question: s.poll.question, side: 'B' });
        const Icon = getCategoryIcon(s.category);
        const isActive = active === s.category;

        return (
          <motion.button
            key={s.category}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            onClick={() => onSelect(isActive ? null : s.category)}
            className="flex flex-col items-center gap-1 shrink-0 w-[68px]"
          >
            <div
              className={`w-16 h-16 rounded-full p-[2px] ${
                isActive
                  ? 'bg-primary'
                  : 'bg-gradient-to-tr from-primary via-primary/70 to-primary/30'
              }`}
            >
              <div className="w-full h-full rounded-full overflow-hidden border-2 border-background bg-muted flex items-center justify-center">
                {img ? (
                  <img src={img} alt={s.category} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                ) : (
                  <Icon className="h-5 w-5 text-primary/70" />
                )}
              </div>
            </div>
            <span className="text-[9px] font-semibold text-foreground text-center leading-tight line-clamp-2">
              {s.category}
            </span>
          </motion.button>
        );
      })}

      {/* All — opens the full categories sheet */}
      {onOpenAll && (
        <button
          onClick={onOpenAll}
          className="flex flex-col items-center gap-1 shrink-0 w-[68px]"
        >
          <div className="w-16 h-16 rounded-full p-[2px] bg-border">
            <div className="w-full h-full rounded-full border-2 border-background bg-muted flex items-center justify-center">
              <LayoutGrid className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
          <span className="text-[9px] font-semibold text-foreground text-center leading-tight">All</span>
        </button>
      )}
    </div>
  );
}
