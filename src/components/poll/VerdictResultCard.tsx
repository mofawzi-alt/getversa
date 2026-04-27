import { motion } from 'framer-motion';
import { ArrowRight, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPollDisplayImageSrc } from '@/lib/pollImages';

interface Poll {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  image_a_url: string | null;
  image_b_url: string | null;
}

interface Props {
  poll: Poll;
  myChoice: 'A' | 'B';
  percentA: number;
  percentB: number;
  totalVotes: number;
  onNext?: () => void;
  onClose: () => void;
  hasMore?: boolean;
}

/**
 * Compact, share-style verdict card. Used when an already-voted poll
 * is opened from Ask Versa perspectives — keeps the user in a clean
 * "result" frame (no full-screen swipe overlay).
 */
export default function VerdictResultCard({
  poll,
  myChoice,
  percentA,
  percentB,
  totalVotes,
  onNext,
  onClose,
  hasMore,
}: Props) {
  const userPercent = myChoice === 'A' ? percentA : percentB;
  const winnerIsA = percentA >= percentB;
  const imgA = getPollDisplayImageSrc({ imageUrl: poll.image_a_url, option: poll.option_a, question: poll.question, side: 'A' });
  const imgB = getPollDisplayImageSrc({ imageUrl: poll.image_b_url, option: poll.option_b, question: poll.question, side: 'B' });

  return (
    <div className="fixed inset-0 z-[100] min-h-screen flex flex-col items-center justify-center bg-[#0F172A] px-5 py-8">
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-[max(env(safe-area-inset-top,12px),12px)] left-4 w-9 h-9 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center"
      >
        <X className="h-4 w-4 text-white" />
      </button>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="rounded-3xl bg-white shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <span className="text-[10px] font-bold tracking-[0.25em] text-gray-900">VERSA</span>
            <span className="text-[10px] font-semibold tracking-wider uppercase text-gray-400">Result</span>
          </div>

          <div className="px-5 pb-4">
            <h2 className="text-base font-bold text-gray-900 leading-snug">{poll.question}</h2>
          </div>

          <div className="grid grid-cols-2 gap-1 px-1">
            {(['A', 'B'] as const).map((side) => {
              const isMine = myChoice === side;
              const isWinner = side === 'A' ? winnerIsA : !winnerIsA;
              const pct = side === 'A' ? percentA : percentB;
              const label = side === 'A' ? poll.option_a : poll.option_b;
              const img = side === 'A' ? imgA : imgB;
              return (
                <div key={side} className="relative aspect-[4/5] rounded-2xl overflow-hidden">
                  <img src={img} alt={label} className="w-full h-full object-cover" />
                  {isMine && <div className="absolute inset-0 ring-4 ring-inset ring-[#2563EB] rounded-2xl pointer-events-none" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  {isMine && (
                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-[#2563EB] text-white text-[10px] font-bold px-2 py-1 rounded-full">
                      <Check className="h-3 w-3" /> YOUR PICK
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-white text-[11px] font-semibold leading-tight line-clamp-2 mb-1">{label}</p>
                    <span className={`text-2xl font-black ${isWinner ? 'text-white' : 'text-white/70'}`}>{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-5 py-5 text-center">
            <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-1">You're with</p>
            <p className="text-4xl font-black text-gray-900 leading-none">
              {userPercent}<span className="text-2xl">%</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">of {totalVotes.toLocaleString()} voters</p>
          </div>

          <div className="px-5 pb-5 flex flex-col gap-2">
            {hasMore && onNext ? (
              <Button
                onClick={onNext}
                className="w-full h-12 rounded-2xl font-bold gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
              >
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={onClose}
                className="w-full h-12 rounded-2xl font-bold gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
              >
                Done
              </Button>
            )}
          </div>
        </div>

        <p className="text-center text-[10px] tracking-widest uppercase text-white/30 mt-4 font-semibold">
          getversa.app
        </p>
      </motion.div>
    </div>
  );
}
