import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { ArrowLeft, Check, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function ProfileCustomize() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);

  // Fetch available themes
  const { data: themes, isLoading } = useQuery({
    queryKey: ['profile-customizations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile_customizations')
        .select('*');
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch user's current theme
  const { data: userCustomization, refetch } = useQuery({
    queryKey: ['user-customization', profile?.id],
    queryFn: async () => {
      if (!profile) return null;
      
      const { data, error } = await supabase
        .from('user_customizations')
        .select('*, profile_customizations(*)')
        .eq('user_id', profile.id)
        .eq('active', true)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile,
  });

  useEffect(() => {
    if (userCustomization?.profile_customization_id) {
      setSelectedTheme(userCustomization.profile_customization_id);
    }
  }, [userCustomization]);

  const handleSelectTheme = async (themeId: string) => {
    if (!profile) return;

    setSelectedTheme(themeId);

    try {
      // First, deactivate any existing customizations
      await supabase
        .from('user_customizations')
        .update({ active: false })
        .eq('user_id', profile.id);

      // Then, upsert the new selection
      const { error } = await supabase
        .from('user_customizations')
        .upsert({
          user_id: profile.id,
          profile_customization_id: themeId,
          active: true,
        }, { onConflict: 'user_id' });

      if (error) throw error;

      await refetch();
      toast.success('Theme applied!');
    } catch (error) {
      console.error('Error applying theme:', error);
      toast.error('Failed to apply theme');
    }
  };

  return (
    <AppLayout>
      <div className="p-4 space-y-6 animate-slide-up">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/profile')}
            className="p-2 rounded-full hover:bg-secondary/50"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-2xl font-display font-bold">Customize Theme</h1>
        </div>

        {/* Themes Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-square rounded-2xl bg-secondary/50 animate-pulse" />
            ))}
          </div>
        ) : themes && themes.length > 0 ? (
          <div className="grid grid-cols-2 gap-4">
            {themes.map((theme) => (
              <button
                key={theme.id}
                onClick={() => handleSelectTheme(theme.id)}
                className={cn(
                  "relative aspect-square rounded-2xl p-4 transition-all duration-200",
                  "border-2 hover:scale-105",
                  selectedTheme === theme.id
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border"
                )}
                style={{
                  background: `linear-gradient(135deg, ${theme.theme_primary}, ${theme.theme_secondary})`,
                }}
              >
                {selectedTheme === theme.id && (
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
                <div className="absolute bottom-4 left-4 right-4">
                  <p className="text-white font-bold text-shadow">{theme.name}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="glass rounded-2xl p-8 text-center">
            <Palette className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No Themes Available</h3>
            <p className="text-sm text-muted-foreground">
              Check back later for customization options!
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
