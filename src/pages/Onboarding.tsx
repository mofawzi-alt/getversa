import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, ArrowRight, Check, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AGE_RANGES = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
const GENDERS = ['Male', 'Female', 'Prefer not to say'];
const COUNTRIES = [
  'Saudi Arabia', 'United Arab Emirates', 'Qatar', 'Kuwait', 'Bahrain', 'Oman',
  'Jordan', 'Lebanon', 'Syria', 'Iraq', 'Palestine', 'Yemen', 'Egypt'
];

// Try to detect country from timezone
function detectCountry(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz.includes('Riyadh')) return 'Saudi Arabia';
    if (tz.includes('Dubai')) return 'United Arab Emirates';
    if (tz.includes('Qatar') || tz.includes('Doha')) return 'Qatar';
    if (tz.includes('Kuwait')) return 'Kuwait';
    if (tz.includes('Bahrain')) return 'Bahrain';
    if (tz.includes('Muscat')) return 'Oman';
    if (tz.includes('Amman')) return 'Jordan';
    if (tz.includes('Beirut')) return 'Lebanon';
    if (tz.includes('Damascus')) return 'Syria';
    if (tz.includes('Baghdad')) return 'Iraq';
    if (tz.includes('Gaza') || tz.includes('Hebron')) return 'Palestine';
    if (tz.includes('Aden')) return 'Yemen';
    if (tz.includes('Cairo')) return 'Egypt';
  } catch {}
  return '';
}

export default function Onboarding() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  // Determine which steps are needed based on existing profile data
  const allSteps = useMemo(() => {
    const steps: ('username' | 'age' | 'gender' | 'nationality' | 'city_of_residence')[] = [];
    if (!profile?.username) steps.push('username');
    if (!profile?.age_range) steps.push('age');
    if (!profile?.gender) steps.push('gender');
    if (!(profile as any)?.nationality && !profile?.country) steps.push('nationality');
    if (!(profile as any)?.city_of_residence && !profile?.city) steps.push('city_of_residence');
    // If somehow all fields are filled, show all (shouldn't happen)
    if (steps.length === 0) return ['username', 'age', 'gender', 'nationality', 'city_of_residence'] as const;
    return steps;
  }, [profile]);

  const totalSteps = allSteps.length;
  const [stepIndex, setStepIndex] = useState(0);
  const currentStep = allSteps[stepIndex] || allSteps[0];

  const [username, setUsername] = useState(profile?.username || '');
  const [ageRange, setAgeRange] = useState(profile?.age_range || '');
  const [gender, setGender] = useState(profile?.gender || '');
  const [nationality, setNationality] = useState((profile as any)?.nationality || profile?.country || detectCountry());
  const [cityOfResidence, setCityOfResidence] = useState((profile as any)?.city_of_residence || profile?.city || '');
  const [loading, setLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Pre-fill from profile if it loads later
  useEffect(() => {
    if (profile) {
      if (profile.username && !username) setUsername(profile.username);
      if (profile.age_range && !ageRange) setAgeRange(profile.age_range);
      if (profile.gender && !gender) setGender(profile.gender);
      if ((profile as any)?.nationality && !nationality) setNationality((profile as any).nationality);
      else if (profile.country && !nationality) setNationality(profile.country);
      if ((profile as any)?.city_of_residence && !cityOfResidence) setCityOfResidence((profile as any).city_of_residence);
      else if (profile.city && !cityOfResidence) setCityOfResidence(profile.city);
    }
  }, [profile]);

  const handleComplete = async () => {
    if (!user) return;
    if (!username.trim()) { toast.error('Please enter a username'); return; }
    if (!ageRange) { toast.error('Please select your age range'); return; }
    if (!gender) { toast.error('Please select your gender'); return; }
    if (!nationality) { toast.error('Please select your nationality'); return; }
    if (!cityOfResidence.trim()) { toast.error('Please enter your city'); return; }

    setLoading(true);
    try {
      const { error: profileError } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          email: user.email || '',
          username: username.trim(),
          age_range: ageRange,
          gender,
          country: nationality,
          city: cityOfResidence.trim(),
          nationality,
          city_of_residence: cityOfResidence.trim(),
        } as any, { onConflict: 'id' });

      if (profileError) {
        if (profileError.message.includes('duplicate') && profileError.message.includes('username')) {
          toast.error('This username is already taken');
          setLoading(false);
          return;
        }
        throw profileError;
      }

      await supabase.from('automation_settings').upsert({ user_id: user.id }, { onConflict: 'user_id' });
      await refreshProfile();

      // Show confirmation then redirect to voting
      setShowConfirmation(true);
      setTimeout(() => {
        navigate('/vote');
      }, 2000);
    } catch (err) {
      toast.error('Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (currentStep === 'username' && !username.trim()) { toast.error('Please enter a username'); return; }
    if (currentStep === 'age' && !ageRange) { toast.error('Please select your age range'); return; }
    if (currentStep === 'gender' && !gender) { toast.error('Please select your gender'); return; }
    if (currentStep === 'nationality' && !nationality) { toast.error('Please select your nationality'); return; }
    if (currentStep === 'city_of_residence' && !cityOfResidence.trim()) { toast.error('Please enter your city'); return; }
    setStepIndex(stepIndex + 1);
  };

  // Confirmation screen
  if (showConfirmation) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="flex flex-col items-center gap-4 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Check className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">Your insights are now personalized</h1>
          <p className="text-muted-foreground text-sm">Taking you back to voting...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col p-6 safe-area-top safe-area-bottom bg-background">
      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex gap-1.5 flex-1">
          {Array.from({ length: totalSteps }).map((_, s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                s <= stepIndex ? 'bg-gradient-primary' : 'bg-secondary'
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-muted-foreground font-medium">{stepIndex + 1}/{totalSteps}</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.2 }}
          className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full"
        >
          {/* Step 0: Username */}
          {currentStep === 'username' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-display font-bold text-foreground mb-2">Choose your username</h1>
                <p className="text-foreground/60">This is how others will see you</p>
              </div>
              <div className="space-y-2 bg-card rounded-xl p-4 border border-border">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="@cooluser"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className="text-lg h-14"
                  maxLength={20}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">Only letters, numbers, and underscores</p>
              </div>
            </div>
          )}

          {/* Step 1: Age (chips) */}
          {currentStep === 'age' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-display font-bold text-foreground mb-2">How old are you?</h1>
                <p className="text-foreground/60">Help us show you better comparisons</p>
              </div>
              <div className="flex flex-wrap gap-3">
                {AGE_RANGES.map((range) => (
                  <button
                    key={range}
                    onClick={() => setAgeRange(range)}
                    className={`px-5 py-3 rounded-full border-2 transition-all font-medium text-sm ${
                      ageRange === range
                        ? 'border-primary bg-primary/10 text-primary scale-105'
                        : 'border-border bg-card text-foreground hover:border-primary/50'
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Your details are never shared or shown publicly — we use them only to show you how people like you voted.
              </p>
            </div>
          )}

          {/* Step 2: Gender (buttons) */}
          {currentStep === 'gender' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-display font-bold text-foreground mb-2">What's your gender?</h1>
                <p className="text-foreground/60">Help us show you better comparisons</p>
              </div>
              <div className="flex flex-col gap-3">
                {GENDERS.map((g) => (
                  <button
                    key={g}
                    onClick={() => setGender(g)}
                    className={`p-4 rounded-xl border-2 transition-all font-medium text-center ${
                      gender === g
                        ? 'border-primary bg-primary/10 text-primary scale-[1.02]'
                        : 'border-border bg-card text-foreground hover:border-primary/50'
                    }`}
                  >
                    {g === 'Male' ? '👨' : g === 'Female' ? '👩' : '🙂'} {g}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Your details are never shared or shown publicly — we use them only to show you how people like you voted.
              </p>
            </div>
          )}

          {/* Step 3: Nationality (country selector dropdown) */}
          {currentStep === 'nationality' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-display font-bold text-foreground mb-2">Where are you from?</h1>
                <p className="text-foreground/60">
                  {nationality ? `Detected: ${nationality}` : 'Select your nationality'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto scrollbar-hide">
                {COUNTRIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNationality(c)}
                    className={`p-3 rounded-xl border-2 transition-all text-sm font-medium text-left ${
                      nationality === c
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card text-foreground hover:border-primary/50'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: City of residence (free text) */}
          {currentStep === 'city_of_residence' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-display font-bold text-foreground mb-2">Which city do you live in?</h1>
                <p className="text-foreground/60">Helps with local polls</p>
              </div>
              <div className="space-y-2 bg-card rounded-xl p-4 border border-border">
                <Label htmlFor="city_of_residence">City</Label>
                <Input
                  id="city_of_residence"
                  placeholder="e.g. Cairo, Dubai, Riyadh..."
                  value={cityOfResidence}
                  onChange={(e) => setCityOfResidence(e.target.value)}
                  className="text-lg h-14"
                  maxLength={100}
                  autoFocus
                />
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex gap-3 mt-6">
        {stepIndex > 0 && (
          <Button variant="outline" onClick={() => setStepIndex(stepIndex - 1)} className="flex-1 h-14 rounded-xl">
            Back
          </Button>
        )}
        
        {stepIndex < totalSteps - 1 ? (
          <Button onClick={nextStep} className="flex-1 h-14 bg-gradient-primary hover:opacity-90 rounded-xl">
            Continue
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        ) : (
          <Button onClick={handleComplete} disabled={loading || !cityOfResidence.trim()} className="flex-1 h-14 bg-gradient-primary hover:opacity-90 rounded-xl">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
              <>Get Started<ArrowRight className="ml-2 h-5 w-5" /></>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
