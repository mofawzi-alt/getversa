import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Gift, ChevronRight, CheckCircle2, Sparkles } from 'lucide-react';
import ProfileCompletionQuiz from './ProfileCompletionQuiz';

interface ProfileField {
  key: string;
  label: string;
  points: number;
}

const PROFILE_FIELDS: ProfileField[] = [
  { key: 'username', label: 'Username', points: 10 },
  { key: 'age_range', label: 'Age Range', points: 10 },
  { key: 'gender', label: 'Gender', points: 10 },
  { key: 'country', label: 'Country', points: 10 },
  { key: 'city', label: 'City', points: 10 },
  { key: 'category_interests', label: 'Interests', points: 15 },
  { key: 'employment_status', label: 'Employment', points: 25 },
  { key: 'industry', label: 'Industry', points: 25 },
  { key: 'education_level', label: 'Education', points: 25 },
  { key: 'income_range', label: 'Income', points: 25 },
];

export default function ProfileCompletionCard() {
  const { profile } = useAuth();
  const [showQuiz, setShowQuiz] = useState(false);

  if (!profile) return null;

  // Calculate completion
  const completedFields = PROFILE_FIELDS.filter(field => {
    const value = (profile as Record<string, unknown>)[field.key];
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && value !== undefined && value !== '';
  });

  const totalPoints = PROFILE_FIELDS.reduce((sum, f) => sum + f.points, 0);
  const earnedPoints = completedFields.reduce((sum, f) => sum + f.points, 0);
  const remainingPoints = totalPoints - earnedPoints;
  const completionPercent = Math.round((completedFields.length / PROFILE_FIELDS.length) * 100);

  // Check if quiz fields are incomplete
  const quizFields = ['employment_status', 'industry', 'education_level', 'income_range'];
  const hasIncompleteQuizFields = quizFields.some(key => {
    const value = (profile as Record<string, unknown>)[key];
    return value === null || value === undefined || value === '';
  });

  // Don't show if profile is complete
  if (completionPercent === 100) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-5 relative overflow-hidden"
      >
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-5 w-5 text-primary" />
                <h3 className="font-display font-bold text-lg">Complete Your Profile</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Earn up to <span className="text-primary font-semibold">{remainingPoints} more points</span>
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">{completionPercent}%</div>
              <div className="text-xs text-muted-foreground">complete</div>
            </div>
          </div>

          {/* Progress Bar */}
          <Progress value={completionPercent} className="h-3 mb-4" />

          {/* Field Status */}
          <div className="flex flex-wrap gap-2 mb-4">
            {PROFILE_FIELDS.slice(0, 6).map(field => {
              const value = (profile as Record<string, unknown>)[field.key];
              const isComplete = Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && value !== '';
              
              return (
                <div
                  key={field.key}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                    isComplete 
                      ? 'bg-primary/20 text-primary' 
                      : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {isComplete && <CheckCircle2 className="h-3 w-3" />}
                  {field.label}
                </div>
              );
            })}
          </div>

          {/* CTA Button */}
          {hasIncompleteQuizFields && (
            <Button
              onClick={() => setShowQuiz(true)}
              className="w-full group"
            >
              <Gift className="mr-2 h-4 w-4" />
              Take Quick Quiz
              <ChevronRight className="ml-auto h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          )}
        </div>
      </motion.div>

      {/* Quiz Modal */}
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
