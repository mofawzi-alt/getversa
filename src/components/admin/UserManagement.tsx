import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Loader2, BadgeCheck } from 'lucide-react';
import { toast } from 'sonner';

const VERIFIED_CATEGORIES = [
  'Cinema & Entertainment',
  'Business & Investment',
  'Sports',
  'Music & Culture',
  'Media & Television',
];

export default function UserManagement() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, username, verified_public_figure, verified_category, points, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const updateVerified = useMutation({
    mutationFn: async ({ userId, verified, category }: { userId: string; verified: boolean; category: string | null }) => {
      const { error } = await supabase
        .from('users')
        .update({
          verified_public_figure: verified,
          verified_category: verified ? category : null,
        })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User updated');
    },
    onError: () => toast.error('Failed to update user'),
  });

  const filtered = users?.filter((u) => {
    if (!search.trim()) return true;
    const t = search.toLowerCase();
    return (
      u.username?.toLowerCase().includes(t) ||
      u.email?.toLowerCase().includes(t)
    );
  });

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered?.map((user) => (
            <div key={user.id} className="glass rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-foreground truncate">
                      @{user.username || 'unnamed'}
                    </p>
                    {user.verified_public_figure && (
                      <BadgeCheck className="h-4 w-4 text-blue-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">Verified</span>
                  <Switch
                    checked={!!user.verified_public_figure}
                    onCheckedChange={(checked) => {
                      updateVerified.mutate({
                        userId: user.id,
                        verified: checked,
                        category: checked ? (user.verified_category || VERIFIED_CATEGORIES[0]) : null,
                      });
                    }}
                  />
                </div>
              </div>

              {user.verified_public_figure && (
                <div>
                  <Select
                    value={user.verified_category || ''}
                    onValueChange={(value) => {
                      updateVerified.mutate({
                        userId: user.id,
                        verified: true,
                        category: value,
                      });
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {VERIFIED_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat} className="text-xs">
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          ))}
          {filtered?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No users found</p>
          )}
        </div>
      )}
    </div>
  );
}
