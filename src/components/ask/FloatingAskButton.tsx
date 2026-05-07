import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';

export default function FloatingAskButton() {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!user) return null;

  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 1, type: 'spring', stiffness: 260, damping: 20 }}
      onClick={() => navigate('/ask')}
      className="fixed z-[60] right-4 flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-foreground text-background shadow-lg active:scale-95 transition-transform"
      style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
      aria-label="Ask Versa"
    >
      <Sparkles className="h-4 w-4" />
      <span className="text-[13px] font-bold">Ask</span>
    </motion.button>
  );
}
