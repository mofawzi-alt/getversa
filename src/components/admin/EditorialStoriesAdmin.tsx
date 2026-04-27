import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Plus, Eye, Trash2, Zap, Pencil, Play } from 'lucide-react';
import { EDITORIAL_STORY_META, type EditorialStoryType } from '@/lib/editorialStoryTypes';
import EditorialStoryViewer from '@/components/pulse/EditorialStoryViewer';

type StoryRow = {
  id: string; story_type: EditorialStoryType; source: 'manual' | 'auto';
  status: 'draft' | 'published' | 'expired';
  headline: string; cards: any;
  poll_id: string | null; cta_poll_id: string | null;
  total_real_votes: number;
  publish_at: string | null; expires_at: string | null;
  views: number; completions: number; vote_taps: number;
  card_dropoff: Record<string, number>;
  created_at: string;
};

const MANUAL_TYPES: EditorialStoryType[] = ['egypt_today', 'this_week'];

export default function EditorialStoriesAdmin() {
  const qc = useQueryClient();
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<StoryRow | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [previewStory, setPreviewStory] = useState<StoryRow | null>(null);

  const { data: stories, isLoading } = useQuery({
    queryKey: ['admin-editorial-stories', filterType, filterStatus],
    queryFn: async () => {
      let q = (supabase as any).from('editorial_stories').select('*').order('created_at', { ascending: false }).limit(200);
      if (filterType !== 'all') q = q.eq('story_type', filterType);
      if (filterStatus !== 'all') q = q.eq('status', filterStatus);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as StoryRow[];
    },
  });

  const triggerAutoGen = useMutation({
    mutationFn: async (type?: string) => {
      const url = type ? `?type=${type}` : '';
      const { error } = await (supabase as any).functions.invoke(`generate-editorial-stories${url}`, { method: 'POST' });
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Auto-generation triggered'); qc.invalidateQueries({ queryKey: ['admin-editorial-stories'] }); qc.invalidateQueries({ queryKey: ['editorial-stories-published'] }); },
    onError: (e: any) => toast.error(e.message || 'Failed'),
  });

  const deleteStory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('editorial_stories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Story deleted'); qc.invalidateQueries({ queryKey: ['admin-editorial-stories'] }); qc.invalidateQueries({ queryKey: ['editorial-stories-published'] }); },
  });

  const summary = useMemo(() => {
    if (!stories) return { total: 0, totalViews: 0, avgCompletion: 0, totalVoteTaps: 0 };
    const total = stories.length;
    const totalViews = stories.reduce((s, x) => s + (x.views || 0), 0);
    const totalCompletions = stories.reduce((s, x) => s + (x.completions || 0), 0);
    const totalVoteTaps = stories.reduce((s, x) => s + (x.vote_taps || 0), 0);
    const avgCompletion = totalViews > 0 ? Math.round((totalCompletions / totalViews) * 100) : 0;
    return { total, totalViews, avgCompletion, totalVoteTaps };
  }, [stories]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Editorial Stories</h2>
          <p className="text-sm text-muted-foreground">5-card editorial stories for the home stories row</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => triggerAutoGen.mutate(undefined)} disabled={triggerAutoGen.isPending}>
            {triggerAutoGen.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
            Run auto-gen now
          </Button>
          <Button onClick={() => { setEditing(null); setShowEditor(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Create story
          </Button>
        </div>
      </div>

      {/* Analytics cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Stories</p><p className="text-2xl font-bold">{summary.total}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Total views</p><p className="text-2xl font-bold">{summary.totalViews}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Avg completion</p><p className="text-2xl font-bold">{summary.avgCompletion}%</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Vote taps</p><p className="text-2xl font-bold">{summary.totalVoteTaps}</p></Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {(Object.keys(EDITORIAL_STORY_META) as EditorialStoryType[]).map(t => (
              <SelectItem key={t} value={t}>{EDITORIAL_STORY_META[t].emoji} {EDITORIAL_STORY_META[t].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stories list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : (
        <div className="space-y-2">
          {(stories || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No stories yet — create one or run auto-gen.</p>}
          {(stories || []).map(story => {
            const meta = EDITORIAL_STORY_META[story.story_type];
            const completionRate = story.views > 0 ? Math.round((story.completions / story.views) * 100) : 0;
            return (
              <Card key={story.id} className="p-3 flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0"
                  style={{ backgroundColor: meta?.bgTint, color: meta?.color }}
                >{meta?.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{meta?.label}</span>
                    {story.source === 'auto'
                      ? <Badge variant="secondary" className="text-[10px]">⚡ Auto</Badge>
                      : <Badge variant="outline" className="text-[10px]">✏️ Manual</Badge>}
                    <Badge
                      variant={story.status === 'published' ? 'default' : story.status === 'draft' ? 'outline' : 'secondary'}
                      className="text-[10px]"
                    >{story.status}</Badge>
                  </div>
                  <p className="text-sm truncate">{story.headline}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {story.views} views • {completionRate}% completed • {story.vote_taps} taps
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setPreviewStory(story)} title="Preview"><Eye className="w-4 h-4" /></Button>
                  {MANUAL_TYPES.includes(story.story_type) && (
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(story); setShowEditor(true); }} title="Edit"><Pencil className="w-4 h-4" /></Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm('Delete this story?')) deleteStory.mutate(story.id); }} title="Delete"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showEditor && (
        <StoryEditorDialog
          story={editing}
          onClose={() => { setShowEditor(false); setEditing(null); }}
          onSaved={() => {
            setShowEditor(false); setEditing(null);
            qc.invalidateQueries({ queryKey: ['admin-editorial-stories'] });
            qc.invalidateQueries({ queryKey: ['editorial-stories-published'] });
          }}
        />
      )}

      <EditorialStoryViewer
        open={!!previewStory}
        story={previewStory as any}
        onClose={() => setPreviewStory(null)}
      />
    </div>
  );
}

// ─── Editor Dialog ───
function StoryEditorDialog({
  story, onClose, onSaved,
}: {
  story: StoryRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<EditorialStoryType>(story?.story_type || 'egypt_today');
  const [headline, setHeadline] = useState(story?.cards?.hook?.headline || story?.headline || '');
  const [bigStat, setBigStat] = useState(story?.cards?.hook?.bigStat || '');
  const [hookSub, setHookSub] = useState(story?.cards?.hook?.subtext || '');
  const [pollSearch, setPollSearch] = useState('');
  const [pollId, setPollId] = useState<string | null>(story?.poll_id || null);
  const [demoLabel, setDemoLabel] = useState(story?.cards?.data?.demographic_split?.label || '');
  const [demoSelect, setDemoSelect] = useState<'gender' | 'age' | 'city' | 'none'>('none');
  const [insightText, setInsightText] = useState(story?.cards?.insight?.text || '');
  const [insightEmoji, setInsightEmoji] = useState(story?.cards?.insight?.emoji || EDITORIAL_STORY_META[story?.story_type || 'egypt_today'].emoji);
  const [connText, setConnText] = useState(story?.cards?.connection?.text || '');
  const [sourceName, setSourceName] = useState(story?.cards?.connection?.sourceName || '');
  const [sourceUrl, setSourceUrl] = useState(story?.cards?.connection?.sourceUrl || '');
  const [ctaPollId, setCtaPollId] = useState<string | null>(story?.cta_poll_id || story?.poll_id || null);
  const [ctaLabel, setCtaLabel] = useState(story?.cards?.action?.ctaLabel || 'Vote now →');
  const [publishMode, setPublishMode] = useState<'draft' | 'now' | 'schedule'>('draft');
  const [scheduleAt, setScheduleAt] = useState('');
  const [extendExpiry, setExtendExpiry] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Poll search
  const { data: searchResults } = useQuery({
    queryKey: ['editor-poll-search', pollSearch],
    enabled: pollSearch.length >= 2,
    queryFn: async () => {
      const { data } = await supabase.from('polls')
        .select('id, question, option_a, option_b, image_a_url, image_b_url, category')
        .ilike('question', `%${pollSearch}%`).limit(8);
      return data || [];
    },
  });

  // Selected poll data
  const { data: selectedPoll } = useQuery({
    queryKey: ['editor-poll', pollId],
    enabled: !!pollId,
    queryFn: async () => {
      const { data } = await supabase.from('polls')
        .select('id, question, option_a, option_b, image_a_url, image_b_url, category')
        .eq('id', pollId!).maybeSingle();
      return data;
    },
  });

  // Real votes for selected poll
  const { data: voteData } = useQuery({
    queryKey: ['editor-poll-votes', pollId, demoSelect],
    enabled: !!pollId,
    queryFn: async () => {
      const { data } = await supabase.from('votes')
        .select('choice, voter_age_range, voter_gender, voter_city')
        .eq('poll_id', pollId!).limit(5000);
      return data || [];
    },
  });

  const computed = useMemo(() => {
    if (!voteData) return null;
    const total = voteData.length;
    const a = voteData.filter((v: any) => v.choice === 'A').length;
    const pctA = total > 0 ? Math.round((a / total) * 100) : 0;
    let demoSplit: any = undefined;
    if (demoSelect === 'gender') {
      const m = voteData.filter((v: any) => v.voter_gender === 'male');
      const f = voteData.filter((v: any) => v.voter_gender === 'female');
      const mPctA = m.length > 0 ? Math.round((m.filter((v: any) => v.choice === 'A').length / m.length) * 100) : 0;
      const fPctA = f.length > 0 ? Math.round((f.filter((v: any) => v.choice === 'A').length / f.length) * 100) : 0;
      demoSplit = { label: demoLabel || `${selectedPoll?.option_a} preference by gender`, a_value: 'Women', a_pct: fPctA, b_value: 'Men', b_pct: mPctA };
    } else if (demoSelect === 'age') {
      const young = voteData.filter((v: any) => v.voter_age_range === '18-24');
      const old = voteData.filter((v: any) => ['35-44','45-54','55+','35+'].includes(v.voter_age_range));
      const yPctA = young.length > 0 ? Math.round((young.filter((v: any) => v.choice === 'A').length / young.length) * 100) : 0;
      const oPctA = old.length > 0 ? Math.round((old.filter((v: any) => v.choice === 'A').length / old.length) * 100) : 0;
      demoSplit = { label: demoLabel || `${selectedPoll?.option_a} preference by age`, a_value: '18-24', a_pct: yPctA, b_value: '35+', b_pct: oPctA };
    } else if (demoSelect === 'city') {
      const cairo = voteData.filter((v: any) => (v.voter_city || '').toLowerCase() === 'cairo');
      const alex = voteData.filter((v: any) => (v.voter_city || '').toLowerCase() === 'alexandria');
      const cPctA = cairo.length > 0 ? Math.round((cairo.filter((v: any) => v.choice === 'A').length / cairo.length) * 100) : 0;
      const aPctA = alex.length > 0 ? Math.round((alex.filter((v: any) => v.choice === 'A').length / alex.length) * 100) : 0;
      demoSplit = { label: demoLabel || `${selectedPoll?.option_a} preference by city`, a_value: 'Cairo', a_pct: cPctA, b_value: 'Alexandria', b_pct: aPctA };
    }
    return { total, pctA, demoSplit };
  }, [voteData, demoSelect, demoLabel, selectedPoll]);

  function buildCards() {
    return {
      hook: { headline, bigStat, subtext: hookSub },
      data: selectedPoll && computed ? {
        question: selectedPoll.question,
        option_a: selectedPoll.option_a, option_b: selectedPoll.option_b,
        pct_a: computed.pctA, pct_b: 100 - computed.pctA,
        total_votes: computed.total,
        image_a_url: selectedPoll.image_a_url, image_b_url: selectedPoll.image_b_url,
        demographic_split: computed.demoSplit,
      } : undefined,
      insight: { emoji: insightEmoji, text: insightText, basedOnVotes: computed?.total || 0 },
      connection: { text: connText, sourceName: sourceName || null, sourceUrl: sourceUrl || null, trend: null },
      action: { ctaLabel },
    };
  }

  async function save() {
    if (!headline.trim() || !bigStat.trim()) {
      toast.error('Headline and big stat are required'); return;
    }
    if (!pollId) { toast.error('Pick a poll for the data card'); return; }
    if (!insightText.trim()) { toast.error('Insight text is required'); return; }

    const cards = buildCards();
    let publishAt: string | null = null;
    let status: 'draft' | 'published' = 'draft';
    if (publishMode === 'now') { publishAt = new Date().toISOString(); status = 'published'; }
    else if (publishMode === 'schedule' && scheduleAt) { publishAt = new Date(scheduleAt).toISOString(); status = 'published'; }

    const expiresHours = extendExpiry ? 48 : 24;
    const expiresAt = publishAt
      ? new Date(new Date(publishAt).getTime() + expiresHours * 3600 * 1000).toISOString()
      : null;

    setSaving(true);
    try {
      const payload: any = {
        story_type: type, source: 'manual', status,
        headline, cards, poll_id: pollId, cta_poll_id: ctaPollId || pollId,
        total_real_votes: computed?.total || 0,
        publish_at: publishAt, expires_at: expiresAt,
      };
      if (story?.id) {
        const { error } = await (supabase as any).from('editorial_stories').update(payload).eq('id', story.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('editorial_stories').insert(payload);
        if (error) throw error;
      }
      toast.success(story?.id ? 'Story updated' : 'Story created');
      onSaved();
    } catch (e: any) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const previewStory = useMemo(() => ({
    id: story?.id || 'preview',
    story_type: type,
    source: 'manual' as const,
    status: 'published' as const,
    headline,
    cards: buildCards(),
    poll_id: pollId,
    cta_poll_id: ctaPollId || pollId,
    total_real_votes: computed?.total || 0,
    publish_at: new Date().toISOString(),
    expires_at: null,
    views: 0, completions: 0, vote_taps: 0,
    card_dropoff: { '1':0,'2':0,'3':0,'4':0,'5':0 },
    created_at: new Date().toISOString(),
  }), [type, headline, bigStat, hookSub, pollId, ctaPollId, ctaLabel, insightText, insightEmoji, connText, sourceName, sourceUrl, demoSelect, demoLabel, computed]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{story?.id ? 'Edit story' : 'Create editorial story'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Type */}
            <div>
              <Label>Story type</Label>
              <Select value={type} onValueChange={(v) => setType(v as EditorialStoryType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MANUAL_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{EDITORIAL_STORY_META[t].emoji} {EDITORIAL_STORY_META[t].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Manual story types only. Other types are auto-generated.</p>
            </div>

            {/* Card 1 */}
            <Card className="p-4 space-y-3">
              <h4 className="font-semibold text-sm">Card 1 — Hook</h4>
              <div>
                <Label>Headline (max 8 words) — {headline.split(/\s+/).filter(Boolean).length}/8</Label>
                <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="One bold headline" />
              </div>
              <div>
                <Label>Big stat (e.g. "73%" or "1.2M")</Label>
                <Input value={bigStat} onChange={(e) => setBigStat(e.target.value)} />
              </div>
              <div>
                <Label>Subtext (one line)</Label>
                <Input value={hookSub} onChange={(e) => setHookSub(e.target.value)} placeholder="What does the number mean?" />
              </div>
            </Card>

            {/* Card 2 */}
            <Card className="p-4 space-y-3">
              <h4 className="font-semibold text-sm">Card 2 — Data (auto from real poll)</h4>
              <div>
                <Label>Search poll</Label>
                <Input value={pollSearch} onChange={(e) => setPollSearch(e.target.value)} placeholder="Type a question…" />
                {(searchResults?.length || 0) > 0 && (
                  <div className="mt-2 border rounded-md max-h-48 overflow-y-auto">
                    {searchResults!.map((p: any) => (
                      <button key={p.id} type="button"
                        onClick={() => { setPollId(p.id); setCtaPollId(p.id); setPollSearch(''); }}
                        className="block w-full text-left p-2 text-sm hover:bg-muted border-b last:border-b-0">
                        <div className="font-medium truncate">{p.question}</div>
                        <div className="text-xs text-muted-foreground">{p.option_a} vs {p.option_b}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedPoll && (
                <div className="text-xs bg-muted/50 p-2 rounded">
                  ✓ {selectedPoll.question} — {computed?.total || 0} real votes ({computed?.pctA || 0}% / {100 - (computed?.pctA || 0)}%)
                </div>
              )}
              <div>
                <Label>Highlight demographic split</Label>
                <Select value={demoSelect} onValueChange={(v) => setDemoSelect(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="gender">Gender (Women vs Men)</SelectItem>
                    <SelectItem value="age">Age (18-24 vs 35+)</SelectItem>
                    <SelectItem value="city">City (Cairo vs Alexandria)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>

            {/* Card 3 */}
            <Card className="p-4 space-y-3">
              <h4 className="font-semibold text-sm">Card 3 — Insight</h4>
              <div>
                <Label>Emoji</Label>
                <Input value={insightEmoji} onChange={(e) => setInsightEmoji(e.target.value)} className="w-20" />
              </div>
              <div>
                <Label>Editorial text — {insightText.length}/280 chars</Label>
                <Textarea
                  value={insightText} maxLength={280} rows={4}
                  onChange={(e) => setInsightText(e.target.value)}
                  placeholder="Write as a journalist. What does this data mean for Egypt? Be specific and surprising."
                />
              </div>
            </Card>

            {/* Card 4 */}
            <Card className="p-4 space-y-3">
              <h4 className="font-semibold text-sm">Card 4 — Connection</h4>
              <div>
                <Label>News connection or trend context</Label>
                <Textarea value={connText} onChange={(e) => setConnText(e.target.value)} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Source name (optional)</Label>
                  <Input value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder="Al Ahram" />
                </div>
                <div>
                  <Label>Source URL (optional)</Label>
                  <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://…" />
                </div>
              </div>
            </Card>

            {/* Card 5 */}
            <Card className="p-4 space-y-3">
              <h4 className="font-semibold text-sm">Card 5 — Action</h4>
              <div>
                <Label>CTA poll (defaults to Card 2 poll)</Label>
                <Input value={ctaPollId || ''} onChange={(e) => setCtaPollId(e.target.value || null)} placeholder="Same poll ID" />
              </div>
              <div>
                <Label>Button text</Label>
                <Input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} />
              </div>
            </Card>

            {/* Publishing */}
            <Card className="p-4 space-y-3">
              <h4 className="font-semibold text-sm">Publishing</h4>
              <Select value={publishMode} onValueChange={(v) => setPublishMode(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Save as draft</SelectItem>
                  <SelectItem value="now">Publish now</SelectItem>
                  <SelectItem value="schedule">Schedule</SelectItem>
                </SelectContent>
              </Select>
              {publishMode === 'schedule' && (
                <Input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={extendExpiry} onChange={(e) => setExtendExpiry(e.target.checked)} />
                Extend expiry to 48h (high-performing stories)
              </label>
            </Card>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPreview(true)}><Play className="w-4 h-4 mr-1" /> Preview</Button>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {story?.id ? 'Update story' : 'Save story'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditorialStoryViewer
        open={showPreview}
        story={previewStory as any}
        onClose={() => setShowPreview(false)}
      />
    </>
  );
}
