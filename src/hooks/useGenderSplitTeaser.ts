import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface GenderTeaser {
  text: string;
}

export function useGenderSplitTeaser(
  pollId: string,
  optionA: string,
  optionB: string,
  overallPercentA: number,
  overallPercentB: number
) {
  return useQuery<GenderTeaser | null>({
    queryKey: ['gender-split-teaser', pollId],
    queryFn: async () => {
      const { data: votes, error } = await supabase
        .from('votes')
        .select('choice, voter_gender')
        .eq('poll_id', pollId);

      if (error || !votes || votes.length === 0) return null;

      const male = votes.filter(v => v.voter_gender === 'Male');
      const female = votes.filter(v => v.voter_gender === 'Female');

      // Need at least 20 votes per gender
      if (male.length < 20 || female.length < 20) return null;

      const malePercentA = Math.round((male.filter(v => v.choice === 'A').length / male.length) * 100);
      const malePercentB = 100 - malePercentA;
      const femalePercentA = Math.round((female.filter(v => v.choice === 'A').length / female.length) * 100);
      const femalePercentB = 100 - femalePercentA;

      // Find the most surprising split: compare each gender's percentage to overall
      const candidates = [
        { gender: 'men', percent: malePercentA, option: optionA, diff: Math.abs(malePercentA - overallPercentA) },
        { gender: 'men', percent: malePercentB, option: optionB, diff: Math.abs(malePercentB - overallPercentB) },
        { gender: 'women', percent: femalePercentA, option: optionA, diff: Math.abs(femalePercentA - overallPercentA) },
        { gender: 'women', percent: femalePercentB, option: optionB, diff: Math.abs(femalePercentB - overallPercentB) },
      ];

      // Pick the most surprising one
      const best = candidates.sort((a, b) => b.diff - a.diff)[0];

      // Minimum 10% difference from overall
      if (best.diff < 10) return null;

      return { text: `👀 ${best.percent}% of ${best.gender} chose ${best.option}` };
    },
    staleTime: 60_000,
  });
}
