import { useState, useRef } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { Check } from 'lucide-react';

import catImg from '@/assets/trial/cat.jpg';
import dogImg from '@/assets/trial/dog.jpg';
import pizzaImg from '@/assets/trial/pizza.jpg';
import sushiImg from '@/assets/trial/sushi.jpg';
import teaImg from '@/assets/trial/tea.jpg';
import coffeeImg from '@/assets/trial/coffee.jpg';

interface TrialPoll {
  question: string;
  optionA: string;
  optionB: string;
  imageA: string;
  imageB: string;
}

const TRIAL_POLLS: TrialPoll[] = [
  { question: 'Cat or dog?', optionA: 'Cat', optionB: 'Dog', imageA: catImg, imageB: dogImg },
  { question: 'Pizza or sushi?', optionA: 'Pizza', optionB: 'Sushi', imageA: pizzaImg, imageB: sushiImg },
  { question: 'Tea or coffee?', optionA: 'Tea', optionB: 'Coffee', imageA: teaImg, imageB: coffeeImg },
];

function generateFakeResult(): { percentA: number; percentB: number } {
  const a = Math.floor(Math.random() * 30) + 35; // 35-64
  return { percentA: a, percentB: 100 - a };
}

interface TrialPollsProps {
  onComplete: () => void;
}

export default function TrialPolls({ onComplete }: TrialPollsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [voted, setVoted] = useState<'A' | 'B' | null>(null);
  const [result, setResult] = useState<{ percentA: number; percentB: number } | null>(null);
  const [exiting, setExiting] = useState(false);
  const constraintsRef = useRef<HTMLDivElement>(null);

  const poll = TRIAL_POLLS[currentIndex];

  const handleVote = (choice: 'A' | 'B') => {
    if (voted || exiting) return;
    setVoted(choice);
    setResult(generateFakeResult());

    // Auto-advance after showing result
    setTimeout(() => {
      setExiting(true);
      setTimeout(() => {
        if (currentIndex < TRIAL_POLLS.length - 1) {
          setCurrentIndex(prev => prev + 1);
          setVoted(null);
          setResult(null);
          setExiting(false);
        } else {
          onComplete();
        }
      }, 400);
    }, 1800);
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (voted) return;
    const threshold = 60;
    if (info.offset.x < -threshold) {
      handleVote('A');
    } else if (info.offset.x > threshold) {
      handleVote('B');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-[100] flex flex-col"
      style={{ backgroundColor: '#111111' }}
    >
      {/* Progress indicator */}
      <div className="pt-14 pb-3 flex justify-center gap-2 items-center">
        <span className="text-xs font-medium" style={{ color: '#888' }}>
          {currentIndex + 1} of 3
        </span>
      </div>

      {/* Poll card */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: exiting ? 0 : 1, scale: exiting ? 0.95 : 1 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-sm"
          >
            {/* Question */}
            <h2 className="text-center text-xl font-bold text-white mb-4 font-display">
              {poll.question}
            </h2>

            {/* Images side by side */}
            <motion.div
              ref={constraintsRef}
              drag={!voted ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.3}
              onDragEnd={handleDragEnd}
              className="relative rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing"
              style={{ aspectRatio: '16/9' }}
            >
              <div className="absolute inset-0 flex">
                {/* Option A */}
                <div
                  className="relative w-1/2 h-full overflow-hidden cursor-pointer"
                  onClick={() => handleVote('A')}
                >
                  <img
                    src={poll.imageA}
                    alt={poll.optionA}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                  {/* Dark gradient overlay at bottom */}
                  <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />
                  {/* Label */}
                  <div className="absolute bottom-3 left-0 right-0 text-center">
                    <span className="text-white font-bold text-sm drop-shadow-lg">
                      {poll.optionA}
                    </span>
                  </div>
                  {/* Vote result overlay */}
                  {voted && result && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 flex flex-col items-center justify-center"
                      style={{ backgroundColor: voted === 'A' ? 'rgba(59,130,246,0.5)' : 'rgba(0,0,0,0.4)' }}
                    >
                      {voted === 'A' && (
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center mb-1">
                          <Check className="w-5 h-5 text-blue-600" />
                        </div>
                      )}
                      <span className="text-white text-2xl font-bold drop-shadow-lg">
                        {result.percentA}%
                      </span>
                      {voted === 'A' && (
                        <span className="text-white/80 text-xs mt-0.5">Your choice</span>
                      )}
                    </motion.div>
                  )}
                </div>

                {/* Divider */}
                <div className="absolute inset-y-0 left-1/2 w-[2px] bg-white/20 z-10" />

                {/* Option B */}
                <div
                  className="relative w-1/2 h-full overflow-hidden cursor-pointer"
                  onClick={() => handleVote('B')}
                >
                  <img
                    src={poll.imageB}
                    alt={poll.optionB}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                  <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />
                  <div className="absolute bottom-3 left-0 right-0 text-center">
                    <span className="text-white font-bold text-sm drop-shadow-lg">
                      {poll.optionB}
                    </span>
                  </div>
                  {voted && result && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 flex flex-col items-center justify-center"
                      style={{ backgroundColor: voted === 'B' ? 'rgba(59,130,246,0.5)' : 'rgba(0,0,0,0.4)' }}
                    >
                      {voted === 'B' && (
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center mb-1">
                          <Check className="w-5 h-5 text-blue-600" />
                        </div>
                      )}
                      <span className="text-white text-2xl font-bold drop-shadow-lg">
                        {result.percentB}%
                      </span>
                      {voted === 'B' && (
                        <span className="text-white/80 text-xs mt-0.5">Your choice</span>
                      )}
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Swipe hint */}
            {!voted && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-center text-xs mt-4"
                style={{ color: '#555' }}
              >
                Tap or swipe to choose
              </motion.p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress dots */}
      <div className="pb-10 flex justify-center gap-2">
        {TRIAL_POLLS.map((_, i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full transition-colors duration-300"
            style={{
              backgroundColor: i <= currentIndex ? '#fff' : 'rgba(255,255,255,0.25)',
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}
