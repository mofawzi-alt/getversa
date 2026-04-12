import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface VerifiedUser {
  id: string;
  verified_category: string | null;
}

export function useVerifiedUsers(userIds: string[]) {
  const { data: verifiedMap = {} } = useQuery({
    queryKey: ['verified-users', userIds.sort().join(',')],
    queryFn: async () => {
      if (userIds.length === 0) return {};
      const { data } = await supabase
        .from('users')
        .select('id, verified_public_figure, verified_category')
        .in('id', userIds)
        .eq('verified_public_figure', true);
      const map: Record<string, VerifiedUser> = {};
      data?.forEach((u: any) => {
        map[u.id] = { id: u.id, verified_category: u.verified_category };
      });
      return map;
    },
    enabled: userIds.length > 0,
    staleTime: 60000,
  });
  
  return {
    isVerified: (userId: string) => !!verifiedMap[userId],
    getCategory: (userId: string) => verifiedMap[userId]?.verified_category || null,
  };
}

export function useVerifiedUser(userId: string | undefined) {
  const { data } = useQuery({
    queryKey: ['verified-user', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from('users')
        .select('verified_public_figure, verified_category')
        .eq('id', userId)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
    staleTime: 60000,
  });
  
  return {
    isVerified: !!data?.verified_public_figure,
    category: data?.verified_category || null,
  };
}
