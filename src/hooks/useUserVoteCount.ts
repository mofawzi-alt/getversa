import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useUserVoteCount() {
  const { user } = useAuth();

  const { data: totalVotes = 0 } = useQuery({
    queryKey: ['user-total-vote-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase
        .from('votes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      return count || 0;
    },
    enabled: !!user,
    staleTime: 1000 * 30,
  });

  const getAskLevel = () => {
    if (totalVotes < 15) return 0; // locked
    if (totalVotes < 30) return 1;
    if (totalVotes < 50) return 2;
    if (totalVotes < 100) return 3;
    return 4;
  };

  const getNextLevelVotes = () => {
    if (totalVotes < 15) return 15 - totalVotes;
    if (totalVotes < 30) return 30 - totalVotes;
    if (totalVotes < 50) return 50 - totalVotes;
    if (totalVotes < 100) return 100 - totalVotes;
    return 0;
  };

  const getLevelLabel = () => {
    const level = getAskLevel();
    switch (level) {
      case 0: return `Vote on ${15 - totalVotes} more polls to unlock Ask Versa`;
      case 1: return `Level 1 · Vote ${30 - totalVotes} more times to unlock highlights →`;
      case 2: return `Level 2 · Vote ${50 - totalVotes} more times to unlock People Like Me →`;
      case 3: return `Level 3 · Vote ${100 - totalVotes} more times to unlock full insights →`;
      case 4: return 'Level 4 · Full insights unlocked 🔥';
      default: return '';
    }
  };

  return {
    totalVotes,
    askLevel: getAskLevel(),
    nextLevelVotes: getNextLevelVotes(),
    levelLabel: getLevelLabel(),
  };
}
