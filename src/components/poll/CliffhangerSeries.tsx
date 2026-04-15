import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link2, ChevronRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { getPollDisplayImageSrc } from '@/lib/pollImages';

interface SeriesPoll {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  image_a_url: string | null;
  series_order: number;
  series_title: string;
  is_active: boolean;
}

interface CliffhangerSeriesProps {
  currentPollId?: string;
  onPollTap: (pollId: string) => void;
}

export default function CliffhangerSeries({ currentPollId, onPollTap }: CliffhangerSeriesProps) {
  // Find current poll's series
  const { data: seriesData } = useQuery({
    queryKey: ['cliffhanger-series', currentPollId],
    queryFn: async () => {
      if (!currentPollId) return null;

      // Get current poll's series_id
      const { data: currentPoll } = await supabase
        .from('polls')
        .select('series_id, series_title, series_order')
        .eq('id', currentPollId)
        .single();

      if (!currentPoll?.series_id) return null;

      // Get all polls in this series
      const { data: seriesPolls } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, image_a_url, series_order, series_title, is_active')
        .eq('series_id', currentPoll.series_id)
        .order('series_order', { ascending: true });

      if (!seriesPolls?.length) return null;

      return {
        title: currentPoll.series_title || 'Poll Series',
        polls: seriesPolls as SeriesPoll[],
        currentOrder: currentPoll.series_order || 1,
      };
    },
    enabled: !!currentPollId,
    staleTime: 1000 * 60 * 5,
  });

  if (!seriesData || seriesData.polls.length <= 1) return null;

  const currentIdx = seriesData.polls.findIndex(p => p.id === currentPollId);
  const nextPoll = seriesData.polls[currentIdx + 1];
  const totalParts = seriesData.polls.length;
  const currentPart = (currentIdx >= 0 ? currentIdx : 0) + 1;

  return (
    <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20">
      <div className="flex items-center gap-2 mb-2">
        <Link2 className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-bold text-foreground">{seriesData.title}</span>
        <span className="text-[10px] text-muted-foreground ml-auto">
          Part {currentPart} of {totalParts}
        </span>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1.5 mb-2">
        {seriesData.polls.map((p, i) => (
          <motion.button
            key={p.id}
            onClick={() => p.is_active && onPollTap(p.id)}
            className={`h-1.5 rounded-full transition-all ${
              i === currentIdx
                ? 'bg-primary w-6'
                : i < currentIdx
                ? 'bg-primary/40 w-3'
                : 'bg-muted w-3'
            } ${p.is_active ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
            whileTap={p.is_active ? { scale: 0.9 } : undefined}
          />
        ))}
      </div>

      {/* Next part teaser */}
      {nextPoll && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-2 p-2 rounded-lg ${
            nextPoll.is_active
              ? 'bg-card cursor-pointer hover:bg-muted/50'
              : 'bg-muted/30'
          }`}
          onClick={() => nextPoll.is_active && onPollTap(nextPoll.id)}
        >
          {nextPoll.image_a_url && (
            <img
              src={getPollDisplayImageSrc({ imageUrl: nextPoll.image_a_url, option: nextPoll.option_a, side: 'A' })}
              className="w-8 h-8 rounded-lg object-cover shrink-0"
              alt=""
            />
          )}
          <div className="flex-1 min-w-0">
            {nextPoll.is_active ? (
              <>
                <p className="text-[10px] font-bold text-primary">Part {currentPart + 1} is live!</p>
                <p className="text-[9px] text-muted-foreground truncate">{nextPoll.question}</p>
              </>
            ) : (
              <>
                <p className="text-[10px] font-bold text-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-primary" />
                  Part {currentPart + 1} drops tomorrow
                </p>
                <p className="text-[9px] text-muted-foreground">Stay tuned...</p>
              </>
            )}
          </div>
          {nextPoll.is_active && <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0" />}
        </motion.div>
      )}
    </div>
  );
}
