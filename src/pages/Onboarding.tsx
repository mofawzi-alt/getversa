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
const CATEGORIES = [
  { id: 'sports', label: 'Sports', icon: '⚽' },
  { id: 'music', label: 'Music', icon: '🎵' },
  { id: 'movies', label: 'Movies & TV', icon: '🎬' },
  { id: 'gaming', label: 'Gaming', icon: '🎮' },
  { id: 'food', label: 'Food & Cooking', icon: '🍕' },
  { id: 'travel', label: 'Travel', icon: '✈️' },
  { id: 'fashion', label: 'Fashion', icon: '👗' },
  { id: 'technology', label: 'Technology', icon: '💻' },
  { id: 'fitness', label: 'Fitness & Health', icon: '💪' },
  { id: 'books', label: 'Books & Reading', icon: '📚' },
  { id: 'art', label: 'Art & Design', icon: '🎨' },
  { id: 'nature', label: 'Nature & Environment', icon: '🌿' },
  { id: 'business', label: 'Business & Finance', icon: '💼' },
  { id: 'politics', label: 'Politics & News', icon: '📰' },
  { id: 'science', label: 'Science', icon: '🔬' },
  { id: 'pets', label: 'Pets & Animals', icon: '🐕' },
];
const COUNTRIES = [
  'Saudi Arabia', 'United Arab Emirates', 'Qatar', 'Kuwait', 'Bahrain', 'Oman',
  'Jordan', 'Lebanon', 'Syria', 'Iraq', 'Palestine', 'Yemen', 'Egypt'
];

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [gender, setGender] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [categoryInterests, setCategoryInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const handleComplete = async () => {
    if (!user) return;
    
    if (!username.trim()) {
      toast.error('Please enter a username');
      return;
    }
    
    setLoading(true);
    
    try {
      // Update user profile
      const { error: profileError } = await supabase
        .from('users')
        .update({
          username: username.trim(),
          age_range: ageRange,
          gender,
          country,
          city: city.trim(),
          category_interests: categoryInterests,
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
      
      // Create automation settings
      await supabase
        .from('automation_settings')
        .insert({
          user_id: user.id,
        });
      
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
    if (step === 1 && !username.trim()) {
      toast.error('Please enter a username');
      return;
    }
    setStep(step + 1);
  };

  return (
    <div className="min-h-screen flex flex-col p-6 safe-area-top safe-area-bottom">
      {/* Progress */}
      <div className="flex gap-2 mb-8">
        {[1, 2, 3, 4, 5, 6].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-all ${
              s <= step ? 'bg-gradient-primary' : 'bg-secondary'
            }`}
          />
        ))}
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full animate-slide-up">
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground mb-2">Choose your username</h1>
              <p className="text-gray-600">This is how others will see you</p>
            </div>
            
            <div className="space-y-2 bg-white rounded-xl p-4 border border-gray-200">
              <Label htmlFor="username" className="text-gray-900">Username</Label>
              <Input
                id="username"
                placeholder="@cooluser"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                className="bg-gray-50 border-gray-300 text-gray-900 placeholder:text-gray-400 text-lg h-14"
                maxLength={20}
              />
              <p className="text-xs text-gray-500">
                Only letters, numbers, and underscores
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground mb-2">How old are you?</h1>
              <p className="text-gray-600">This helps us show relevant content</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {AGE_RANGES.map((range) => (
                <button
                  key={range}
                  onClick={() => setAgeRange(range)}
                  className={`p-4 rounded-xl border-2 transition-all font-medium ${
                    ageRange === range
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-gray-300 bg-white text-gray-900 hover:border-primary/50'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground mb-2">What's your gender?</h1>
              <p className="text-gray-600">Optional but helps personalize your experience</p>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              {GENDERS.map((g) => (
                <button
                  key={g}
                  onClick={() => setGender(g)}
                  className={`p-4 rounded-xl border-2 transition-all text-left font-medium ${
                    gender === g
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-gray-300 bg-white text-gray-900 hover:border-primary/50'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground mb-2">Where are you from?</h1>
              <p className="text-gray-600">See polls from your region</p>
            </div>
            
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className="h-14 bg-white border-gray-300 text-gray-900 text-lg">
                <SelectValue placeholder="Select your country" className="text-gray-400" />
              </SelectTrigger>
              <SelectContent className="max-h-80 bg-white border-gray-200">
                {COUNTRIES.map((c) => (
                  <SelectItem key={c} value={c} className="text-gray-900">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground mb-2">What city do you live in?</h1>
              <p className="text-gray-600">Connect with your local community</p>
            </div>
            
            <div className="space-y-2 bg-white rounded-xl p-4 border border-gray-200">
              <Label htmlFor="city" className="text-gray-900">City</Label>
              <Input
                id="city"
                placeholder="Enter your city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="bg-gray-50 border-gray-300 text-gray-900 placeholder:text-gray-400 text-lg h-14"
                maxLength={50}
              />
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground mb-2">What interests you?</h1>
              <p className="text-gray-600">Select topics to get personalized polls (optional)</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
              {CATEGORIES.map((cat) => {
                const isSelected = categoryInterests.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      if (isSelected) {
                        setCategoryInterests(categoryInterests.filter(c => c !== cat.id));
                      } else {
                        setCategoryInterests([...categoryInterests, cat.id]);
                      }
                    }}
                    className={`p-3 rounded-xl border-2 transition-all text-left font-medium flex items-center gap-2 ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-gray-300 bg-white text-gray-900 hover:border-primary/50'
                    }`}
                  >
                    <span className="text-xl">{cat.icon}</span>
                    <span className="text-sm">{cat.label}</span>
                  </button>
                );
              })}
            </div>
            
            {categoryInterests.length > 0 && (
              <p className="text-sm text-primary font-medium">
                {categoryInterests.length} interest{categoryInterests.length > 1 ? 's' : ''} selected
              </p>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 mt-8">
        {step > 1 && (
          <Button
            variant="outline"
            onClick={() => setStep(step - 1)}
            className="flex-1 h-14"
          >
            Back
          </Button>
        )}
        
        {step < 6 ? (
          <Button
            onClick={nextStep}
            className="flex-1 h-14 bg-gradient-primary hover:opacity-90"
          >
            Continue
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        ) : (
          <Button
            onClick={handleComplete}
            disabled={loading}
            className="flex-1 h-14 bg-gradient-primary hover:opacity-90"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}