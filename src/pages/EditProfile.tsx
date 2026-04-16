import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Save, Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

const AGE_RANGES = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];
const COUNTRIES = [
  'Saudi Arabia', 'United Arab Emirates', 'Qatar', 'Kuwait', 'Bahrain', 'Oman',
  'Jordan', 'Lebanon', 'Syria', 'Iraq', 'Palestine', 'Yemen', 'Egypt'
];

export default function EditProfile() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    username: '',
    age_range: '',
    gender: '',
    country: '',
    city: '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        username: profile.username || '',
        age_range: profile.age_range || '',
        gender: profile.gender || '',
        country: profile.country || '',
        city: profile.city || '',
      });
    }
  }, [profile]);

  const handleSave = async () => {
    if (!profile) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          username: formData.username || null,
          age_range: formData.age_range || null,
          gender: formData.gender || null,
          country: formData.country || null,
          city: formData.city || null,
        })
        .eq('id', profile.id);

      if (error) throw error;

      await refreshProfile();
      toast.success('Profile updated successfully!');
      navigate('/profile');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-4 space-y-6 animate-slide-up">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/profile')}
            className="p-2 rounded-full hover:bg-secondary/50 text-foreground"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-2xl font-display font-bold text-foreground">Edit Profile</h1>
        </div>

        {/* Form */}
        <div className="glass rounded-2xl p-6 space-y-6">
          {/* Username */}
          <div className="space-y-2">
            <Label htmlFor="username" className="text-foreground">Username</Label>
            <Input
              id="username"
              value={formData.username}
              onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
              placeholder="Enter username"
              className="text-foreground"
            />
          </div>

          {/* Age Range */}
          <div className="space-y-2">
            <Label className="text-foreground">Age Range</Label>
            <Select
              value={formData.age_range}
              onValueChange={(value) => setFormData(prev => ({ ...prev, age_range: value }))}
            >
              <SelectTrigger className="text-foreground">
                <SelectValue placeholder="Select age range" />
              </SelectTrigger>
              <SelectContent>
                {AGE_RANGES.map((range) => (
                  <SelectItem key={range} value={range}>{range}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Gender */}
          <div className="space-y-2">
            <Label className="text-foreground">Gender</Label>
            <Select
              value={formData.gender}
              onValueChange={(value) => setFormData(prev => ({ ...prev, gender: value }))}
            >
              <SelectTrigger className="text-foreground">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                {GENDERS.map((gender) => (
                  <SelectItem key={gender} value={gender}>{gender}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Country */}
          <div className="space-y-2">
            <Label className="text-foreground">Country</Label>
            <Select
              value={formData.country}
              onValueChange={(value) => setFormData(prev => ({ ...prev, country: value }))}
            >
              <SelectTrigger className="text-foreground">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((country) => (
                  <SelectItem key={country} value={country}>{country}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* City */}
          <div className="space-y-2">
            <Label htmlFor="city" className="text-foreground">City</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
              placeholder="Enter city"
              className="text-foreground"
            />
          </div>
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={isLoading}
          className="w-full h-14 text-lg font-semibold"
        >
          <Save className="mr-2 h-5 w-5" />
          {isLoading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </AppLayout>
  );
}
