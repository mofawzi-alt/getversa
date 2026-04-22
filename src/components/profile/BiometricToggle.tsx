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
  isNative,
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
    (async () => {
      const info = await checkBiometricAvailability();
      console.log('[BiometricToggle] availability:', info);
      setAvailable(info.available);
      setType(info.type);
      setReason(info.reason);
      setEnabled(isBiometricEnabled());
    })();
  }, []);

  // Hide entirely on web — biometrics are a native-only capability.
  // On native we still render even if unavailable, so user can see WHY.
  if (!isNative()) return null;

  const label = type === 'face' ? 'Face ID' : type === 'fingerprint' ? 'Touch ID' : 'Biometric Login';
  const Icon = type === 'face' ? ScanFace : Fingerprint;

  const handleToggle = async (checked: boolean) => {
    if (loading) return;
    setLoading(true);
    try {
      if (checked) {
        const ok = await promptBiometric(`Enable ${label} for Versa`);
        if (!ok) {
          hapticError();
          toast.error(`${label} authentication failed`);
          return;
        }
        enableBiometric(email);
        setEnabled(true);
        hapticSuccess();
        toast.success(`${label} enabled`);
      } else {
        disableBiometric();
        setEnabled(false);
        toast.success(`${label} disabled`);
      }
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
            ? `Unavailable${reason ? ` (${reason})` : ''} — enroll Face ID in iOS Settings`
            : enabled
              ? `Sign in instantly with ${label}`
              : `Use ${label} for faster sign-in`}
        </div>
      </div>
      <Switch checked={enabled} onCheckedChange={handleToggle} disabled={loading || !available} />
    </div>
  );
}
