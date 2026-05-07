import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  question: string;
  optionA: string;
  optionB: string;
  percentA: number;
  percentB: number;
  visible: boolean;
  onDismiss: () => void;
}

function buildAskPrompt(question: string, optionA: string, optionB: string, percentA: number, percentB: number): string {
  const winner = percentA >= percentB ? optionA : optionB;
  const winnerPct = Math.max(percentA, percentB);
  
  const prompts = [
    `Why do ${winnerPct}% prefer ${winner}?`,
    `${winner} vs ${percentA >= percentB ? optionB : optionA} — why?`,
    `What makes ${winner} so popular?`,
  ];
  return prompts[Math.floor(Math.random() * prompts.length)];
}

const NUDGE_SHOWN_KEY = 'versa_ask_nudge_count';
const MAX_NUDGES_PER_DAY = 3;

function canShowNudge(): boolean {
  try {
    const stored = localStorage.getItem(NUDGE_SHOWN_KEY);
    if (!stored) return true;
    const { count, date } = JSON.parse(stored);
    const today = new Date().toDateString();
    if (date !== today) return true;
    return count < MAX_NUDGES_PER_DAY;
  } catch { return true; }
}

function incrementNudgeCount() {
  try {
    const today = new Date().toDateString();
    const stored = localStorage.getItem(NUDGE_SHOWN_KEY);
    let count = 1;
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.date === today) count = (parsed.count || 0) + 1;
    }
    localStorage.setItem(NUDGE_SHOWN_KEY, JSON.stringify({ count, date: today }));
  } catch {}
}

export default function PostVoteAskNudge({ question, optionA, optionB, percentA, percentB, visible, onDismiss }: Props) {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const askPrompt = buildAskPrompt(question, optionA, optionB, percentA, percentB);

  useEffect(() => {
    if (!visible || !canShowNudge()) return;
    // Show nudge 2.5s after vote result appears
    const timer = setTimeout(() => setShow(true), 2500);
    return () => clearTimeout(timer);
  }, [visible]);

  useEffect(() => {
    if (!show) return;
    incrementNudgeCount();
    // Auto-dismiss after 6s
    const timer = setTimeout(() => { setShow(false); onDismiss(); }, 6000);
    return () => clearTimeout(timer);
  }, [show, onDismiss]);

  const handleTap = () => {
    setShow(false);
    onDismiss();
    navigate('/ask', { state: { prefill: askPrompt } });
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="absolute bottom-3 left-3 right-3 z-40"
        >
          <button
            onClick={handleTap}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-foreground/95 backdrop-blur-md shadow-xl text-left"
          >
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-background/60 uppercase tracking-wider">Ask Versa</p>
              <p className="text-[13px] font-bold text-background truncate">{askPrompt}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setShow(false); onDismiss(); }}
              className="p-1 rounded-full hover:bg-background/10 shrink-0"
            >
              <X className="h-3.5 w-3.5 text-background/50" />
            </button>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
