import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Upload, Download, Sparkles, Check, Trash2, Pencil, Calendar as CalIcon,
  Loader2, ChevronLeft, ChevronRight, Image as ImageIcon, AlertTriangle,
} from 'lucide-react';
import { downloadCsvTemplate, parseCalendarCsv } from '@/lib/calendarCsv';

type Status = 'draft' | 'image_pending' | 'approved' | 'published' | 'skipped';

interface CalendarRow {
  id: string;
  release_date: string;
  category: string | null;
  question: string;
  option_a: string;
  option_b: string;
  image_a_url: string | null;
  image_b_url: string | null;
  ai_image_a_preview: string | null;
  ai_image_b_preview: string | null;
  why_viral: string | null;
  source: string | null;
  target_country: string | null;
  target_age_range: string | null;
  target_gender: string | null;
  status: Status;
  published_poll_id: string | null;
  notes: string | null;
}

const STATUS_STYLES: Record<Status, string> = {
  draft: 'bg-muted text-muted-foreground',
  image_pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  approved: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  published: 'bg-primary/15 text-primary',
  skipped: 'bg-destructive/15 text-destructive',
};

function fmtMonthLabel(d: Date) {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function PollCalendarPanel() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [editingRow, setEditingRow] = useState<CalendarRow | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const monthStart = startOfMonth(monthCursor);
  const monthEnd = endOfMonth(monthCursor);

  // Settings (release hour)
  const { data: settings } = useQuery({
    queryKey: ['daily-poll-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('daily_poll_settings').select('*').maybeSingle();
      return data as any;
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['poll-calendar', ymd(monthStart), ymd(monthEnd)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('poll_calendar')
        .select('*')
        .gte('release_date', ymd(monthStart))
        .lte('release_date', ymd(monthEnd))
        .order('release_date', { ascending: true });
      if (error) throw error;
      return (data || []) as CalendarRow[];
    },
  });

  const byDate = rows.reduce<Record<string, CalendarRow[]>>((acc, r) => {
    (acc[r.release_date] ||= []).push(r);
    return acc;
  }, {});

  // CSV upload
  const importCsv = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const { rows: parsed, errors } = parseCalendarCsv(text);
      if (errors.length) throw new Error(errors.join(' • '));
      if (!parsed.length) throw new Error('No rows found');
      const inserts = parsed.map((p) => ({ ...p, status: 'draft', created_by: user!.id }));
      const { error } = await supabase.from('poll_calendar').insert(inserts);
      if (error) throw error;
      return parsed.length;
    },
    onSuccess: (n) => {
      toast.success(`Imported ${n} polls`);
      qc.invalidateQueries({ queryKey: ['poll-calendar'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateRow = useMutation({
    mutationFn: async (patch: Partial<CalendarRow> & { id: string }) => {
      const { id, ...rest } = patch;
      const { error } = await supabase.from('poll_calendar').update(rest).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['poll-calendar'] }),
    onError: (e: any) => toast.error(e.message),
  });

  const deleteRow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('poll_calendar').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Deleted');
      qc.invalidateQueries({ queryKey: ['poll-calendar'] });
    },
  });

  const generateImage = async (row: CalendarRow, option: 'A' | 'B' | 'both') => {
    setGeneratingId(row.id);
    try {
      const { error } = await supabase.functions.invoke('generate-calendar-image', {
        body: { calendar_id: row.id, option },
      });
      if (error) throw error;
      toast.success('AI preview ready — review and approve');
      qc.invalidateQueries({ queryKey: ['poll-calendar'] });
    } catch (e: any) {
      toast.error(e.message || 'Image generation failed');
    } finally {
      setGeneratingId(null);
    }
  };

  const acceptAiImage = (row: CalendarRow, opt: 'A' | 'B') => {
    const preview = opt === 'A' ? row.ai_image_a_preview : row.ai_image_b_preview;
    if (!preview) return;
    const patch: any = {
      id: row.id,
      [opt === 'A' ? 'image_a_url' : 'image_b_url']: preview,
      [opt === 'A' ? 'ai_image_a_preview' : 'ai_image_b_preview']: null,
    };
    // If both images will now be set, drop status back to 'draft' so it's clearly ready to approve
    const otherUrl = opt === 'A' ? row.image_b_url : row.image_a_url;
    if (otherUrl && row.status === 'image_pending') {
      patch.status = 'draft';
    }
    updateRow.mutate(patch);
    toast.success(`Image ${opt} approved — ${otherUrl ? 'ready for final approval' : 'approve image ' + (opt === 'A' ? 'B' : 'A') + ' next'}`);
  };

  const setStatus = (row: CalendarRow, status: Status) => {
    const patch: any = { id: row.id, status };
    if (status === 'approved') {
      patch.approved_by = user!.id;
      patch.approved_at = new Date().toISOString();
    }
    updateRow.mutate(patch);
  };

  const releaseHour = settings?.release_hour_cairo ?? 7;

  const updateReleaseHour = useMutation({
    mutationFn: async (hour: number) => {
      const { error } = await supabase
        .from('daily_poll_settings')
        .update({ release_hour_cairo: hour, updated_by: user!.id })
        .eq('id', settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Release hour updated');
      qc.invalidateQueries({ queryKey: ['daily-poll-settings'] });
    },
  });

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold min-w-[180px] text-center">{fmtMonthLabel(monthCursor)}</h2>
          <Button variant="outline" size="icon" onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setMonthCursor(startOfMonth(new Date()))}>Today</Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadCsvTemplate}>
            <Download className="h-4 w-4 mr-1" /> Template
          </Button>
          <Button size="sm" onClick={() => fileRef.current?.click()} disabled={importCsv.isPending}>
            {importCsv.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
            Upload CSV
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importCsv.mutate(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {/* Release hour */}
      <div className="flex items-center gap-3 rounded-lg border p-3 bg-muted/30">
        <CalIcon className="h-4 w-4 text-muted-foreground" />
        <Label htmlFor="release-hour" className="text-sm">Daily release hour (Cairo):</Label>
        <Input
          id="release-hour"
          type="number"
          min={0}
          max={23}
          defaultValue={releaseHour}
          className="w-20 h-8"
          onBlur={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v >= 0 && v <= 23 && v !== releaseHour) updateReleaseHour.mutate(v);
          }}
        />
        <span className="text-xs text-muted-foreground">Approved polls auto-publish at this hour daily.</span>
      </div>

      {/* Month grid */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="grid grid-cols-7 gap-1 text-xs">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
            <div key={d} className="text-center font-semibold text-muted-foreground py-1">{d}</div>
          ))}
          {(() => {
            const cells: JSX.Element[] = [];
            const firstDow = monthStart.getDay();
            for (let i = 0; i < firstDow; i++) cells.push(<div key={`pad-${i}`} />);
            for (let day = 1; day <= monthEnd.getDate(); day++) {
              const date = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), day);
              const key = ymd(date);
              const dayRows = byDate[key] || [];
              const approved = dayRows.filter((r) => r.status === 'approved').length;
              const pending = dayRows.filter((r) => r.status === 'draft' || r.status === 'image_pending').length;
              const published = dayRows.filter((r) => r.status === 'published').length;
              const isToday = key === ymd(new Date());
              return (
                <div
                  key={key}
                  className={`min-h-[80px] rounded-md border p-1.5 ${isToday ? 'border-primary bg-primary/5' : 'border-border bg-card/40'}`}
                >
                  <div className="text-[11px] font-semibold text-muted-foreground mb-1">{day}</div>
                  <div className="space-y-1">
                    {dayRows.slice(0, 3).map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setEditingRow(r)}
                        className="w-full text-left text-[10px] leading-tight truncate rounded px-1 py-0.5 hover:bg-secondary"
                        title={r.question}
                      >
                        <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle ${
                          r.status === 'approved' ? 'bg-emerald-500' :
                          r.status === 'published' ? 'bg-primary' :
                          r.status === 'image_pending' ? 'bg-amber-500' :
                          r.status === 'skipped' ? 'bg-destructive' : 'bg-muted-foreground'
                        }`} />
                        {r.question.slice(0, 22)}
                      </button>
                    ))}
                    {dayRows.length > 3 && (
                      <div className="text-[10px] text-muted-foreground">+{dayRows.length - 3} more</div>
                    )}
                  </div>
                  {(approved + pending + published) > 0 && (
                    <div className="flex gap-0.5 mt-1">
                      {approved > 0 && <span className="text-[9px] px-1 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">{approved}✓</span>}
                      {pending > 0 && <span className="text-[9px] px-1 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400">{pending}⏳</span>}
                      {published > 0 && <span className="text-[9px] px-1 rounded bg-primary/15 text-primary">{published}●</span>}
                    </div>
                  )}
                </div>
              );
            }
            return cells;
          })()}
        </div>
      )}

      {/* List view of all month rows */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground">All rows this month ({rows.length})</h3>
        {rows.map((r) => (
          <div key={r.id} className="rounded-lg border p-3 bg-card/40 flex flex-wrap gap-3 items-start">
            <div className="flex-1 min-w-[240px]">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-muted-foreground">{r.release_date}</span>
                {r.category && <Badge variant="outline" className="text-[10px]">{r.category}</Badge>}
                <Badge className={`text-[10px] ${STATUS_STYLES[r.status]}`}>{r.status}</Badge>
              </div>
              <p className="text-sm font-semibold leading-snug">{r.question}</p>
              <p className="text-xs text-muted-foreground mt-0.5">A: {r.option_a} • B: {r.option_b}</p>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => setEditingRow(r)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => generateImage(r, 'both')}
                disabled={generatingId === r.id}
              >
                {generatingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              </Button>
              {r.status !== 'approved' && r.status !== 'published' && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => setStatus(r, 'approved')}
                  disabled={!r.image_a_url || !r.image_b_url}
                  title={!r.image_a_url || !r.image_b_url ? 'Add/approve images first' : 'Approve for release'}
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => deleteRow.mutate(r.id)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg">
            No polls scheduled this month. Upload a CSV to get started.
          </div>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editingRow} onOpenChange={(o) => !o && setEditingRow(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit calendar entry</DialogTitle>
          </DialogHeader>
          {editingRow && (
            <EditForm
              row={editingRow}
              onSave={(patch) => {
                updateRow.mutate({ id: editingRow.id, ...patch });
                setEditingRow(null);
              }}
              onAcceptAi={(opt) => acceptAiImage(editingRow, opt)}
              onGen={(opt) => generateImage(editingRow, opt)}
              generating={generatingId === editingRow.id}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditForm({
  row, onSave, onAcceptAi, onGen, generating,
}: {
  row: CalendarRow;
  onSave: (patch: Partial<CalendarRow>) => void;
  onAcceptAi: (opt: 'A' | 'B') => void;
  onGen: (opt: 'A' | 'B' | 'both') => void;
  generating: boolean;
}) {
  const [form, setForm] = useState({ ...row });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Release date</Label>
          <Input type="date" value={form.release_date} onChange={(e) => setForm({ ...form, release_date: e.target.value })} />
        </div>
        <div>
          <Label>Category</Label>
          <Input value={form.category || ''} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        </div>
      </div>
      <div>
        <Label>Question</Label>
        <Textarea value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Option A</Label>
          <Input value={form.option_a} onChange={(e) => setForm({ ...form, option_a: e.target.value })} />
        </div>
        <div>
          <Label>Option B</Label>
          <Input value={form.option_b} onChange={(e) => setForm({ ...form, option_b: e.target.value })} />
        </div>
      </div>

      {/* Image A */}
      <ImageBlock
        label="Image A"
        approved={form.image_a_url}
        preview={form.ai_image_a_preview}
        onApprove={() => onAcceptAi('A')}
        onGen={() => onGen('A')}
        onUrlChange={(v) => setForm({ ...form, image_a_url: v })}
        generating={generating}
      />
      <ImageBlock
        label="Image B"
        approved={form.image_b_url}
        preview={form.ai_image_b_preview}
        onApprove={() => onAcceptAi('B')}
        onGen={() => onGen('B')}
        onUrlChange={(v) => setForm({ ...form, image_b_url: v })}
        generating={generating}
      />

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Country</Label>
          <Input value={form.target_country || ''} onChange={(e) => setForm({ ...form, target_country: e.target.value })} placeholder="Egypt" />
        </div>
        <div>
          <Label>Age range</Label>
          <Input value={form.target_age_range || ''} onChange={(e) => setForm({ ...form, target_age_range: e.target.value })} placeholder="18-24" />
        </div>
        <div>
          <Label>Gender</Label>
          <Input value={form.target_gender || ''} onChange={(e) => setForm({ ...form, target_gender: e.target.value })} placeholder="male/female" />
        </div>
      </div>

      <div>
        <Label>Why it will go viral (notes)</Label>
        <Textarea value={form.why_viral || ''} onChange={(e) => setForm({ ...form, why_viral: e.target.value })} rows={2} />
      </div>
      <div>
        <Label>Source</Label>
        <Input value={form.source || ''} onChange={(e) => setForm({ ...form, source: e.target.value })} />
      </div>

      {(!form.image_a_url || !form.image_b_url) && (
        <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5" /> Both images must be approved before this row can be marked Approved.
        </div>
      )}

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={() => onSave(form)}>Save changes</Button>
      </DialogFooter>
    </div>
  );
}

function ImageBlock({
  label, approved, preview, onApprove, onGen, onUrlChange, generating,
}: {
  label: string;
  approved: string | null;
  preview: string | null;
  onApprove: () => void;
  onGen: () => void;
  onUrlChange: (v: string) => void;
  generating: boolean;
}) {
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">{label}</Label>
        <Button size="sm" variant="outline" onClick={onGen} disabled={generating}>
          {generating ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
          AI generate
        </Button>
      </div>
      <Input value={approved || ''} onChange={(e) => onUrlChange(e.target.value)} placeholder="https://..." className="text-xs" />
      <div className="grid grid-cols-2 gap-2">
        <div className="text-center">
          <div className="text-[10px] text-muted-foreground mb-1">Approved</div>
          {approved ? (
            <img src={approved} alt="" className="aspect-square w-full rounded object-cover border" />
          ) : (
            <div className="aspect-square w-full rounded border-dashed border flex items-center justify-center text-muted-foreground">
              <ImageIcon className="h-6 w-6" />
            </div>
          )}
        </div>
        <div className="text-center">
          <div className="text-[10px] text-muted-foreground mb-1">AI preview (pending)</div>
          {preview ? (
            <>
              <img src={preview} alt="" className="aspect-square w-full rounded object-cover border-2 border-amber-500" />
              <Button size="sm" variant="default" className="mt-1 h-7 text-xs" onClick={onApprove}>
                <Check className="h-3 w-3 mr-1" /> Approve
              </Button>
            </>
          ) : (
            <div className="aspect-square w-full rounded border-dashed border flex items-center justify-center text-muted-foreground">
              <ImageIcon className="h-6 w-6 opacity-40" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
