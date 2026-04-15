import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { computePersonalityType, getPersonalityExplanation } from '@/lib/personalityType';
import { motion } from 'framer-motion';
import { Brain, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface Props {
  userId: string;
  isOwnProfile?: boolean;
}

export default function PersonalityTypeCard({ userId, isOwnProfile = false }: Props) {
  const [expanded, setExpanded] = useState(false);
  const MIN_VOTES = 30;

  const { data: voteCount = 0 } = useQuery({
    queryKey: ['personality-vote-count', userId],
    queryFn: async () => {
      const { count } = await supabase.from('votes').select('id', { count: 'exact' }).eq('user_id', userId);
      return count || 0;
    },
    enabled: !!userId,
  });

  const { data: traits = [] } = useQuery({
    queryKey: ['personality-traits', userId],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_user_voting_traits', { p_user_id: userId });
      return (data || []) as { tag: string; vote_count: number }[];
    },
    enabled: !!userId,
  });

  const hasPersonalitySignal = traits.length > 0;
  const needsMoreVotes = voteCount < MIN_VOTES;
  const isCalibrating = !needsMoreVotes && !hasPersonalitySignal;
  const remainingVotes = Math.max(0, MIN_VOTES - voteCount);

  const result = computePersonalityType(traits, voteCount);
  const reasons = getPersonalityExplanation(traits, result);

  // Not ready state — show progress
  if (!result.ready) {
    const progress = isCalibrating ? 100 : Math.min((voteCount / MIN_VOTES) * 100, 99);
    return (
      <div className="glass rounded-2xl p-5 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Brain className="h-4 w-4 text-primary" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Personality Type</span>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          {isCalibrating
            ? isOwnProfile
              ? 'Your votes are recorded, but we do not have enough personality signal yet to reveal your type.'
              : 'This user has votes, but their personality type is still being calculated.'
            : isOwnProfile
              ? `Vote on ${remainingVotes} more polls to unlock your personality type`
              : 'This user needs more votes to reveal their type'}
        </p>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          {isCalibrating ? `${voteCount} votes recorded` : `${voteCount}/${MIN_VOTES} votes`}
        </p>
      </div>
    );
  }

  // Axis bar helper
  const AxisBar = ({ label1, label2, value }: { label1: string; label2: string; value: number }) => {
    const pct = Math.min(Math.max(50 + value * 3, 10), 90);
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
          <span>{label1}</span>
          <span>{label2}</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden relative">
          <div className="absolute left-1/2 top-0 w-px h-full bg-border z-10" />
          <motion.div
            initial={{ width: '50%' }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8 }}
            className="h-full rounded-full bg-primary"
          />
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl overflow-hidden"
    >
      {/* Main display */}
      <div className="p-5 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Brain className="h-4 w-4 text-primary" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Personality Type</span>
        </div>

        <div className="text-4xl mb-1">{result.emoji}</div>
        <h3 className="text-2xl font-display font-bold text-foreground">{result.name}</h3>
        <p className="text-xs font-mono text-primary font-bold mt-1 tracking-[4px]">{result.code}</p>
        <p className="text-sm text-muted-foreground mt-3 leading-relaxed max-w-[280px] mx-auto">{result.description}</p>

        {/* Strengths */}
        {result.strengths.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {result.strengths.map((s) => (
              <span key={s} className="px-3 py-1 rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Expandable axes breakdown */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1.5 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-t border-border hover:bg-secondary/30 transition-colors"
      >
        {expanded ? 'Hide' : 'Why this type?'}
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="px-5 pb-5 space-y-4"
        >
          {/* Axis bars */}
          <div className="space-y-3">
            <AxisBar label1="I — Independent" label2="E — Social" value={result.axes.ei} />
            <AxisBar label1="N — Visionary" label2="S — Practical" value={result.axes.sn} />
            <AxisBar label1="F — Authentic" label2="T — Strategic" value={result.axes.tf} />
            <AxisBar label1="P — Flexible" label2="J — Decisive" value={result.axes.jp} />
          </div>

          {/* Text reasons */}
          <div className="space-y-2 pt-2">
            {reasons.map((r, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <p className="text-xs text-foreground/70 leading-relaxed">{r}</p>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-muted-foreground/50 text-center">
            Based on {voteCount} votes · Updates as you vote more
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
