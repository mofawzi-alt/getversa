import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PERSONALITY_TYPES } from '@/lib/personalityType';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Simplified axis scoring for onboarding (no minimum vote requirement)
const AXIS_TAGS = {
  E: ['social', 'extrovert', 'public', 'expressive', 'glam'],
  I: ['independent', 'introvert', 'private', 'homebody', 'calm'],
  S: ['traditional', 'authentic', 'safe_asset', 'structured'],
  N: ['growth', 'innovation', 'trendy', 'curated'],
  T: ['price_sensitive', 'quality', 'speed', 'boss', 'practical'],
  F: ['indulgent', 'luxury', 'romantic', 'soft', 'natural', 'experience'],
  J: ['brand_oriented', 'structured', 'safe_asset'],
  P: ['experience', 'adventurous', 'spontaneous', 'flexible', 'risktaker', 'variety'],
};

function scoreOnboardingAxis(tags: Map<string, number>, pos: string[], neg: string[]): number {
  let p = 0, n = 0;
  for (const [tag, count] of tags) {
    if (pos.includes(tag)) p += count;
    if (neg.includes(tag)) n += count;
  }
  const total = p + n;
  return total === 0 ? 0 : (p - n) / total;
}

function computeOnboardingType(tagCounts: Map<string, number>): string {
  const ei = scoreOnboardingAxis(tagCounts, AXIS_TAGS.E, AXIS_TAGS.I);
  const sn = scoreOnboardingAxis(tagCounts, AXIS_TAGS.S, AXIS_TAGS.N);
  const tf = scoreOnboardingAxis(tagCounts, AXIS_TAGS.T, AXIS_TAGS.F);
  const jp = scoreOnboardingAxis(tagCounts, AXIS_TAGS.J, AXIS_TAGS.P);

  return (
    (ei >= 0 ? 'E' : 'I') +
    (sn >= 0 ? 'S' : 'N') +
    (tf >= 0 ? 'T' : 'F') +
    (jp >= 0 ? 'J' : 'P')
  );
}

interface PersonalityRevealScreenProps {
  onComplete: () => void;
}

export default function PersonalityRevealScreen({ onComplete }: PersonalityRevealScreenProps) {
  const { user } = useAuth();
  const [phase, setPhase] = useState<'building' | 'reveal'>('building');
  const [personalityCode, setPersonalityCode] = useState<string | null>(null);

  useEffect(() => {
    async function fetchType() {
      if (!user) { setPersonalityCode('ENFP'); return; }

      // Get user's recent votes with poll tags
      const { data: votes } = await supabase
        .from('votes')
        .select('poll_id, choice')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!votes?.length) { setPersonalityCode('ENFP'); return; }

      const pollIds = votes.map(v => v.poll_id);
      const { data: polls } = await supabase
        .from('polls')
        .select('id, option_a_tag, option_b_tag')
        .in('id', pollIds);

      if (!polls?.length) { setPersonalityCode('ENFP'); return; }

      const tagCounts = new Map<string, number>();
      votes.forEach(vote => {
        const poll = polls.find(p => p.id === vote.poll_id);
        if (!poll) return;
        const tag = vote.choice === 'A' ? poll.option_a_tag : poll.option_b_tag;
        if (tag) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });

      setPersonalityCode(computeOnboardingType(tagCounts));
    }

    fetchType();
  }, [user]);

  useEffect(() => {
    const t = setTimeout(() => setPhase('reveal'), 2200);
    return () => clearTimeout(t);
  }, []);

  const personality = personalityCode ? (PERSONALITY_TYPES[personalityCode] || PERSONALITY_TYPES['ENFP']) : null;

  return (
    <div className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center p-6 safe-area-top safe-area-bottom">
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
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
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
