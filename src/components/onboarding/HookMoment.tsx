import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

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
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-8"
      style={{ backgroundColor: '#111111' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="flex flex-col items-center gap-4 max-w-sm text-center"
      >
        <h1 className="text-4xl font-display font-bold text-white">
          You get it 🔥
        </h1>

        <p className="text-sm leading-relaxed" style={{ color: '#888' }}>
          Sign up free to vote on what actually matters
        </p>

        <Button
          onClick={onJoin}
          className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground text-base font-display font-bold rounded-2xl mt-4"
        >
          Join Versa — it's free
        </Button>

        <p className="text-xs" style={{ color: '#555' }}>
          Takes 30 seconds
        </p>
      </motion.div>
    </motion.div>
  );
}
