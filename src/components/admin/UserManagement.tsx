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
        .rpc('admin_list_users_full', { _limit: 100000, _offset: 0 });
      if (error) throw error;
      return (data || []).map((u: any) => ({
        id: u.id, email: u.email, username: u.username,
        verified_public_figure: u.verified_public_figure,
        verified_category: u.verified_category,
        points: u.points, created_at: u.created_at,
      }));
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

  // New signup stats (Cairo timezone day boundary)
  const stats = (() => {
    if (!users) return { today: 0, yesterday: 0, last7: 0, total: 0 };
    const cairoNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
    const startToday = new Date(cairoNow); startToday.setHours(0, 0, 0, 0);
    const startYesterday = new Date(startToday); startYesterday.setDate(startYesterday.getDate() - 1);
    const start7 = new Date(startToday); start7.setDate(start7.getDate() - 6);
    let today = 0, yesterday = 0, last7 = 0;
    for (const u of users) {
      if (!u.created_at) continue;
      const d = new Date(u.created_at);
      if (d >= startToday) today++;
      else if (d >= startYesterday) yesterday++;
      if (d >= start7) last7++;
    }
    return { today, yesterday, last7, total: users.length };
  })();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'New today', value: stats.today },
          { label: 'Yesterday', value: stats.yesterday },
          { label: 'Last 7 days', value: stats.last7 },
          { label: 'Total users', value: stats.total },
        ].map((s) => (
          <div key={s.label} className="glass rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-primary">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

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
