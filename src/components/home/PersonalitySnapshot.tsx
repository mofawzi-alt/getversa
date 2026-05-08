import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { computePersonalityType } from '@/lib/personalityType';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

/* ── Unique gradient per personality code ── */
const TYPE_GRADIENTS: Record<string, string> = {
  INTJ: 'from-slate-900 via-indigo-900 to-slate-800',
  INTP: 'from-cyan-900 via-teal-800 to-slate-900',
  ENTJ: 'from-amber-900 via-orange-800 to-red-900',
  ENTP: 'from-violet-900 via-purple-800 to-fuchsia-900',
  INFJ: 'from-indigo-900 via-purple-900 to-blue-900',
  INFP: 'from-rose-900 via-pink-800 to-purple-900',
  ENFJ: 'from-emerald-900 via-teal-800 to-cyan-900',
  ENFP: 'from-orange-800 via-amber-700 to-yellow-800',
  ISTJ: 'from-zinc-900 via-stone-800 to-neutral-900',
  ISFJ: 'from-green-900 via-emerald-800 to-teal-900',
  ESTJ: 'from-blue-900 via-slate-800 to-indigo-900',
  ESFJ: 'from-pink-900 via-rose-800 to-red-900',
  ISTP: 'from-gray-900 via-zinc-800 to-slate-900',
  ISFP: 'from-fuchsia-900 via-pink-800 to-rose-900',
  ESTP: 'from-red-900 via-orange-800 to-amber-900',
  ESFP: 'from-yellow-800 via-orange-700 to-pink-800',
};

const TYPE_ACCENTS: Record<string, string> = {
  INTJ: 'rgba(99,102,241,0.3)',
  INTP: 'rgba(6,182,212,0.3)',
  ENTJ: 'rgba(245,158,11,0.3)',
  ENTP: 'rgba(168,85,247,0.3)',
  INFJ: 'rgba(129,140,248,0.3)',
  INFP: 'rgba(244,114,182,0.3)',
  ENFJ: 'rgba(52,211,153,0.3)',
  ENFP: 'rgba(251,191,36,0.3)',
  ISTJ: 'rgba(161,161,170,0.3)',
  ISFJ: 'rgba(74,222,128,0.3)',
  ESTJ: 'rgba(59,130,246,0.3)',
  ESFJ: 'rgba(251,113,133,0.3)',
  ISTP: 'rgba(148,163,184,0.3)',
  ISFP: 'rgba(217,70,239,0.3)',
  ESTP: 'rgba(239,68,68,0.3)',
  ESFP: 'rgba(253,224,71,0.3)',
};

export default function PersonalitySnapshot() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const MIN_VOTES = 30;

  const { data: voteCount = 0 } = useQuery({
    queryKey: ['personality-vote-count', user?.id],
    queryFn: async () => {
      const { count } = await supabase.from('votes').select('id', { count: 'exact' }).eq('user_id', user!.id);
      return count || 0;
    },
    enabled: !!user,
  });

  const { data: traits = [] } = useQuery({
    queryKey: ['personality-traits', user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_user_voting_traits', { p_user_id: user!.id });
      return (data || []) as { tag: string; vote_count: number }[];
    },
    enabled: !!user,
  });

  if (!user) return null;

  const result = computePersonalityType(traits, voteCount, user.id);
  const progress = Math.min((voteCount / MIN_VOTES) * 100, 100);
  const gradientClass = result.ready ? (TYPE_GRADIENTS[result.code] || TYPE_GRADIENTS.INTJ) : '';
  const accentColor = result.ready ? (TYPE_ACCENTS[result.code] || TYPE_ACCENTS.INTJ) : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => navigate('/personality')}
      className="relative rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
    >
      {result.ready ? (
        <div className={`relative bg-gradient-to-br ${gradientClass} px-5 py-5`}>
          {/* Glow accent */}
          <div
            className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-8 -mt-8"
            style={{ background: accentColor }}
          />
          <div
            className="absolute bottom-0 left-0 w-24 h-24 rounded-full blur-2xl -ml-6 -mb-6"
            style={{ background: accentColor }}
          />

          <div className="flex items-center gap-3.5 relative z-10">
            <motion.div
              className="h-14 w-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10"
              initial={{ scale: 0.5, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', damping: 10 }}
            >
              <span className="text-3xl">{result.emoji}</span>
            </motion.div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Sparkles className="w-3 h-3 text-white/50" />
                <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Your Type</p>
              </div>
              <p className="text-xl font-display font-extrabold text-white leading-tight tracking-tight">{result.name}</p>
              {result.description && (
                <p className="text-[11px] text-white/60 mt-1 leading-snug line-clamp-2">{result.description}</p>
              )}
            </div>
            <ChevronRight className="h-5 w-5 text-white/40 shrink-0" />
          </div>

          {/* Strengths chips */}
          {result.strengths.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3 relative z-10">
              {result.strengths.slice(0, 3).map((s) => (
                <span
                  key={s}
                  className="px-2.5 py-1 rounded-full bg-white/10 text-[9px] font-bold text-white/70 uppercase tracking-wider border border-white/5"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="relative border border-border bg-card px-5 py-5 rounded-2xl">
          <div className="flex items-center gap-3.5">
            <motion.div
              className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
            >
              <span className="text-2xl">🧬</span>
            </motion.div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Personality Type</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                {voteCount < MIN_VOTES
                  ? `${MIN_VOTES - voteCount} more votes to unlock`
                  : 'Calculating your type...'}
              </p>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden mt-2 max-w-[200px]">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{voteCount}/{MIN_VOTES} votes</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </div>
      )}
    </motion.div>
  );
}
