import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight } from 'lucide-react';

interface HookMomentProps {
  onJoin: () => void;
}

export default function HookMoment({ onJoin }: HookMomentProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-8 bg-white"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="flex flex-col items-center gap-5 max-w-sm text-center"
      >
        {/* Animated icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.3 }}
          className="w-20 h-20 rounded-3xl bg-accent/10 flex items-center justify-center"
        >
          <Sparkles className="h-10 w-10 text-accent" />
        </motion.div>

        <div className="space-y-2">
          <h1 className="text-3xl font-display font-bold text-foreground">
            Nice taste! 🔥
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Sign up to save your votes, see your personality type, and unlock unlimited polls.
          </p>
        </div>

        {/* Quick highlights */}
        <div className="w-full flex flex-col gap-2 mt-2">
          {['Your personality revealed', 'Unlimited voting', 'See how Egypt votes'].map((item, i) => (
            <motion.div
              key={item}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              className="flex items-center gap-3 bg-secondary/50 rounded-xl px-4 py-2.5"
            >
              <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                <div className="w-2 h-2 rounded-full bg-accent" />
              </div>
              <span className="text-sm font-medium text-foreground">{item}</span>
            </motion.div>
          ))}
        </div>

        <Button
          onClick={onJoin}
          className="w-full h-14 bg-accent hover:bg-accent/90 text-accent-foreground text-base font-display font-bold rounded-2xl mt-2"
        >
          Join Versa — it's free
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>

        <p className="text-xs text-muted-foreground">
          Takes 30 seconds
        </p>
      </motion.div>
    </motion.div>
  );
}
