import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { motion } from 'framer-motion';
import { Brain, Lock, Loader2, ChevronRight, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useT } from '@/hooks/useT';

// All 10 personality traits with their poles
const PERSONALITY_TRAITS = [
  { dimension: 'Structure vs Flexibility', poleA: 'Planner', poleB: 'Spontaneous', emoji: '📋' },
  { dimension: 'Energy Source', poleA: 'Introvert', poleB: 'Extrovert', emoji: '🔋' },
  { dimension: 'Risk Tolerance', poleA: 'Risk Taker', poleB: 'Safe Player', emoji: '🎯' },
  { dimension: 'Decision Style', poleA: 'Heart', poleB: 'Head', emoji: '💡' },
  { dimension: 'Social Role', poleA: 'Leader', poleB: 'Supporter', emoji: '👥' },
  { dimension: 'Thinking Style', poleA: 'Dreamer', poleB: 'Realist', emoji: '🧠' },
  { dimension: 'Work-Life Mindset', poleA: 'Hustle', poleB: 'Balance', emoji: '⚖️' },
  { dimension: 'Autonomy', poleA: 'Go Solo', poleB: 'Team Up', emoji: '🦅' },
  { dimension: 'Decision Speed', poleA: 'Act Fast', poleB: 'Think Slow', emoji: '⚡' },
  { dimension: 'Lifestyle Preference', poleA: 'Routine', poleB: 'Variety', emoji: '🎲' },
];

// Map dimension tag → poll IDs (fetched dynamically)
interface PersonalityVote {
  pollId: string;
  dimension: string;
  choice: 'A' | 'B';
  optionA: string;
  optionB: string;
}

// Archetype generation based on dominant traits
interface Archetype {
  name: string;
  emoji: string;
  description: string;
  traits: string[];
}

function computeArchetype(votes: PersonalityVote[], t: (k: string) => string): Archetype {
  if (votes.length < 5) {
    return {
      name: t('Emerging'),
      emoji: '🌱',
      description: t('Keep voting to reveal your full personality archetype.'),
      traits: [],
    };
  }

  const scores = {
    structured: 0, flexible: 0,
    introverted: 0, extroverted: 0,
    bold: 0, cautious: 0,
    emotional: 0, logical: 0,
    leading: 0, supporting: 0,
  };

  for (const v of votes) {
    switch (v.dimension) {
      case 'Structure vs Flexibility':
        if (v.choice === 'A') scores.structured++; else scores.flexible++;
        break;
      case 'Energy Source':
        if (v.choice === 'A') scores.introverted++; else scores.extroverted++;
        break;
      case 'Risk Tolerance':
        if (v.choice === 'A') scores.bold++; else scores.cautious++;
        break;
      case 'Decision Style':
        if (v.choice === 'A') scores.emotional++; else scores.logical++;
        break;
      case 'Social Role':
        if (v.choice === 'A') scores.leading++; else scores.supporting++;
        break;
      case 'Thinking Style':
        if (v.choice === 'A') scores.flexible++; else scores.structured++;
        break;
      case 'Work-Life Mindset':
        if (v.choice === 'A') scores.bold++; else scores.cautious++;
        break;
      case 'Autonomy':
        if (v.choice === 'A') scores.introverted++; else scores.extroverted++;
        break;
      case 'Decision Speed':
        if (v.choice === 'A') scores.bold++; else scores.cautious++;
        break;
      case 'Lifestyle Preference':
        if (v.choice === 'A') scores.structured++; else scores.flexible++;
        break;
    }
  }

  const isExtroverted = scores.extroverted > scores.introverted;
  const isBold = scores.bold > scores.cautious;
  const isStructured = scores.structured > scores.flexible;
  const isLogical = scores.logical > scores.emotional;

  // 16 archetypes from 4 binary dimensions
  if (isExtroverted && isBold && isStructured && isLogical) {
    return { name: t('The Commander'), emoji: '👑', description: t('Bold, social, and strategic — you lead with clarity and confidence.'), traits: ['Decisive', 'Strategic', 'Outgoing'].map((s) => t(s)) };
  }
  if (isExtroverted && isBold && isStructured && !isLogical) {
    return { name: t('The Champion'), emoji: '🏆', description: t('Passionate and driven — you rally people around what matters.'), traits: ['Inspirational', 'Organized', 'Heart-led'].map((s) => t(s)) };
  }
  if (isExtroverted && isBold && !isStructured && isLogical) {
    return { name: t('The Maverick'), emoji: '⚡', description: t('Quick-thinking and fearless — always first to shake things up.'), traits: ['Risk-taker', 'Analytical', 'Dynamic'].map((s) => t(s)) };
  }
  if (isExtroverted && isBold && !isStructured && !isLogical) {
    return { name: t('The Spark'), emoji: '✨', description: t('Magnetic and adventurous — you light up every room and every idea.'), traits: ['Spontaneous', 'Charismatic', 'Empathetic'].map((s) => t(s)) };
  }
  if (isExtroverted && !isBold && isStructured && isLogical) {
    return { name: t('The Executive'), emoji: '📊', description: t('Efficient and reliable — people count on your steady judgment.'), traits: ['Dependable', 'Methodical', 'Social'].map((s) => t(s)) };
  }
  if (isExtroverted && !isBold && isStructured && !isLogical) {
    return { name: t('The Host'), emoji: '🎪', description: t('Warm and organized — you create spaces where everyone belongs.'), traits: ['Caring', 'Reliable', 'Community-driven'].map((s) => t(s)) };
  }
  if (isExtroverted && !isBold && !isStructured && isLogical) {
    return { name: t('The Diplomat'), emoji: '🤝', description: t('Balanced and adaptable — you find common ground effortlessly.'), traits: ['Flexible', 'Fair-minded', 'Sociable'].map((s) => t(s)) };
  }
  if (isExtroverted && !isBold && !isStructured && !isLogical) {
    return { name: t('The Performer'), emoji: '🎭', description: t('Playful and present — you live for the joy of shared moments.'), traits: ['Fun-loving', 'Expressive', 'Open'].map((s) => t(s)) };
  }
  if (!isExtroverted && isBold && isStructured && isLogical) {
    return { name: t('The Architect'), emoji: '🏗️', description: t('Strategic and independent — you build with precision and vision.'), traits: ['Analytical', 'Self-reliant', 'Focused'].map((s) => t(s)) };
  }
  if (!isExtroverted && isBold && isStructured && !isLogical) {
    return { name: t('The Idealist'), emoji: '🌙', description: t('Deep and principled — your choices come from core values.'), traits: ['Values-driven', 'Determined', 'Reflective'].map((s) => t(s)) };
  }
  if (!isExtroverted && isBold && !isStructured && isLogical) {
    return { name: t('The Analyst'), emoji: '🔬', description: t('Curious and sharp — you explore every angle before committing.'), traits: ['Investigative', 'Open-minded', 'Bold'].map((s) => t(s)) };
  }
  if (!isExtroverted && isBold && !isStructured && !isLogical) {
    return { name: t('The Dreamer'), emoji: '🦋', description: t('Sensitive and creative — you follow what feels authentic.'), traits: ['Imaginative', 'Courageous', 'Free-spirited'].map((s) => t(s)) };
  }
  if (!isExtroverted && !isBold && isStructured && isLogical) {
    return { name: t('The Anchor'), emoji: '⚓', description: t('Grounded and steady — you trust what works over what is new.'), traits: ['Consistent', 'Thoughtful', 'Reliable'].map((s) => t(s)) };
  }
  if (!isExtroverted && !isBold && isStructured && !isLogical) {
    return { name: t('The Guardian'), emoji: '🛡️', description: t('Caring and steady — you protect what you value most.'), traits: ['Loyal', 'Nurturing', 'Patient'].map((s) => t(s)) };
  }
  if (!isExtroverted && !isBold && !isStructured && isLogical) {
    return { name: t('The Craftsman'), emoji: '🔧', description: t('Cool and practical — you strip things down to what works.'), traits: ['Pragmatic', 'Quiet', 'Efficient'].map((s) => t(s)) };
  }
  // !isExtroverted && !isBold && !isStructured && !isLogical
  return { name: t('The Artist'), emoji: '🎨', description: t('Gentle and aesthetic — you follow your senses and heart.'), traits: ['Creative', 'Reflective', 'Harmonious'].map((s) => t(s)) };
}

export default function PersonalityResults() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useT();

  // Fetch personality polls
  const { data: personalityPolls = [] } = useQuery({
    queryKey: ['personality-polls'],
    queryFn: async () => {
      const { data } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, internal_dimension_tag, intent_tag')
        .eq('intent_tag', 'personality')
        .eq('is_active', true);
      return data || [];
    },
  });

  // Fetch user's votes on personality polls
  const pollIds = personalityPolls.map(p => p.id);
  const { data: userVotes = [], isLoading } = useQuery({
    queryKey: ['personality-votes', user?.id, pollIds],
    queryFn: async () => {
      if (!user || pollIds.length === 0) return [];
      const { data } = await supabase
        .from('votes')
        .select('poll_id, choice')
        .eq('user_id', user.id)
        .in('poll_id', pollIds);
      return data || [];
    },
    enabled: !!user && pollIds.length > 0,
  });

  // Map votes to personality dimensions
  const personalityVotes: PersonalityVote[] = userVotes.map(v => {
    const poll = personalityPolls.find(p => p.id === v.poll_id);
    return {
      pollId: v.poll_id,
      dimension: poll?.internal_dimension_tag || '',
      choice: v.choice as 'A' | 'B',
      optionA: poll?.option_a || '',
      optionB: poll?.option_b || '',
    };
  }).filter(v => v.dimension);

  const totalPolls = personalityPolls.length;
  const answeredCount = personalityVotes.length;
  const progress = totalPolls > 0 ? (answeredCount / totalPolls) * 100 : 0;
  const archetype = computeArchetype(personalityVotes, t);
  const isReady = answeredCount >= 5;

  const handleShare = () => {
    const text = `My Versa personality is ${archetype.emoji} ${archetype.name}! ${archetype.description}\n\nDiscover yours at getversa.lovable.app`;
    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      toast.success(t('Copied to clipboard!'));
    }
  };

  return (
    <AppLayout>
      <div className="min-h-screen p-4 pb-24">
        <header className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Brain className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-display font-bold text-foreground">{t('Your Personality')}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('Based on your choices across {n} personality polls', { n: totalPolls })}
          </p>
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center mt-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !user ? (
          <div className="mt-12 text-center space-y-4">
            <Lock className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">{t('Sign in to see your personality results.')}</p>
            <button onClick={() => navigate('/auth')} className="text-sm font-semibold text-primary">
              {t('Sign In →')}
            </button>
          </div>
        ) : (
          <div className="space-y-5 animate-slide-up">
            {/* Archetype Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass rounded-2xl p-6 text-center relative overflow-hidden"
            >
              {isReady && (
                <button
                  onClick={handleShare}
                  className="absolute top-4 right-4 p-2 rounded-full hover:bg-secondary/50 transition-colors"
                >
                  <Share2 className="h-4 w-4 text-muted-foreground" />
                </button>
              )}

              <div className="text-5xl mb-2">{archetype.emoji}</div>
              <h2 className="text-2xl font-display font-bold text-foreground">{archetype.name}</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-[280px] mx-auto leading-relaxed">
                {archetype.description}
              </p>

              {archetype.traits.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  {archetype.traits.map(t => (
                    <span key={t} className="px-3 py-1 rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {/* Progress */}
              <div className="mt-5">
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
                  <span>{answeredCount}/{totalPolls} {t('answered')}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.8 }}
                    className="h-full rounded-full bg-primary"
                  />
                </div>
              </div>
            </motion.div>

            {/* Trait breakdown */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {t('Trait Breakdown')}
              </h3>

              {PERSONALITY_TRAITS.map((trait, i) => {
                const vote = personalityVotes.find(v => v.dimension === trait.dimension);
                const isAnswered = !!vote;
                const chosenLabel = vote ? (vote.choice === 'A' ? trait.poleA : trait.poleB) : null;

                return (
                  <motion.div
                    key={trait.dimension}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`glass rounded-xl p-4 ${!isAnswered ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{trait.emoji}</span>
                        <span className="text-xs font-semibold text-foreground">{t(trait.dimension)}</span>
                      </div>
                      {isAnswered ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                          {t(chosenLabel!)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">{t('Not answered')}</span>
                      )}
                    </div>

                    {/* Spectrum bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>{t(trait.poleA)}</span>
                        <span>{t(trait.poleB)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden relative">
                        <div className="absolute left-1/2 top-0 w-px h-full bg-border z-10" />
                        {isAnswered && (
                          <motion.div
                            initial={{ width: '50%' }}
                            animate={{ width: vote.choice === 'A' ? '25%' : '75%' }}
                            transition={{ duration: 0.6, delay: i * 0.05 }}
                            className="h-full rounded-full bg-primary"
                          />
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* CTA for unanswered */}
            {answeredCount < totalPolls && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => navigate('/home')}
                className="w-full glass rounded-xl p-4 flex items-center justify-between hover:bg-secondary/30 transition-colors"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {t(totalPolls - answeredCount !== 1 ? '{n} personality polls remaining' : '{n} personality poll remaining', { n: totalPolls - answeredCount })}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {t('Answer more to refine your type')}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </motion.button>
            )}

            <p className="text-center text-[10px] text-muted-foreground/60 italic">
              {t('Your type updates as you answer more polls')}
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
