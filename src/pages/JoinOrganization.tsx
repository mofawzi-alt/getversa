import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Building2, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function JoinOrganization() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [joined, setJoined] = useState(false);
  const [orgName, setOrgName] = useState('');

  const handleJoin = async () => {
    if (!code.trim() || !user) return;
    setLoading(true);

    try {
      // Look up org by invite code
      const { data: org, error: lookupErr } = await (supabase
        .from('organizations' as any)
        .select('id, name')
        .eq('invite_code', code.trim().toUpperCase())
        .maybeSingle() as any);

      if (lookupErr) throw lookupErr;
      if (!org) {
        toast.error('Invalid invite code. Please check and try again.');
        setLoading(false);
        return;
      }

      // Check if already a member
      const { data: existing } = await (supabase
        .from('organization_members' as any)
        .select('id')
        .eq('organization_id', org.id)
        .eq('user_id', user.id)
        .maybeSingle() as any);

      if (existing) {
        toast.info(`You're already a member of ${org.name}`);
        setLoading(false);
        return;
      }

      // Join
      const { error: joinErr } = await (supabase
        .from('organization_members' as any)
        .insert({ organization_id: org.id, user_id: user.id }) as any);

      if (joinErr) throw joinErr;

      setOrgName(org.name);
      setJoined(true);
      toast.success(`Welcome to ${org.name}!`);
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="min-h-screen p-4 safe-area-top animate-slide-up">
        <header className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-primary/10 text-primary">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-display font-bold">Join Organization</h1>
            <p className="text-sm text-muted-foreground">Enter an invite code to access private polls</p>
          </div>
        </header>

        <Card className="p-6 max-w-md mx-auto">
          {joined ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Check className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-lg font-bold">You're in! 🎉</h2>
              <p className="text-muted-foreground text-sm">
                You've joined <span className="font-semibold text-foreground">{orgName}</span>. 
                Private polls from this organization will now appear in your feed.
              </p>
              <Button onClick={() => navigate('/home')} className="w-full">
                Go to Feed
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Building2 className="h-7 w-7 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Your organization admin should have shared an invite code with you.
                </p>
              </div>

              <div>
                <Input
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  placeholder="Enter invite code"
                  className="bg-secondary text-center text-lg font-mono tracking-[0.3em] uppercase"
                  maxLength={12}
                />
              </div>

              <Button
                onClick={handleJoin}
                disabled={!code.trim() || loading}
                className="w-full"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Join Organization
              </Button>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
