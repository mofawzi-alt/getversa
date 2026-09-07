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

  if (stories.length === 0) return null;

  return (
    <div className="flex gap-3 overflow-x-auto px-3 pb-2 scrollbar-hide">
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
    </div>
  );
}
