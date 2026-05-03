import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { PERSONALITY_TYPES, computePersonalityType } from '@/lib/personalityType';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PersonalityRevealScreenProps {
  onComplete: () => void;
}

export default function PersonalityRevealScreen({ onComplete }: PersonalityRevealScreenProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<'building' | 'reveal' | 'done'>('building');
  const [personalityCode, setPersonalityCode] = useState<string | null>(null);

  useEffect(() => {
    async function fetchType() {
      if (!user) {
        setPersonalityCode('ENFP'); // fallback
        return;
      }
      // Fetch user's trait entries from their votes
      const { data: traits } = await supabase
        .from('user_dimension_scores')
        .select('dimension_id, score')
        .eq('user_id', user.id);

      // Also try to get personality from the scoring function
      const { data: tagData } = await supabase
        .from('votes')
        .select('poll_id, choice')
        .eq('user_id', user.id)
        .limit(10);

      if (tagData && tagData.length > 0) {
        // Get poll tags for voted polls
        const pollIds = tagData.map(v => v.poll_id);
        const { data: pollsData } = await supabase
          .from('polls')
          .select('id, option_a_tag, option_b_tag')
          .in('id', pollIds);

        if (pollsData) {
          // Build trait entries from votes
          const traitMap = new Map<string, number>();
          tagData.forEach(vote => {
            const poll = pollsData.find(p => p.id === vote.poll_id);
            if (!poll) return;
            const tag = vote.choice === 'A' ? poll.option_a_tag : poll.option_b_tag;
            if (tag) {
              traitMap.set(tag, (traitMap.get(tag) || 0) + 1);
            }
          });

          const traitEntries = Array.from(traitMap.entries()).map(([tag, count]) => ({
            tag,
            vote_count: count,
          }));

          const result = computePersonalityType(traitEntries);
          setPersonalityCode(result.code);
          return;
        }
      }

      setPersonalityCode('ENFP'); // fallback
    }

    fetchType();
  }, [user]);

  useEffect(() => {
    // Phase timeline: building (2s) → reveal (stays)
    const t1 = setTimeout(() => setPhase('reveal'), 2000);
    return () => clearTimeout(t1);
  }, []);

  const personality = personalityCode ? PERSONALITY_TYPES[personalityCode] : null;

  return (
    <div className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center p-6">
      <AnimatePresence mode="wait">
        {phase === 'building' && (
          <motion.div
            key="building"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center gap-4 text-center"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-16 h-16 rounded-full border-4 border-primary border-t-transparent"
            />
            <p className="text-lg font-display font-bold text-foreground">
              Analyzing your choices…
            </p>
            <p className="text-sm text-muted-foreground">Building your identity</p>
          </motion.div>
        )}

        {phase === 'reveal' && personality && (
          <motion.div
            key="reveal"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="flex flex-col items-center gap-6 text-center max-w-sm"
          >
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 300 }}
              className="text-6xl"
            >
              {personality.emoji}
            </motion.span>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <p className="text-sm font-medium text-primary uppercase tracking-widest mb-2">
                You are
              </p>
              <h1 className="text-3xl font-display font-bold text-foreground mb-3">
                {personality.name}
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                {personality.description}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="flex flex-wrap justify-center gap-2"
            >
              {personality.strengths.slice(0, 3).map((s, i) => (
                <span
                  key={i}
                  className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold"
                >
                  {s}
                </span>
              ))}
            </motion.div>

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              onClick={onComplete}
              className="mt-6 w-full py-4 rounded-2xl bg-gradient-primary text-primary-foreground font-display font-bold text-base shadow-lg"
            >
              Start Voting
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
