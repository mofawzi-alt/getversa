import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/**
 * Required by Apple App Store Guideline 5.1.1(v):
 * apps that support account creation must let the user
 * delete their account from within the app.
 */
export default function DeleteAccountButton() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (confirm.trim().toUpperCase() !== 'DELETE') {
      toast.error('Type DELETE to confirm');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-account');
      if (error || (data as any)?.error) {
        throw new Error((data as any)?.error || error?.message || 'Failed to delete account');
      }
      await signOut();
      toast.success('Your account has been deleted');
      navigate('/auth', { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete account');
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          className="w-full h-11 text-destructive hover:bg-destructive/10 hover:text-destructive justify-start"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete my account
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete your account?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes your Versa account and all associated data: votes,
            friends, messages, points, and profile. This action cannot be undone.
            <br /><br />
            Type <span className="font-bold text-foreground">DELETE</span> below to confirm.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="DELETE"
          autoCapitalize="characters"
          disabled={loading}
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleDelete(); }}
            disabled={loading || confirm.trim().toUpperCase() !== 'DELETE'}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete forever'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
