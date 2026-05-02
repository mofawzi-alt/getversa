import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, Lock, ChevronRight, Gift } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import ProfileCompletionQuiz from './ProfileCompletionQuiz';

const TENDENCY_LABELS: Record<string, Record<string, string>> = {
  'Tradition vs Innovation': { strong_a: 'Rooted', lean_a: 'Grounded', balanced: 'Adaptive', lean_b: 'Forward-leaning', strong_b: 'Visionary' },
  'Budget vs Premium': { strong_a: 'Saver', lean_a: 'Budget-minded', balanced: 'Balanced spender', lean_b: 'Quality-first', strong_b: 'Premium' },
  'Local vs Global': { strong_a: 'Homegrown', lean_a: 'Local-leaning', balanced: 'Glocal', lean_b: 'World-curious', strong_b: 'Global citizen' },
  'Practicality vs Experience': { strong_a: 'Pragmatist', lean_a: 'Practical', balanced: 'Versatile', lean_b: 'Experience-seeker', strong_b: 'Experientialist' },
  'Health vs Indulgence': { strong_a: 'Wellness-driven', lean_a: 'Health-conscious', balanced: 'Balanced', lean_b: 'Treat-yourself', strong_b: 'Indulgent' },
};

const QUIZ_FIELDS = ['employment_status', 'industry', 'education_level', 'income_range'];

export default function ProfileDimensionsSection() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [showQuiz, setShowQuiz] = useState(false);

  const { data: totalVotes } = useQuery({
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

  const isUnlocked = (totalVotes ?? 0) >= 20;

  const { data: insights } = useQuery({
    queryKey: ['insight-profile', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.rpc('get_insight_profile', { p_user_id: user.id });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && isUnlocked,
  });

  const hasIncompleteQuizFields = QUIZ_FIELDS.some(key => {
    const value = (profile as Record<string, unknown>)?.[key];
    return value === null || value === undefined || value === '';
  });

  if (!user) return null;

  return (
    <>
      <div className="glass rounded-2xl overflow-hidden">
        {/* Dimensions header + preview */}
        <button
          onClick={() => navigate('/taste-profile')}
          className="w-full p-4 text-left group"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold text-base flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              Taste Profile
            </h3>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
          </div>

          {!isUnlocked ? (
            <div className="flex items-center gap-3">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-foreground font-medium">Still forming</p>
                <p className="text-xs text-muted-foreground">
                  {Math.max(0, 20 - (totalVotes ?? 0))} more perspectives to unlock
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {insights?.slice(0, 5).map((insight: { dimension_name: string; tendency: string }) => {
                const label = TENDENCY_LABELS[insight.dimension_name]?.[insight.tendency] || 'Emerging';
                return (
                  <span
                    key={insight.dimension_name}
                    className="px-2.5 py-1 rounded-full bg-primary/15 text-primary text-xs font-medium"
                  >
                    {label}
                  </span>
                );
              })}
            </div>
          )}
        </button>

        {/* Quick Quiz CTA - inside dimensions section */}
        {hasIncompleteQuizFields && (
          <div className="border-t border-border px-4 py-3">
            <Button
              onClick={() => setShowQuiz(true)}
              variant="ghost"
              className="w-full justify-between text-sm"
            >
              <span className="flex items-center gap-2">
                <Gift className="h-4 w-4 text-primary" />
                Take Quick Quiz to earn points
              </span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showQuiz && (
          <ProfileCompletionQuiz
            onClose={() => setShowQuiz(false)}
            onComplete={() => setShowQuiz(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
