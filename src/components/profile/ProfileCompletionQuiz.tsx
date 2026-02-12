import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  ChevronRight, ChevronLeft, X, Gift, Sparkles,
  Briefcase, GraduationCap, DollarSign, Building2
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const INCOME_RANGES = [
  'Under $25k',
  '$25k - $50k',
  '$50k - $75k',
  '$75k - $100k',
  '$100k - $150k',
  '$150k+',
  'Prefer not to say',
];

const EMPLOYMENT_STATUSES = [
  'Full-time employed',
  'Part-time employed',
  'Self-employed',
  'Freelancer',
  'Student',
  'Retired',
  'Unemployed',
  'Prefer not to say',
];

const INDUSTRIES = [
  'Technology',
  'Healthcare',
  'Finance',
  'Education',
  'Retail',
  'Manufacturing',
  'Entertainment',
  'Government',
  'Non-profit',
  'Real Estate',
  'Hospitality',
  'Other',
];

const EDUCATION_LEVELS = [
  'High School',
  'Some College',
  'Associate Degree',
  "Bachelor's Degree",
  "Master's Degree",
  'Doctorate',
  'Trade/Vocational',
  'Prefer not to say',
];

interface QuizStep {
  key: 'employment_status' | 'industry' | 'education_level' | 'income_range';
  title: string;
  subtitle: string;
  icon: typeof Briefcase;
  options: string[];
  points: number;
}

const QUIZ_STEPS: QuizStep[] = [
  {
    key: 'employment_status',
    title: 'What describes your work situation?',
    subtitle: 'Help us understand your lifestyle',
    icon: Briefcase,
    options: EMPLOYMENT_STATUSES,
    points: 25,
  },
  {
    key: 'industry',
    title: 'What industry do you work in?',
    subtitle: 'This helps with relevant polls',
    icon: Building2,
    options: INDUSTRIES,
    points: 25,
  },
  {
    key: 'education_level',
    title: "What's your education level?",
    subtitle: 'Used for research insights',
    icon: GraduationCap,
    options: EDUCATION_LEVELS,
    points: 25,
  },
  {
    key: 'income_range',
    title: 'What is your income range?',
    subtitle: 'This stays completely private',
    icon: DollarSign,
    options: INCOME_RANGES,
    points: 25,
  },
];

interface ProfileCompletionQuizProps {
  onClose: () => void;
  onComplete: () => void;
}

export default function ProfileCompletionQuiz({ onClose, onComplete }: ProfileCompletionQuizProps) {
  const { profile, refreshProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const step = QUIZ_STEPS[currentStep];
  const progress = ((currentStep + 1) / QUIZ_STEPS.length) * 100;
  const totalPoints = QUIZ_STEPS.reduce((sum, s) => sum + s.points, 0);

  const handleSelect = (value: string) => {
    setAnswers(prev => ({ ...prev, [step.key]: value }));
  };

  const handleNext = async () => {
    if (currentStep < QUIZ_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Submit all answers
      setIsSubmitting(true);
      try {
        const pointsEarned = Object.keys(answers).length * 25;
        
        const { error } = await supabase
          .from('users')
          .update({
            ...answers,
            points: (profile?.points || 0) + pointsEarned,
          })
          .eq('id', profile?.id);

        if (error) throw error;

        await refreshProfile();
        toast.success(`+${pointsEarned} points earned!`, {
          icon: <Gift className="h-5 w-5 text-primary" />,
        });
        onComplete();
      } catch (error) {
        console.error('Error saving profile:', error);
        toast.error('Failed to save profile');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleSkip = () => {
    if (currentStep < QUIZ_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleNext();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const Icon = step.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm"
    >
      <div className="h-full flex flex-col max-w-lg mx-auto">
        {/* Header */}
        <div className="p-4 flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className="p-2 rounded-full hover:bg-secondary/50 disabled:opacity-0"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="font-medium">Complete Profile</span>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-secondary/50"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Progress */}
        <div className="px-6 pb-4">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between mt-2 text-sm text-muted-foreground">
            <span>Step {currentStep + 1} of {QUIZ_STEPS.length}</span>
            <span className="text-primary font-medium">+{totalPoints} pts available</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Question Header */}
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Icon className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-2xl font-display font-bold">{step.title}</h2>
                <p className="text-muted-foreground mt-2">{step.subtitle}</p>
                <div className="inline-flex items-center gap-1 mt-3 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                  <Gift className="h-4 w-4" />
                  +{step.points} points
                </div>
              </div>

              {/* Options */}
              <div className="grid gap-2">
                {step.options.map((option) => (
                  <button
                    key={option}
                    onClick={() => handleSelect(option)}
                    className={cn(
                      "w-full p-4 rounded-xl text-left transition-all duration-200",
                      "border-2 hover:border-primary/50",
                      answers[step.key] === option
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-card text-card-foreground"
                    )}
                  >
                    <span className="font-medium">{option}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-6 space-y-3">
          <Button
            onClick={handleNext}
            disabled={!answers[step.key] || isSubmitting}
            className="w-full h-14 text-lg font-semibold"
          >
            {isSubmitting ? (
              'Saving...'
            ) : currentStep === QUIZ_STEPS.length - 1 ? (
              'Complete & Earn Points'
            ) : (
              <>
                Continue
                <ChevronRight className="ml-2 h-5 w-5" />
              </>
            )}
          </Button>
          
          <Button
            variant="ghost"
            onClick={handleSkip}
            disabled={isSubmitting}
            className="w-full text-muted-foreground"
          >
            Skip this question
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
