import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, ArrowRight } from 'lucide-react';

const AGE_RANGES = ['13-17', '18-24', '25-34', '35-44', '45-54', '55+'];
const GENDERS = ['Male', 'Female'];
const COUNTRIES = [
  'Saudi Arabia', 'United Arab Emirates', 'Qatar', 'Kuwait', 'Bahrain', 'Oman',
  'Jordan', 'Lebanon', 'Syria', 'Iraq', 'Palestine', 'Yemen', 'Egypt'
];

const INTRO_SLIDES = [
  { title: 'Your opinion. Structured.', subtitle: 'VERSA captures what people really think — one vote at a time.' },
  { title: 'Vote in 3 seconds.', subtitle: 'Swipe or tap. No overthinking. Just pick your side.' },
  { title: 'See how people like you think.', subtitle: 'Instant results. Real data. Your voice matters.' },
];

export default function Onboarding() {
  const [step, setStep] = useState(0); // 0-2 = intro slides, 3-6 = profile steps
  const [username, setUsername] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [gender, setGender] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const totalSteps = 7; // 3 intro + 4 profile (username, age, gender, country)

  const handleComplete = async () => {
    if (!user) return;
    if (!username.trim()) { toast.error('Please enter a username'); return; }
    if (!ageRange) { toast.error('Please select your age range'); return; }
    if (!gender) { toast.error('Please select your gender'); return; }
    if (!country) { toast.error('Please select your country'); return; }

    setLoading(true);
    try {
      const { error: profileError } = await supabase
        .from('users')
        .update({
          username: username.trim(),
          age_range: ageRange,
          gender,
          country,
          city: city.trim() || null,
        })
        .eq('id', user.id);

      if (profileError) {
        if (profileError.message.includes('duplicate')) {
          toast.error('This username is already taken');
          setLoading(false);
          return;
        }
        throw profileError;
      }

      await supabase.from('automation_settings').insert({ user_id: user.id });
      await refreshProfile();
      toast.success('Welcome to VERSA!');
      navigate('/');
    } catch (err) {
      toast.error('Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (step === 3 && !username.trim()) { toast.error('Please enter a username'); return; }
    if (step === 4 && !ageRange) { toast.error('Please select your age range'); return; }
    if (step === 5 && !gender) { toast.error('Please select your gender'); return; }
    setStep(step + 1);
  };

  const isIntroSlide = step < 3;

  return (
    <div className="min-h-screen flex flex-col p-6 safe-area-top safe-area-bottom">
      {/* Top bar: Progress + Skip */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex gap-2 flex-1">
          {Array.from({ length: totalSteps }).map((_, s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-all ${
                s <= step ? 'bg-gradient-primary' : 'bg-secondary'
              }`}
            />
          ))}
        </div>
        {isIntroSlide && (
          <button
            onClick={() => setStep(3)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full animate-slide-up">
        {/* Intro Slides */}
        {isIntroSlide && (
          <div className="space-y-6 text-center">
            <div className="text-6xl mb-4">
              {step === 0 ? '📊' : step === 1 ? '⚡' : '🌍'}
            </div>
            <h1 className="text-3xl font-display font-bold text-foreground">
              {INTRO_SLIDES[step].title}
            </h1>
            <p className="text-foreground/60 text-lg">
              {INTRO_SLIDES[step].subtitle}
            </p>
          </div>
        )}

        {/* Step 3: Username */}
        {step === 3 && (
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
              />
              <p className="text-xs text-muted-foreground">Only letters, numbers, and underscores</p>
            </div>
          </div>
        )}

        {/* Step 4: Age (REQUIRED) */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground mb-2">How old are you?</h1>
              <p className="text-foreground/60">Required for personalized content</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {AGE_RANGES.map((range) => (
                <button
                  key={range}
                  onClick={() => setAgeRange(range)}
                  className={`p-4 rounded-xl border-2 transition-all font-medium ${
                    ageRange === range
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-foreground hover:border-primary/50'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Gender (REQUIRED) */}
        {step === 5 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground mb-2">What's your gender?</h1>
              <p className="text-foreground/60">Required for demographic insights</p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {GENDERS.map((g) => (
                <button
                  key={g}
                  onClick={() => setGender(g)}
                  className={`p-4 rounded-xl border-2 transition-all text-left font-medium ${
                    gender === g
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-foreground hover:border-primary/50'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 6: Country (REQUIRED) */}
        {step === 6 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground mb-2">Where are you from?</h1>
              <p className="text-foreground/60">Required — see polls from your region</p>
            </div>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className="h-14 text-lg">
                <SelectValue placeholder="Select your country" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {COUNTRIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="space-y-2">
              <Label htmlFor="city">City (optional)</Label>
              <Input
                id="city"
                placeholder="Enter your city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="text-lg h-14"
                maxLength={50}
              />
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 mt-8">
        {step > 0 && (
          <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1 h-14">
            Back
          </Button>
        )}
        
        {step < 6 ? (
          <Button onClick={nextStep} className="flex-1 h-14 bg-gradient-primary hover:opacity-90">
            {isIntroSlide ? 'Next' : 'Continue'}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        ) : (
          <Button onClick={handleComplete} disabled={loading} className="flex-1 h-14 bg-gradient-primary hover:opacity-90">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
              <>Get Started<ArrowRight className="ml-2 h-5 w-5" /></>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
