import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

const FEATURED_QUESTIONS = [
  'Who rules Egyptian street food — Koshary or Shawarma?',
  'iPhone or Samsung — which does Egypt really prefer?',
  'Costa or Cilantro — where do students actually study?',
  'Is TikTok or Instagram winning with Gen Z in Egypt?',
  'Vodafone or Orange — who has the better deal?',
  'Ahly or Zamalek — the eternal debate settled',
  'Online shopping vs mall trips — how is Egypt buying?',
  'Cash or InstaPay — how do young Egyptians pay?',
  'Gym or outdoor running — what\'s the fitness vibe?',
  'Morning person or night owl — what does your city say?',
  'Talabat or Elmenus — who delivers better?',
  'Working from home or office — what does Cairo prefer?',
  'Gold or crypto — where is Gen Z investing?',
  'Pepsi or Coca-Cola — Egypt\'s real answer',
];

export default function DailyFeaturedQuestion() {
  const navigate = useNavigate();

  // Pick question based on day of year for consistency
  const question = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return FEATURED_QUESTIONS[dayOfYear % FEATURED_QUESTIONS.length];
  }, []);

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      onClick={() => navigate('/ask', { state: { prefill: question } })}
      className="w-full rounded-2xl bg-gradient-to-r from-primary/8 via-primary/5 to-transparent border border-primary/15 p-3.5 flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
    >
      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Sparkles className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-primary/70 mb-0.5">
          Today's question
        </p>
        <p className="text-[13px] font-bold text-foreground leading-snug line-clamp-2">
          {question}
        </p>
      </div>
      <ArrowRight className="h-4 w-4 text-primary shrink-0" />
    </motion.button>
  );
}
