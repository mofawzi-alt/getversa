import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { ArrowLeft } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function ProfileNotifications() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  
  const [settings, setSettings] = useState({
    daily_poll_reminder: true,
    sponsored_opt_in: true,
  });

  useEffect(() => {
    if (profile) {
      fetchSettings();
    }
  }, [profile]);

  const fetchSettings = async () => {
    if (!profile) return;
    
    try {
      const { data, error } = await supabase
        .from('automation_settings')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          daily_poll_reminder: data.daily_poll_reminder ?? true,
          sponsored_opt_in: data.sponsored_opt_in ?? true,
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSetting = async (key: keyof typeof settings, value: boolean) => {
    if (!profile) return;

    setSettings(prev => ({ ...prev, [key]: value }));

    try {
      const { error } = await supabase
        .from('automation_settings')
        .upsert({
          user_id: profile.id,
          [key]: value,
        }, { onConflict: 'user_id' });

      if (error) throw error;
      toast.success('Settings updated');
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Failed to update settings');
      setSettings(prev => ({ ...prev, [key]: !value }));
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
          <h1 className="text-2xl font-display font-bold">Notification Settings</h1>
        </div>

        {/* Settings */}
        <div className="glass rounded-2xl divide-y divide-border">
          <div className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Daily Poll Reminders</Label>
              <p className="text-sm text-muted-foreground">
                Get reminded to vote on daily polls
              </p>
            </div>
            <Switch
              checked={settings.daily_poll_reminder}
              onCheckedChange={(checked) => updateSetting('daily_poll_reminder', checked)}
              disabled={isLoading}
            />
          </div>

          <div className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Sponsored Polls</Label>
              <p className="text-sm text-muted-foreground">
                Opt in to receive sponsored poll notifications
              </p>
            </div>
            <Switch
              checked={settings.sponsored_opt_in}
              onCheckedChange={(checked) => updateSetting('sponsored_opt_in', checked)}
              disabled={isLoading}
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
