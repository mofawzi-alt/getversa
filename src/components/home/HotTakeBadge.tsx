import { motion } from 'framer-motion';
import { Flame } from 'lucide-react';

/** Visual badge for the daily "Hot Take" surprise poll */
export default function HotTakeBadge() {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="absolute top-3 left-3 z-20 flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-[hsl(15,90%,55%)] to-[hsl(35,95%,50%)] shadow-lg"
    >
      <Flame className="w-3.5 h-3.5 text-white" fill="white" />
      <span className="text-[10px] font-extrabold text-white tracking-wide uppercase">Hot Take</span>
    </motion.div>
  );
}
