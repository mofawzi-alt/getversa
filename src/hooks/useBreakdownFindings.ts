import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type BreakdownFinding = {
  id: string;
  scan_run_id: string;
  scan_at: string;
  finding_type: 'gender_split' | 'age_gap' | 'city_war' | 'dominant_demo';
  poll_id: string;
  headline: string;
  detail: any;
  total_votes: number;
  status: 'pending' | 'approved' | 'rejected';
  pinned: boolean;
};

/**
 * Returns the latest approved findings (pinned first), one per finding_type,
 * for the most recent scan that has any approved findings.
 */
export function useBreakdownFindings() {
  return useQuery({
    queryKey: ['breakdown-findings-approved'],
    queryFn: async () => {
      // Only show findings from last 3 days to keep content fresh
      const since = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from('breakdown_findings' as any)
        .select('*')
        .eq('status', 'approved')
        .gte('scan_at', since)
        .order('pinned', { ascending: false })
        .order('scan_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      const rows = (data || []) as unknown as BreakdownFinding[];
      // Keep most recent per type, but pinned always wins for its type
      const byType = new Map<string, BreakdownFinding>();
      for (const f of rows) {
        const cur = byType.get(f.finding_type);
        if (!cur) { byType.set(f.finding_type, f); continue; }
        if (f.pinned && !cur.pinned) byType.set(f.finding_type, f);
      }
      // Order: pinned first, then preferred display order
      const order: Record<BreakdownFinding['finding_type'], number> = {
        gender_split: 0, age_gap: 1, city_war: 2, dominant_demo: 3,
      };
      const sorted = [...byType.values()].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return order[a.finding_type] - order[b.finding_type];
      });
      return sorted;
    },
    staleTime: 5 * 60 * 1000,
  });
}
