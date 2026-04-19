import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { computePersonalityType, computeTypeCompatibility, PERSONALITY_TYPES } from '@/lib/personalityType';
import { motion } from 'framer-motion';
import { Brain, Heart, Layers, Sparkles, TrendingUp } from 'lucide-react';

interface Props {
  userAId: string;
  userBId: string;
  userBUsername?: string;
}

function usePersonalityData(userId: string | undefined) {
  const { data: traits = [] } = useQuery({
    queryKey: ['personality-traits', userId],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_user_voting_traits', { p_user_id: userId! });
      return (data || []) as { tag: string; vote_count: number }[];
    },
    enabled: !!userId,
  });

  const { data: voteCount = 0 } = useQuery({
    queryKey: ['personality-vote-count', userId],
    queryFn: async () => {
      const { count } = await supabase.from('votes').select('id', { count: 'exact' }).eq('user_id', userId!);
      return count || 0;
    },
    enabled: !!userId,
  });

  return { traits, voteCount };
}

export default function BlendedCompatibility({ userAId, userBId, userBUsername }: Props) {
  // 1. Vote match score
  const { data: voteScore } = useQuery({
    queryKey: ['vote-compatibility', userAId, userBId],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_compatibility_score', { user_a: userAId, user_b: userBId });
      return data as number | null;
    },
    enabled: !!userAId && !!userBId,
  });

  // 2. Dimension alignment
  const { data: dimensions = [] } = useQuery({
    queryKey: ['dimension-compatibility', userAId, userBId],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_dimension_compatibility', { user_a: userAId, user_b: userBId });
      return (data || []) as { dimension_name: string; user_a_score: number; user_b_score: number; alignment: number; shared_dimensions: number }[];
    },
    enabled: !!userAId && !!userBId,
  });

  // 3. Personality type
  const aPersonality = usePersonalityData(userAId);
  const bPersonality = usePersonalityData(userBId);

  const typeA = computePersonalityType(aPersonality.traits, aPersonality.voteCount, userAId);
  const typeB = computePersonalityType(bPersonality.traits, bPersonality.voteCount, userBId);
  const personalityCompat = computeTypeCompatibility(typeA, typeB);

  // Blended score calculation
  const dimensionAvg = dimensions.length > 0
    ? Math.round(dimensions.reduce((sum, d) => sum + Number(d.alignment), 0) / dimensions.length)
    : null;

  const scores = [
    voteScore != null ? { weight: 0.4, value: voteScore } : null,
    dimensionAvg != null ? { weight: 0.35, value: dimensionAvg } : null,
    personalityCompat ? { weight: 0.25, value: personalityCompat.score } : null,
  ].filter(Boolean) as { weight: number; value: number }[];

  // Normalize weights
  const totalWeight = scores.reduce((s, x) => s + x.weight, 0);
  const blendedScore = totalWeight > 0
    ? Math.round(scores.reduce((s, x) => s + (x.weight / totalWeight) * x.value, 0))
    : null;

  const getScoreLabel = (score: number) => {
    if (score >= 85) return { label: 'Soul Match', emoji: '💛', color: 'text-yellow-500' };
    if (score >= 70) return { label: 'Strong Bond', emoji: '🤝', color: 'text-green-500' };
    if (score >= 55) return { label: 'Good Vibes', emoji: '⚡', color: 'text-primary' };
    if (score >= 40) return { label: 'Different Flavors', emoji: '🔄', color: 'text-orange-500' };
    return { label: 'Opposites', emoji: '🧲', color: 'text-red-500' };
  };

  if (blendedScore == null) {
    return (
      <div className="glass rounded-2xl p-6 text-center">
        <Brain className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">Not enough shared data yet. Vote on more polls!</p>
      </div>
    );
  }

  const scoreInfo = getScoreLabel(blendedScore);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-4"
    >
      {/* Hero Score */}
      <div className="glass rounded-3xl p-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5" />
        <div className="relative z-10">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Compatibility Score
            </span>
          </div>

          <div className="relative w-28 h-28 mx-auto mb-4">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6" className="text-secondary" />
              <circle
                cx="50" cy="50" r="42" fill="none"
                stroke="currentColor" strokeWidth="6"
                strokeDasharray={`${blendedScore * 2.64} ${264 - blendedScore * 2.64}`}
                strokeLinecap="round"
                className="text-primary transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-foreground">{blendedScore}%</span>
              <span className="text-lg">{scoreInfo.emoji}</span>
            </div>
          </div>

          <span className={`px-4 py-1.5 rounded-full bg-primary/10 text-sm font-bold ${scoreInfo.color}`}>
            {scoreInfo.label}
          </span>

          <p className="text-xs text-muted-foreground mt-3">
            You & @{userBUsername || 'them'}
          </p>
        </div>
      </div>

      {/* Breakdown Cards */}
      <div className="grid grid-cols-3 gap-2">
        {/* Vote Match */}
        <div className="glass rounded-xl p-3 text-center">
          <Heart className="h-4 w-4 mx-auto text-red-400 mb-1" />
          <div className="text-lg font-bold">{voteScore != null ? `${voteScore}%` : '—'}</div>
          <div className="text-[9px] text-muted-foreground font-medium">Vote Match</div>
        </div>

        {/* Dimension */}
        <div className="glass rounded-xl p-3 text-center">
          <Layers className="h-4 w-4 mx-auto text-blue-400 mb-1" />
          <div className="text-lg font-bold">{dimensionAvg != null ? `${dimensionAvg}%` : '—'}</div>
          <div className="text-[9px] text-muted-foreground font-medium">Dimension</div>
        </div>

        {/* Personality */}
        <div className="glass rounded-xl p-3 text-center">
          <Brain className="h-4 w-4 mx-auto text-purple-400 mb-1" />
          <div className="text-lg font-bold">{personalityCompat ? `${personalityCompat.score}%` : '—'}</div>
          <div className="text-[9px] text-muted-foreground font-medium">Personality</div>
        </div>
      </div>

      {/* Personality Types */}
      {personalityCompat && (
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-center flex-1">
              <div className="text-xl">{typeA.emoji}</div>
              <p className="text-[10px] font-bold mt-1">{PERSONALITY_TYPES[typeA.code]?.name || typeA.name}</p>
              <p className="text-[9px] text-muted-foreground">You</p>
            </div>
            <div className="text-center px-2">
              <span className="text-xs font-bold text-primary">{personalityCompat.label}</span>
            </div>
            <div className="text-center flex-1">
              <div className="text-xl">{typeB.emoji}</div>
              <p className="text-[10px] font-bold mt-1">{PERSONALITY_TYPES[typeB.code]?.name || typeB.name}</p>
              <p className="text-[9px] text-muted-foreground">@{userBUsername || 'them'}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">{personalityCompat.description}</p>
        </div>
      )}

      {/* Dimension Details */}
      {dimensions.length > 0 && (
        <div className="glass rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Dimension Alignment
            </span>
          </div>
          {dimensions.slice(0, 5).map((dim) => (
            <div key={dim.dimension_name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium">{dim.dimension_name}</span>
                <span className="text-xs font-bold">{Number(dim.alignment)}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-700"
                  style={{ width: `${Number(dim.alignment)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
