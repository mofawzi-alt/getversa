import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface GenderTeaser {
  text: string;
}

const MIN_VOTES_PER_GENDER = 5;
const MIN_DIFF_FROM_OVERALL = 5;

const normalizeGender = (value: string | null) => value?.trim().toLowerCase() ?? '';

export function useGenderSplitTeaser(
  pollId: string,
  optionA: string,
  optionB: string,
  overallPercentA: number,
  overallPercentB: number
) {
  return useQuery<GenderTeaser | null>({
    queryKey: [
      'gender-split-teaser',
      pollId,
      Math.round(overallPercentA),
      Math.round(overallPercentB),
    ],
    enabled: !!pollId,
    queryFn: async () => {
      const { data: votes, error } = await supabase
        .from('votes')
        .select('choice, voter_gender')
        .eq('poll_id', pollId)
        .not('voter_gender', 'is', null);

      if (error || !votes || votes.length === 0) return null;

      const maleVotes = votes.filter((vote) => normalizeGender(vote.voter_gender) === 'male');
      const femaleVotes = votes.filter((vote) => normalizeGender(vote.voter_gender) === 'female');

      if (maleVotes.length < MIN_VOTES_PER_GENDER || femaleVotes.length < MIN_VOTES_PER_GENDER) {
        return null;
      }

      const malePercentA = Math.round(
        (maleVotes.filter((vote) => vote.choice === 'A').length / maleVotes.length) * 100
      );
      const femalePercentA = Math.round(
        (femaleVotes.filter((vote) => vote.choice === 'A').length / femaleVotes.length) * 100
      );
      const malePercentB = 100 - malePercentA;
      const femalePercentB = 100 - femalePercentA;

      const candidates = [
        { gender: 'men', percent: malePercentA, option: optionA, diff: Math.abs(malePercentA - overallPercentA) },
        { gender: 'men', percent: malePercentB, option: optionB, diff: Math.abs(malePercentB - overallPercentB) },
        { gender: 'women', percent: femalePercentA, option: optionA, diff: Math.abs(femalePercentA - overallPercentA) },
        { gender: 'women', percent: femalePercentB, option: optionB, diff: Math.abs(femalePercentB - overallPercentB) },
      ];

      const best = candidates.sort((a, b) => b.diff - a.diff)[0];

      if (best.diff < MIN_DIFF_FROM_OVERALL) return null;

      return { text: `👀 ${best.percent}% of ${best.gender} chose ${best.option}` };
    },
    staleTime: 30_000,
  });
}
