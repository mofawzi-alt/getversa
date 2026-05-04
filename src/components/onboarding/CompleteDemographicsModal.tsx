import { useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const AGE_RANGES = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
const GENDERS = ['Male', 'Female'];
const COUNTRIES = [
  'Egypt', 'Saudi Arabia', 'United Arab Emirates', 'Qatar', 'Kuwait', 'Bahrain', 'Oman',
  'Jordan', 'Lebanon', 'Iraq', 'Syria', 'Palestine', 'Morocco', 'Algeria', 'Tunisia', 'Libya', 'Sudan', 'Yemen',
];
const CITIES: Record<string, string[]> = {
  'Egypt': ['Cairo', 'Alexandria', 'Giza', 'Shubra El Kheima', 'Port Said', 'Suez', 'Luxor', 'Mansoura', 'El-Mahalla El-Kubra', 'Tanta', 'Asyut', 'Ismailia', 'Fayyum', 'Zagazig', 'Aswan', 'Damietta', 'Damanhur', 'Beni Suef', 'Hurghada', 'Sharm El Sheikh', 'Other'],
  'Saudi Arabia': ['Riyadh', 'Jeddah', 'Mecca', 'Medina', 'Dammam', 'Khobar', 'Tabuk', 'Abha', 'Other'],
  'United Arab Emirates': ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain', 'Al Ain', 'Other'],
  'Qatar': ['Doha', 'Al Wakrah', 'Al Khor', 'Lusail', 'Al Rayyan', 'Umm Salal', 'Other'],
  'Kuwait': ['Kuwait City', 'Hawalli', 'Salmiya', 'Farwaniya', 'Jahra', 'Ahmadi', 'Mangaf', 'Other'],
  'Bahrain': ['Manama', 'Muharraq', 'Riffa', 'Hamad Town', 'Isa Town', 'Sitra', 'Other'],
  'Oman': ['Muscat', 'Salalah', 'Sohar', 'Nizwa', 'Sur', 'Ibri', 'Barka', 'Rustaq', 'Other'],
};

const selectClass = "flex h-11 w-full rounded-xl border border-border bg-secondary/60 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none cursor-pointer";

export default function CompleteDemographicsModal() {
  const { user, profile, refreshProfile } = useAuth();
  const [ageRange, setAgeRange] = useState(profile?.age_range || '');
  const [gender, setGender] = useState(profile?.gender || '');
  const [country, setCountry] = useState(profile?.country || 'Egypt');
  const [city, setCity] = useState(profile?.city || '');
  const [loading, setLoading] = useState(false);

  const cities = CITIES[country] || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!ageRange) return toast.error('Please select your age range');
    if (!gender) return toast.error('Please select your gender');
    if (!city) return toast.error('Please select your city');

    setLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ age_range: ageRange, gender, country, city })
        .eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success('Profile completed!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-background flex items-center justify-center p-4 overflow-y-auto">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5 py-6">
        <div className="text-center space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Almost there</p>
          <h1 className="text-2xl font-bold text-foreground">Tell us about you</h1>
          <p className="text-sm text-muted-foreground">
            Takes 10 seconds. Helps us show you what people like you are voting on.
          </p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Age range</Label>
            <div className="relative">
              <select value={ageRange} onChange={(e) => setAgeRange(e.target.value)} className={selectClass} disabled={loading}>
                <option value="" disabled>Select age range</option>
                {AGE_RANGES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Gender</Label>
            <div className="relative">
              <select value={gender} onChange={(e) => setGender(e.target.value)} className={selectClass} disabled={loading}>
                <option value="" disabled>Select gender</option>
                {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Country</Label>
            <div className="relative">
              <select value={country} onChange={(e) => { setCountry(e.target.value); setCity(''); }} className={selectClass} disabled={loading}>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">City</Label>
            <div className="relative">
              <select value={city} onChange={(e) => setCity(e.target.value)} className={selectClass} disabled={loading || cities.length === 0}>
                <option value="" disabled>Select city</option>
                {cities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        </div>

        <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl font-bold">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continue'}
        </Button>

        <p className="text-[10px] text-center text-muted-foreground">
          Your info is private. Used only to personalize your feed.
        </p>
      </form>
    </div>
  );
}
