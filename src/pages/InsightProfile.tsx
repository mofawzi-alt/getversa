import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Loader2, Eye, Lock } from 'lucide-react';

// Reflective labels per dimension tendency — no raw scores exposed
const TENDENCY_LABELS: Record<string, Record<string, { label: string; description: string }>> = {
  'Tradition vs Innovation': {
    strong_a: { label: 'Rooted', description: 'You find meaning in what endures.' },
    lean_a: { label: 'Grounded', description: 'You value the familiar, with room for the new.' },
    balanced: { label: 'Adaptive', description: 'You hold both the old and the new.' },
    lean_b: { label: 'Forward-leaning', description: 'You are drawn to what is emerging.' },
    strong_b: { label: 'Visionary', description: 'You seek what has not been built yet.' },
  },
  'Independence vs Community': {
    strong_a: { label: 'Self-directed', description: 'You trust your own compass above all.' },
    lean_a: { label: 'Autonomous', description: 'You prefer your own path, but value connection.' },
    balanced: { label: 'Interwoven', description: 'You move between solitude and togetherness.' },
    lean_b: { label: 'Communal', description: 'You draw energy from those around you.' },
    strong_b: { label: 'Collective', description: 'You believe we rise together.' },
  },
  'Logic vs Intuition': {
    strong_a: { label: 'Analytical', description: 'You trust evidence and structure.' },
    lean_a: { label: 'Reasoned', description: 'You lean on logic, but listen to instinct.' },
    balanced: { label: 'Dual-minded', description: 'You blend thinking and feeling.' },
    lean_b: { label: 'Perceptive', description: 'You often sense the answer before finding it.' },
    strong_b: { label: 'Instinctive', description: 'You trust what you feel deeply.' },
  },
  'Comfort vs Adventure': {
    strong_a: { label: 'Anchored', description: 'You find depth in the familiar.' },
    lean_a: { label: 'Steady', description: 'You appreciate stability with occasional exploration.' },
    balanced: { label: 'Versatile', description: 'You are equally at home in stillness and motion.' },
    lean_b: { label: 'Curious', description: 'You lean into the unknown with interest.' },
    strong_b: { label: 'Explorer', description: 'You are most alive when discovering.' },
  },
  'Present vs Future': {
    strong_a: { label: 'Present-focused', description: 'You live fully in the now.' },
    lean_a: { label: 'Grounded in today', description: 'You prioritize what is in front of you.' },
    balanced: { label: 'Temporal', description: 'You hold both today and tomorrow.' },
    lean_b: { label: 'Forward-looking', description: 'You plan with purpose.' },
    strong_b: { label: 'Futurist', description: 'Your mind lives in what is next.' },
  },
};

const FALLBACK_LABEL = { label: 'Emerging', description: 'This dimension is still forming.' };

function getTendencyDisplay(dimension: string, tendency: string) {
  const dimLabels = TENDENCY_LABELS[dimension];
  if (dimLabels && dimLabels[tendency]) return dimLabels[tendency];
  return FALLBACK_LABEL;
}

export default function InsightProfile() {
  const { user } = useAuth();

  const { data: totalVotes, isLoading: votesLoading } = useQuery({
    queryKey: ['user-vote-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase
        .from('votes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      return count || 0;
    },
    enabled: !!user,
  });

  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: ['insight-profile', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.rpc('get_insight_profile', {
        p_user_id: user.id,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && (totalVotes ?? 0) >= 20,
  });

  const isLoading = votesLoading || insightsLoading;
  const isUnlocked = (totalVotes ?? 0) >= 20;
  const votesRemaining = Math.max(0, 20 - (totalVotes ?? 0));

  return (
    <AppLayout>
      <div className="min-h-screen p-4 pb-24">
        <header className="mb-6">
          <h1 className="text-2xl font-display font-bold text-foreground">Your Dimensions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            A private reflection of your perspectives.
          </p>
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center mt-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !isUnlocked ? (
          // Locked state
          <div className="mt-12 space-y-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Lock className="h-7 w-7 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-display font-semibold text-foreground">
                  Your profile is forming
                </h2>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Share {votesRemaining} more perspective{votesRemaining !== 1 ? 's' : ''} to reveal your dimensions.
                </p>
              </div>
            </div>

            {/* Progress */}
            <div className="max-w-xs mx-auto">
              <div className="flex justify-between text-xs text-muted-foreground mb-2">
                <span>{totalVotes} shared</span>
                <span>20 needed</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${Math.min(100, ((totalVotes ?? 0) / 20) * 100)}%` }}
                />
              </div>
            </div>

            <p className="text-center text-xs text-muted-foreground italic">
              Every choice shapes the picture.
            </p>
          </div>
        ) : (
          // Unlocked insight view
          <div className="space-y-4 animate-slide-up">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                For your eyes only
              </span>
            </div>

            {insights && insights.length > 0 ? (
              <div className="space-y-3">
                {insights.map((insight: { dimension_name: string; tendency: string }) => {
                  const display = getTendencyDisplay(insight.dimension_name, insight.tendency);
                  return (
                    <div
                      key={insight.dimension_name}
                      className="glass rounded-2xl p-5 space-y-1"
                    >
                      <div className="text-lg font-display font-bold text-foreground">
                        {display.label}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {display.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="glass rounded-2xl p-6 text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Your dimensions are still emerging. Keep sharing perspectives.
                </p>
              </div>
            )}

            <div className="text-center pt-4 space-y-1">
              <p className="text-xs text-muted-foreground">
                Based on {totalVotes} perspectives shared
              </p>
              <p className="text-xs text-muted-foreground/60 italic">
                This is a private reflection. It is not shared with anyone.
              </p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
