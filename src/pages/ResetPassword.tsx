import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import VersaLogo from '@/components/VersaLogo';
import { clearPasswordRecoveryIntent, hasRecentPasswordRecoveryIntent } from '@/lib/authRedirectCapture';

const hasRecoveryParams = () => {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  return hash.get('type') === 'recovery' || query.get('type') === 'recovery' || hash.has('access_token') || hash.has('refresh_token') || query.has('code');
};

/**
 * Password reset landing page. Supabase redirects users here from the email
 * link with a `type=recovery` token in the URL hash. We let the SDK pick that
 * up automatically (it sets a temporary recovery session), then let the user
 * choose a new password via supabase.auth.updateUser({ password }).
 */
export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [recoverySession, setRecoverySession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const startedFromRecoveryLink = hasRecoveryParams() || hasRecentPasswordRecoveryIntent();

    // Listen for PASSWORD_RECOVERY before checking session, so we don't miss the event
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && hasRecentPasswordRecoveryIntent())) {
        setRecoverySession(true);
        setReady(true);
      }
    });

    (async () => {
      const query = new URLSearchParams(window.location.search);
      const code = query.get('code');

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) console.error('Password recovery exchange failed:', error.message);
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session && startedFromRecoveryLink) {
        await new Promise((resolve) => window.setTimeout(resolve, 350));
      }
      const { data: settledData } = data.session ? { data } : await supabase.auth.getSession();
      if (cancelled) return;
      setRecoverySession(Boolean(settledData.session && startedFromRecoveryLink));
      setReady(true);
    })();

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message || 'Could not update password');
      return;
    }
    clearPasswordRecoveryIntent();
    toast.success('Password updated');
    // Sign out the recovery session so they log in fresh with the new password
    await supabase.auth.signOut();
    navigate('/auth', { replace: true });
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-6 pt-12 safe-area-top safe-area-bottom bg-background">
      <div className="w-full max-w-sm space-y-6 animate-slide-up">
        <div className="text-center flex flex-col items-center">
          <VersaLogo size="lg" />
          <p className="text-muted-foreground mt-2 text-sm">Set a new password</p>
        </div>

        <div className="bg-card/80 backdrop-blur-lg rounded-2xl p-5 shadow-card border border-border/50">
          {!recoverySession ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-card-foreground">
                This reset link is invalid or has expired.
              </p>
              <Button onClick={() => navigate('/auth')} className="w-full">
                Back to sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-password" className="text-card-foreground text-xs">New password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-secondary/80 border-border/50 pr-10 h-10"
                    disabled={loading}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-accent"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-password" className="text-card-foreground text-xs">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="bg-secondary/80 border-border/50 h-10"
                  disabled={loading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update password'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
