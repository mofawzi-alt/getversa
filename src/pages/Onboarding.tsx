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

const CITIES: Record<string, string[]> = {
  'Saudi Arabia': ['Riyadh', 'Jeddah', 'Mecca', 'Medina', 'Dammam', 'Khobar', 'Dhahran', 'Tabuk', 'Abha', 'Taif', 'Jubail', 'Yanbu', 'Buraidah', 'Najran', 'Hail', 'Jazan'],
  'United Arab Emirates': ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain', 'Al Ain'],
  'Qatar': ['Doha', 'Al Wakrah', 'Al Khor', 'Lusail', 'Al Rayyan', 'Umm Salal'],
  'Kuwait': ['Kuwait City', 'Hawalli', 'Salmiya', 'Farwaniya', 'Jahra', 'Ahmadi', 'Mangaf'],
  'Bahrain': ['Manama', 'Muharraq', 'Riffa', 'Hamad Town', 'Isa Town', 'Sitra'],
  'Oman': ['Muscat', 'Salalah', 'Sohar', 'Nizwa', 'Sur', 'Ibri', 'Barka', 'Rustaq'],
  'Jordan': ['Amman', 'Zarqa', 'Irbid', 'Aqaba', 'Madaba', 'Salt', 'Jerash', 'Mafraq'],
  'Lebanon': ['Beirut', 'Tripoli', 'Sidon', 'Tyre', 'Jounieh', 'Byblos', 'Zahle', 'Baalbek'],
  'Syria': ['Damascus', 'Aleppo', 'Homs', 'Latakia', 'Hama', 'Tartus', 'Deir ez-Zor', 'Raqqa'],
  'Iraq': ['Baghdad', 'Basra', 'Erbil', 'Mosul', 'Sulaymaniyah', 'Najaf', 'Karbala', 'Kirkuk', 'Duhok'],
  'Palestine': ['Ramallah', 'Gaza', 'Nablus', 'Hebron', 'Bethlehem', 'Jenin', 'Tulkarm', 'Jericho'],
  'Yemen': ['Sanaa', 'Aden', 'Taiz', 'Hodeidah', 'Mukalla', 'Ibb', 'Dhamar'],
  'Egypt': ['Cairo', 'Alexandria', 'Giza', 'Sharm El Sheikh', 'Hurghada', 'Luxor', 'Aswan', 'Mansoura', 'Tanta', 'Port Said', 'Suez', 'Ismailia'],
};

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

  const totalSteps = 8; // 3 intro + 5 profile (username, age, gender, country, city)

  const handleComplete = async () => {
    if (!user) return;
    if (!username.trim()) { toast.error('Please enter a username'); return; }
    if (!ageRange) { toast.error('Please select your age range'); return; }
    if (!gender) { toast.error('Please select your gender'); return; }
    if (!country) { toast.error('Please select your country'); return; }
    if (!city) { toast.error('Please select your city'); return; }

    setLoading(true);
    try {
      // Upsert user profile (handles both new and existing users)
      const { error: profileError } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          email: user.email || '',
          username: username.trim(),
          age_range: ageRange,
          gender,
          country,
          city,
        }, { onConflict: 'id' });

      if (profileError) {
        if (profileError.message.includes('duplicate') && profileError.message.includes('username')) {
          toast.error('This username is already taken');
          setLoading(false);
          return;
        }
        throw profileError;
      }

      // Upsert automation settings (ignore if exists)
      await supabase.from('automation_settings').upsert({ user_id: user.id }, { onConflict: 'user_id' });
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
    if (step === 6 && !country) { toast.error('Please select your country'); return; }
    // Reset city when moving past country step if country changed
    if (step === 6) { setCity(''); }
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
            <Select value={country} onValueChange={(v) => { setCountry(v); setCity(''); }}>
              <SelectTrigger className="h-14 text-lg">
                <SelectValue placeholder="Select your country" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {COUNTRIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Step 7: City (REQUIRED) */}
        {step === 7 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground mb-2">What city are you in?</h1>
              <p className="text-foreground/60">Required — helps with local polls</p>
            </div>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger className="h-14 text-lg">
                <SelectValue placeholder="Select your city" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {(CITIES[country] || []).map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
        
        {step < 7 ? (
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
