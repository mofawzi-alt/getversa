import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type PulseCard = {
  poll_id: string;
  question: string;
  option_a: string;
  option_b: string;
  image_a_url: string | null;
  image_b_url: string | null;
  category: string | null;
  pct_a: number;
  pct_b: number;
  total_votes: number;
  winner: 'A' | 'B';
  winning_option: string;
  winning_pct: number;
  winning_image: string | null;
  predicted_a?: number;
  predicted_b?: number;
  gap?: number;
};

export type DailyPulseRow = {
  id: string;
  slot: 'morning' | 'evening';
  pulse_date: string;
  cards: {
    big_result: PulseCard | null;
    closest_battle: PulseCard | null;
    surprise: (PulseCard & { predicted_a: number; predicted_b: number; gap: number }) | null;
    today_first: { id: string; question: string; option_a: string; option_b: string; image_a_url: string | null; image_b_url: string | null; category: string | null } | null;
  };
  egypt_today: PulseCard[];
  cairo: PulseCard[] | null;
  by_category: Record<string, PulseCard>;
  pinned_poll_id: string | null;
  generated_at: string;
};

export type PulseSettings = {
  morning_pulse_enabled: boolean;
  evening_verdict_enabled: boolean;
  stories_row_enabled: boolean;
  egypt_today_enabled: boolean;
  cairo_enabled: boolean;
};

export function useDailyPulse() {
  return useQuery({
    queryKey: ['daily-pulse-latest'],
    queryFn: async (): Promise<DailyPulseRow | null> => {
      const { data, error } = await supabase
        .from('daily_pulse' as any)
        .select('*')
        .order('pulse_date', { ascending: false })
        .order('generated_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      return ((data?.[0] as unknown) as DailyPulseRow) || null;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function usePulseSettings() {
  return useQuery({
    queryKey: ['pulse-settings'],
    queryFn: async (): Promise<PulseSettings> => {
      const { data } = await supabase
        .from('pulse_settings' as any)
        .select('morning_pulse_enabled, evening_verdict_enabled, stories_row_enabled, egypt_today_enabled, cairo_enabled')
        .limit(1)
        .maybeSingle();
      return (
        (data as unknown as PulseSettings) || {
          morning_pulse_enabled: true,
          evening_verdict_enabled: true,
          stories_row_enabled: true,
          egypt_today_enabled: true,
          cairo_enabled: true,
        }
      );
    },
    staleTime: 10 * 60 * 1000,
  });
}
