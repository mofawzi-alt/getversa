import { useNavigate } from 'react-router-dom';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function DecisionHelper() {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      onClick={() => navigate('/browse')}
      className="rounded-xl border border-border bg-card px-3 py-2 cursor-pointer active:scale-[0.98] transition-transform"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
          <ShoppingBag className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-display font-bold text-foreground">Not sure what to pick?</p>
          <p className="text-xs text-muted-foreground mt-0.5">See real votes from people like you before you decide</p>
        </div>
        <div className="flex items-center gap-1 text-primary shrink-0">
          <span className="text-xs font-bold">Explore</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </motion.div>
  );
}
