import { useState, useEffect } from 'react';
import VersaLogo from '@/components/VersaLogo';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff, ChevronDown, Fingerprint, ScanFace } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';
import { Link } from 'react-router-dom';
import {
  checkBiometricAvailability,
  promptBiometric,
  isBiometricEnabled,
  getBiometricEmail,
  enableBiometric,
  disableBiometric,
  isNative as isNativePlatform,
} from '@/lib/biometric';
import { hapticSuccess, hapticError } from '@/lib/haptics';
import SocialAuthButtons from '@/components/auth/SocialAuthButtons';

const AGE_RANGES = ['Under 18', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
const GENDERS = ['Male', 'Female'];
const COUNTRIES = [
  'Egypt', 'Saudi Arabia', 'United Arab Emirates', 'Qatar', 'Kuwait', 'Bahrain', 'Oman',
  'Jordan', 'Lebanon', 'Syria', 'Iraq', 'Palestine', 'Yemen'
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

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const selectClass = "flex h-10 w-full rounded-md border border-input bg-secondary/80 px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm text-foreground appearance-none cursor-pointer border-border/50 focus:border-accent focus:ring-accent/30";

export default function Auth() {
  const [searchParams] = useSearchParams();
  const isSignupMode = searchParams.get('mode') === 'signup';
  const isVoteIntent = searchParams.get('reason') === 'vote';
  const [isLogin, setIsLogin] = useState(!isSignupMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [gender, setGender] = useState('');
  const [country, setCountry] = useState(detectCountry());
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [ageConfirm, setAgeConfirm] = useState(false);
  const { user, session, signIn, signUp, refreshProfile } = useAuth();
  const navigate = useNavigate();

  // Biometric state (Face ID / Touch ID on native)
  const [bioType, setBioType] = useState<'face' | 'fingerprint' | 'iris' | 'generic' | 'none'>('none');
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioEmail, setBioEmail] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const info = await checkBiometricAvailability();
      setBioAvailable(info.available);
      setBioType(info.type);
      setBioEnabled(isBiometricEnabled());
      setBioEmail(getBiometricEmail());
    })();
  }, []);

  // Auto-trigger Face ID on launch if previously enrolled and we're on the login screen
  useEffect(() => {
    if (!isNativePlatform()) return;
    if (!isLogin) return;
    if (!bioAvailable || !bioEnabled || !bioEmail) return;
    if (user) return;
    // Only auto-prompt once per mount
    let cancelled = false;
    (async () => {
      // First, check if we already have a session (AuthContext may have restored from Keychain)
      const { data: pre } = await supabase.auth.getSession();
      if (pre.session) {
        // No need to prompt — session is alive. AuthContext will redirect.
        return;
      }
      const result = await promptBiometric(`Sign in as ${bioEmail}`);
      if (cancelled || !result.ok) return;
      // After Face ID, re-check session (Keychain restore may have happened)
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        hapticSuccess();
        toast.success('Welcome back!');
        navigate('/home', { replace: true });
      } else {
        // Session truly expired and refresh token is gone — user must re-enter password
        setEmail(bioEmail);
        toast('Enter your password to finish signing in', { duration: 3000 });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bioAvailable, bioEnabled, bioEmail, isLogin]);

  // Redirect authenticated users to home
  useEffect(() => {
    if (user) navigate('/home', { replace: true });
  }, [user, navigate]);

  // Reset city when country changes
  useEffect(() => { setCity(''); }, [country]);

  const availableCities = CITIES[country] || [];

  const bioLabel = bioType === 'face' ? 'Face ID' : bioType === 'fingerprint' ? 'Touch ID' : 'Biometrics';
  const BioIcon = bioType === 'face' ? ScanFace : Fingerprint;

  const handleBiometricUnlock = async () => {
    if (!bioAvailable || !bioEnabled || !bioEmail) return;
    const result = await promptBiometric(`Sign in as ${bioEmail}`);
    if (!result.ok) { hapticError(); return; }
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      hapticSuccess();
      toast.success('Welcome back!');
      navigate('/home', { replace: true });
    } else {
      setEmail(bioEmail);
      toast(`Session expired — enter your password to re-enable ${bioLabel}`, { duration: 3500 });
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLogin) {
      // Login — only email + password
      const validation = loginSchema.safeParse({ email, password });
      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        return;
      }
      setLoading(true);
      try {
        const { error } = await signIn(email, password);
        if (error) {
          hapticError();
          toast.error(error.message.includes('Invalid login credentials') ? 'Invalid email or password' : error.message);
        } else {
          hapticSuccess();
          toast.success('Welcome back!');
          // Offer to enable biometrics on first successful native login
          if (isNativePlatform() && bioAvailable && !bioEnabled) {
            const result = await promptBiometric(`Enable ${bioLabel} for faster sign-in?`);
            if (result.ok) {
              enableBiometric(email);
              toast.success(`${bioLabel} enabled`);
            }
          } else if (bioEnabled && bioEmail !== email) {
            // Re-enroll for the new account
            enableBiometric(email);
          }
          navigate('/home');
        }
      } catch { toast.error('An unexpected error occurred'); }
      finally { setLoading(false); }
      return;
    }

    // Signup — validate all fields
    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) { toast.error(validation.error.errors[0].message); return; }
    if (!name.trim()) { toast.error('Please enter your name'); return; }
    if (!ageRange) { toast.error('Please select your age range'); return; }
    if (!gender) { toast.error('Please select your gender'); return; }
    if (!city) { toast.error('Please select your city'); return; }

    setLoading(true);
    try {
      const { error } = await signUp(email, password);
      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('This email is already registered. Please sign in instead.');
        } else {
          toast.error(error.message);
        }
        setLoading(false);
        return;
      }

      // Wait briefly for auth to settle, then save profile
      // The AuthContext auto-creates the user row; we just update it
      const { data: { user: newUser } } = await supabase.auth.getUser();
      if (newUser) {
        const { error: profileError } = await supabase
          .from('users')
          .upsert({
            id: newUser.id,
            email: newUser.email || '',
            username: name.trim(),
            age_range: ageRange,
            gender,
            country,
            city,
          }, { onConflict: 'id' });

        if (profileError) {
          console.error('Profile save error:', profileError);
        }

        await supabase.from('automation_settings').upsert({ user_id: newUser.id }, { onConflict: 'user_id' });
        await refreshProfile();
      }

      toast.success('Welcome to Versa! 🔥');

      // If they came from trying to vote, go home (vote intent poll handled there)
      navigate('/home', { replace: true });
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-6 pt-12 safe-area-top safe-area-bottom bg-background relative overflow-y-auto">
      {/* Minimal background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="absolute w-[400px] h-[400px] rounded-full border border-primary/10 opacity-40" />
        <div className="absolute w-[250px] h-[250px] rounded-full border border-accent/10 opacity-30" />
      </div>

      <div className="w-full max-w-sm space-y-6 animate-slide-up relative z-10">
        <div className="text-center flex flex-col items-center">
          <VersaLogo size="lg" />
          {isVoteIntent && !isLogin ? (
            <p className="text-foreground font-display font-bold mt-2 text-sm">Sign up free to add your vote 🔥<br /><span className="text-muted-foreground font-normal text-xs">Takes 30 seconds</span></p>
          ) : (
            <p className="text-muted-foreground mt-2">{isLogin ? 'Welcome back.' : 'Join the conversation'}</p>
          )}
        </div>

        {/* Auth Form */}
        <div className="bg-card/80 backdrop-blur-lg rounded-2xl p-5 shadow-card border border-border/50">
          {/* Social sign-in (Apple required by App Store guideline 4.8) */}
          <SocialAuthButtons mode={isLogin ? 'signin' : 'signup'} />

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">or {isLogin ? 'sign in with email' : 'with email'}</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Signup-only fields */}
            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-card-foreground text-xs">Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-secondary/80 border-border/50 text-card-foreground placeholder:text-muted-foreground focus:border-accent focus:ring-accent/30 h-10"
                  disabled={loading}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-card-foreground text-xs">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-secondary/80 border-border/50 text-card-foreground placeholder:text-muted-foreground focus:border-accent focus:ring-accent/30 h-10"
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-card-foreground text-xs">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-secondary/80 border-border/50 pr-10 text-card-foreground placeholder:text-muted-foreground focus:border-accent focus:ring-accent/30 h-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-accent transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Signup-only demographic fields */}
            {!isLogin && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-card-foreground text-xs">Age range</Label>
                  <div className="relative">
                    <select
                      value={ageRange}
                      onChange={(e) => setAgeRange(e.target.value)}
                      className={selectClass}
                      disabled={loading}
                    >
                      <option value="" disabled>Select age range</option>
                      {AGE_RANGES.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-card-foreground text-xs">Gender</Label>
                  <div className="relative">
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className={selectClass}
                      disabled={loading}
                    >
                      <option value="" disabled>Select gender</option>
                      {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-card-foreground text-xs">Country</Label>
                  <div className="relative">
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className={selectClass}
                      disabled={loading}
                    >
                      <option value="" disabled>Select country</option>
                      {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-card-foreground text-xs">City</Label>
                  <div className="relative">
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className={selectClass}
                      disabled={loading || !country}
                    >
                      <option value="" disabled>{country ? 'Select city' : 'Select country first'}</option>
                      {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                <div className="flex items-start gap-2 mt-1">
                  <Checkbox
                    id="age-confirm"
                    checked={ageConfirm}
                    onCheckedChange={(checked) => setAgeConfirm(checked === true)}
                    disabled={loading}
                    className="mt-0.5"
                  />
                  <label htmlFor="age-confirm" className="text-xs text-muted-foreground leading-tight cursor-pointer">
                    I confirm that I am 18 years of age or older and agree to the{' '}
                    <Link to="/terms" className="text-accent underline">Terms of Service</Link> and{' '}
                    <Link to="/privacy-policy" className="text-accent underline">Privacy Policy</Link>
                  </label>
                </div>
              </>
            )}

            <Button
              type="submit"
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold h-12 rounded-full shadow-accent transition-all hover:scale-[1.02] mt-2"
              disabled={loading || (!isLogin && !ageConfirm)}
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isLogin ? (
                'Sign In'
              ) : (
                'Join Versa'
              )}
            </Button>

            {/* Face ID / Touch ID quick unlock — only on native, only after first enrollment */}
            {isLogin && isNativePlatform() && bioAvailable && bioEnabled && bioEmail && (
              <Button
                type="button"
                variant="outline"
                onClick={handleBiometricUnlock}
                className="w-full h-12 rounded-full mt-2 gap-2"
              >
                <BioIcon className="h-5 w-5" />
                Sign in with {bioLabel}
              </Button>
            )}
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <span className="text-accent font-medium hover:underline">
                {isLogin ? 'Sign up' : 'Sign in'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
