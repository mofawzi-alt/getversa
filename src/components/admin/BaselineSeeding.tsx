import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Sparkles, Search } from 'lucide-react';
import { toast } from 'sonner';

interface PollRow {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  category: string | null;
  baseline_votes_a: number;
  baseline_votes_b: number;
  real_total: number;
}

// Realistic category splits for auto-seed (option_a % wins)
const CATEGORY_SPLITS: Record<string, [number, number]> = {
  'FMCG & Food': [55, 45],
  'The Pulse': [60, 40],
  'Financial Services': [52, 48],
  'Lifestyle & Society': [58, 42],
  'Media & Entertainment': [62, 38],
  'Retail & E-commerce': [54, 46],
  'Beauty & Personal Care': [57, 43],
  'Telco & Tech': [53, 47],
};

function randomInRange(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function autoSeedFor(category: string | null): { a: number; b: number } {
  const total = randomInRange(180, 480);
  const split = (category && CATEGORY_SPLITS[category]) || [50, 50];
  const wobble = randomInRange(-6, 6);
  const aPct = Math.max(10, Math.min(90, split[0] + wobble));
  const a = Math.round((total * aPct) / 100);
  return { a, b: total - a };
}

export default function BaselineSeeding() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [edits, setEdits] = useState<Record<string, { a: number; b: number }>>({});
  const [previewOnly, setPreviewOnly] = useState(true);

  // Threshold settings
  const { data: settings } = useQuery({
    queryKey: ['seeding-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('seeding_settings').select('*').limit(1).maybeSingle();
      return data;
    },
  });
  const [threshold, setThreshold] = useState<number | null>(null);
  const effectiveThreshold = threshold ?? settings?.baseline_sunset_threshold ?? 50;

  const { data: polls = [], isLoading } = useQuery({
    queryKey: ['baseline-seeding-polls'],
    queryFn: async () => {
      const { data: pollsData, error } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, category, baseline_votes_a, baseline_votes_b')
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Get real vote totals per poll
      const ids = (pollsData || []).map((p) => p.id);
      const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: ids });
      const realMap: Record<string, number> = {};
      (results || []).forEach((r: any) => {
        realMap[r.poll_id] = Number(r.real_total) || 0;
      });

      return (pollsData || []).map((p) => ({
        ...p,
        baseline_votes_a: p.baseline_votes_a || 0,
        baseline_votes_b: p.baseline_votes_b || 0,
        real_total: realMap[p.id] || 0,
      })) as PollRow[];
    },
  });

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return polls;
    return polls.filter(
      (p) =>
        p.question.toLowerCase().includes(s) ||
        (p.category || '').toLowerCase().includes(s) ||
        p.option_a.toLowerCase().includes(s) ||
        p.option_b.toLowerCase().includes(s),
    );
  }, [polls, search]);

  const categoryStats = useMemo(() => {
    const stats: Record<string, { count: number; seeded: number }> = {};
    polls.forEach((p) => {
      const cat = p.category || 'Uncategorized';
      if (!stats[cat]) stats[cat] = { count: 0, seeded: 0 };
      stats[cat].count++;
      if ((p.baseline_votes_a + p.baseline_votes_b) > 0) stats[cat].seeded++;
    });
    return stats;
  }, [polls]);

  const getValue = (p: PollRow, side: 'a' | 'b') => {
    const e = edits[p.id];
    if (e) return side === 'a' ? e.a : e.b;
    return side === 'a' ? p.baseline_votes_a : p.baseline_votes_b;
  };

  const setEdit = (id: string, side: 'a' | 'b', val: number) => {
    setEdits((prev) => {
      const cur = prev[id] || {
        a: polls.find((p) => p.id === id)?.baseline_votes_a || 0,
        b: polls.find((p) => p.id === id)?.baseline_votes_b || 0,
      };
      return { ...prev, [id]: { ...cur, [side]: val } };
    });
  };

  const autoSeedAll = () => {
    const next: Record<string, { a: number; b: number }> = {};
    filtered.forEach((p) => {
      // skip already-seeded unless force
      next[p.id] = autoSeedFor(p.category);
    });
    setEdits(next);
    toast.success(`Auto-generated baselines for ${filtered.length} polls (preview only — click Save to commit)`);
  };

  const saveAllMutation = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(edits);
      if (updates.length === 0) return 0;
      // Update one by one (small set; admin only)
      for (const [id, vals] of updates) {
        const { error } = await supabase
          .from('polls')
          .update({ baseline_votes_a: vals.a, baseline_votes_b: vals.b })
          .eq('id', id);
        if (error) throw error;
      }
      return updates.length;
    },
    onSuccess: (count) => {
      toast.success(`Saved baselines for ${count} polls`);
      setEdits({});
      qc.invalidateQueries({ queryKey: ['baseline-seeding-polls'] });
    },
    onError: (e: any) => toast.error(e.message || 'Save failed'),
  });

  const saveThresholdMutation = useMutation({
    mutationFn: async () => {
      if (!settings?.id) {
        const { error } = await supabase
          .from('seeding_settings')
          .insert({ baseline_sunset_threshold: effectiveThreshold });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('seeding_settings')
          .update({ baseline_sunset_threshold: effectiveThreshold })
          .eq('id', settings.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Sunset threshold updated');
      qc.invalidateQueries({ queryKey: ['seeding-settings'] });
    },
  });

  const editedCount = Object.keys(edits).length;
  const previewSample = filtered.slice(0, 20);

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-bold">Baseline Vote Seeding</h2>
            <p className="text-xs text-muted-foreground">
              Add seed votes to polls so Ask Versa & results feel alive during testing. Real votes auto-replace baselines past the sunset threshold.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="threshold" className="text-xs">Sunset @</Label>
            <Input
              id="threshold"
              type="number"
              className="w-20 h-8"
              value={effectiveThreshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
            <Button size="sm" variant="outline" onClick={() => saveThresholdMutation.mutate()}>
              Save
            </Button>
          </div>
        </div>

        {/* Category summary */}
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          {Object.entries(categoryStats).map(([cat, s]) => (
            <div key={cat} className="px-2 py-1 rounded-md bg-muted text-xs">
              <span className="font-semibold">{cat}</span>{' '}
              <span className="text-muted-foreground">
                {s.seeded}/{s.count} seeded
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search polls or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
          />
        </div>
        <Button onClick={autoSeedAll} variant="outline" size="sm" className="gap-1">
          <Sparkles className="h-4 w-4" />
          Auto-seed {filtered.length} (preview)
        </Button>
        <Button
          onClick={() => saveAllMutation.mutate()}
          disabled={editedCount === 0 || saveAllMutation.isPending}
          size="sm"
          className="gap-1"
        >
          {saveAllMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save {editedCount > 0 ? `(${editedCount})` : ''}
        </Button>
      </div>

      {editedCount > 0 && (
        <div className="rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          {editedCount} unsaved change{editedCount !== 1 ? 's' : ''}. Preview below — click Save to commit.
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left">
                  <th className="px-3 py-2 font-semibold">Question</th>
                  <th className="px-3 py-2 font-semibold">Category</th>
                  <th className="px-3 py-2 font-semibold text-right">Real</th>
                  <th className="px-3 py-2 font-semibold w-24">Seed A</th>
                  <th className="px-3 py-2 font-semibold w-24">Seed B</th>
                  <th className="px-3 py-2 font-semibold text-right">Total</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const a = getValue(p, 'a');
                  const b = getValue(p, 'b');
                  const seedTotal = a + b;
                  const total = seedTotal + p.real_total;
                  const sunset = p.real_total >= effectiveThreshold;
                  const isEdited = !!edits[p.id];
                  return (
                    <tr key={p.id} className={`border-t ${isEdited ? 'bg-amber-500/5' : ''}`}>
                      <td className="px-3 py-2 max-w-[280px]">
                        <div className="font-medium truncate">{p.question}</div>
                        <div className="text-muted-foreground truncate text-[10px]">
                          {p.option_a} vs {p.option_b}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{p.category || '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{p.real_total}</td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={0}
                          value={a}
                          onChange={(e) => setEdit(p.id, 'a', Math.max(0, Number(e.target.value) || 0))}
                          className="h-7 text-xs"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={0}
                          value={b}
                          onChange={(e) => setEdit(p.id, 'b', Math.max(0, Number(e.target.value) || 0))}
                          className="h-7 text-xs"
                        />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{total}</td>
                      <td className="px-3 py-2">
                        {sunset ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-700 dark:text-green-400 font-semibold">
                            REAL
                          </span>
                        ) : seedTotal > 0 ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-400 font-semibold">
                            SEEDED
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                            EMPTY
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-6">No polls match.</div>
          )}
        </div>
      )}
    </div>
  );
}
