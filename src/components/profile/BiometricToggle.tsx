import { useEffect, useState } from 'react';
import { Fingerprint, ScanFace } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  checkBiometricAvailability,
  promptBiometric,
  isBiometricEnabled,
  enableBiometric,
  disableBiometric,
  shouldRenderBiometricSettings,
} from '@/lib/biometric';
import { hapticSuccess, hapticError } from '@/lib/haptics';

interface BiometricToggleProps {
  email: string;
}

export default function BiometricToggle({ email }: BiometricToggleProps) {
  const [available, setAvailable] = useState(false);
  const [type, setType] = useState<'face' | 'fingerprint' | 'iris' | 'generic' | 'none'>('none');
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState<string | undefined>();

  useEffect(() => {
    let mounted = true;

    const loadAvailability = async () => {
      const info = await checkBiometricAvailability();
      if (!mounted) return;
      setAvailable(info.available);
      setType(info.type);
      setReason(info.reason);
      setEnabled(isBiometricEnabled());
    };

    void loadAvailability();

    const handleFocus = () => {
      void loadAvailability();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      mounted = false;
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  if (!shouldRenderBiometricSettings()) return null;

  const label = type === 'face' ? 'Face ID' : type === 'fingerprint' ? 'Touch ID' : 'Face ID';
  const Icon = type === 'face' ? ScanFace : Fingerprint;
  const faceIdNeedsNativePermission = reason?.includes('NSFaceIDUsageDescription');

  const handleToggle = async (checked: boolean) => {
    if (loading) return;
    setLoading(true);

    try {
      if (checked) {
        const result = await promptBiometric(`Enable ${label} for Versa`);
        if (!result.ok) {
          hapticError();
          if (faceIdNeedsNativePermission || result.message?.includes('NSFaceIDUsageDescription')) {
            toast.error('Face ID needs the native iPhone permission. Sync the iOS app again and reopen it.');
          } else if (result.code !== 'userCancel') {
            toast.error(result.message || `${label} authentication failed`);
          }
          return;
        }

        enableBiometric(email);
        setEnabled(true);
        hapticSuccess();
        toast.success(`${label} enabled`);
        return;
      }

      disableBiometric();
      setEnabled(false);
      toast.success(`${label} disabled`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-4 p-4 hover:bg-secondary/50 transition-colors">
      <Icon className="h-5 w-5 text-card-foreground/70" />
      <div className="flex-1 text-left">
        <div className="font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">
          {!available
            ? reason === 'web'
              ? 'Face ID appears here on iPhone and turns on inside the installed app'
              : faceIdNeedsNativePermission
                ? 'Face ID is blocked in the current iPhone build until the native permission is synced'
                : `Unavailable${reason ? ` (${reason})` : ''} — turn on ${label} in iPhone Settings`
            : enabled
              ? `Sign in instantly with ${label}`
              : `Use ${label} for faster sign-in`}
        </div>
      </div>
      <Switch checked={enabled} onCheckedChange={handleToggle} disabled={loading || !available} />
    </div>
  );
}
