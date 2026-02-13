import { motion } from 'framer-motion';
import { Radio } from 'lucide-react';

interface LiveIndicatorProps {
  variant?: 'badge' | 'inline' | 'overlay';
  className?: string;
}

export default function LiveIndicator({ variant = 'inline', className = '' }: LiveIndicatorProps) {
  if (variant === 'badge') {
    return (
      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/20 text-destructive ${className}`}>
        <motion.div animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
          <Radio className="h-2.5 w-2.5" />
        </motion.div>
        <span className="text-[10px] font-bold uppercase">Live</span>
      </div>
    );
  }

  if (variant === 'overlay') {
    return (
      <span className={`flex items-center gap-0.5 text-[8px] font-bold text-white/90 drop-shadow-lg ${className}`}>
        <motion.div animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
          <Radio className="h-2.5 w-2.5 text-destructive" />
        </motion.div>
        LIVE
      </span>
    );
  }

  // inline (default)
  return (
    <span className={`flex items-center gap-0.5 text-[8px] font-bold text-destructive ${className}`}>
      <motion.div animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
        <Radio className="h-2.5 w-2.5" />
      </motion.div>
      LIVE
    </span>
  );
}
