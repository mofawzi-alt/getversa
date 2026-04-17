import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Download, Users, BarChart3, Loader2 } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { toast } from 'sonner';
// jspdf + html2canvas are dynamically imported inside handleExportPdf to keep them out of the main bundle

interface ClientCampaign {
  campaign_id: string;
  name: string;
  brand_name: string | null;
  brand_logo_url: string | null;
  description: string | null;
  is_active: boolean;
  release_at: string | null;
  expires_at: string | null;
  poll_count: number;
  total_votes: number;
}

interface PollAnalytics {
  poll_id: string;
  question: string;
  option_a: string;
  option_b: string;
  total_votes: number;
  votes_a: number;
  votes_b: number;
  percent_a: number;
  percent_b: number;
}

interface DemoRow {
  segment_type: string;
  segment_value: string;
  choice: string;
  vote_count: number;
}

export default function BrandClientPortal() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const reportRef = useRef<HTMLDivElement>(null);

  const [campaigns, setCampaigns] = useState<ClientCampaign[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [polls, setPolls] = useState<PollAnalytics[]>([]);
  const [demos, setDemos] = useState<DemoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Load campaigns the client can see
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_my_client_campaigns');
      if (error) {
        toast.error('Could not load your campaigns');
      } else {
        const list = (data || []) as ClientCampaign[];
        setCampaigns(list);
        if (list.length > 0) setSelectedId(list[0].campaign_id);
      }
      setLoading(false);
    })();
  }, [user]);

  // Load detail for selected campaign
  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      setLoadingDetail(true);
      const [analyticsRes, demoRes] = await Promise.all([
        supabase.rpc('get_campaign_analytics', { p_campaign_id: selectedId }),
        supabase.rpc('get_campaign_demographics', { p_campaign_id: selectedId }),
      ]);
      if (analyticsRes.error) toast.error('Could not load analytics');
      else setPolls((analyticsRes.data || []) as PollAnalytics[]);
      if (demoRes.error) toast.error('Could not load demographics');
      else setDemos((demoRes.data || []) as DemoRow[]);
      setLoadingDetail(false);
    })();
  }, [selectedId]);

  const selected = campaigns.find((c) => c.campaign_id === selectedId);

  const totalVotes = useMemo(() => polls.reduce((s, p) => s + Number(p.total_votes), 0), [polls]);

  const genderData = useMemo(() => aggregateSegment(demos, 'gender'), [demos]);
  const ageData = useMemo(() => aggregateSegment(demos, 'age'), [demos]);
  const cityData = useMemo(() => aggregateSegment(demos, 'city').slice(0, 8), [demos]);

  const handleExportPdf = async () => {
    if (!reportRef.current || !selected) return;
    setExporting(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });
      const img = canvas.toDataURL('image/jpeg', 0.92);
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW - 20;
      const imgH = (canvas.height * imgW) / canvas.width;
      let y = 10;
      let remaining = imgH;
      // Single image; if too tall, split
      if (imgH <= pageH - 20) {
        pdf.addImage(img, 'JPEG', 10, y, imgW, imgH);
      } else {
        // simple paging
        const pageImgH = pageH - 20;
        let sY = 0;
        while (remaining > 0) {
          const sliceCanvas = document.createElement('canvas');
          const sliceH = Math.min((pageImgH * canvas.width) / imgW, canvas.height - sY);
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = sliceH;
          const ctx = sliceCanvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
            ctx.drawImage(canvas, 0, sY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
          }
          const sliceImg = sliceCanvas.toDataURL('image/jpeg', 0.92);
          const sliceImgH = (sliceH * imgW) / canvas.width;
          pdf.addImage(sliceImg, 'JPEG', 10, 10, imgW, sliceImgH);
          sY += sliceH;
          remaining -= sliceImgH;
          if (remaining > 0) pdf.addPage();
        }
      }
      const filename = `${(selected.brand_name || selected.name).replace(/\s+/g, '-')}-campaign-report.pdf`;
      pdf.save(filename);
      toast.success('Report downloaded');
    } catch (e) {
      console.error(e);
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="p-8 max-w-md text-center space-y-4">
          <h1 className="text-xl font-semibold">No campaigns assigned</h1>
          <p className="text-sm text-muted-foreground">
            Your account isn't linked to any active campaigns yet. Contact your account manager.
          </p>
          <Button variant="outline" onClick={() => signOut().then(() => navigate('/auth'))}>
            Sign out
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/home')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-base font-semibold">Brand Portal</h1>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleExportPdf}
            disabled={exporting || !selected}
            className="gap-2"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export PDF
          </Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 space-y-4">
        {/* Campaign selector */}
        {campaigns.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {campaigns.map((c) => (
              <button
                key={c.campaign_id}
                onClick={() => setSelectedId(c.campaign_id)}
                className={`px-4 py-2 rounded-full text-sm whitespace-nowrap border transition ${
                  selectedId === c.campaign_id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card hover:bg-accent border-border'
                }`}
              >
                {c.brand_name || c.name}
              </button>
            ))}
          </div>
        )}

        {selected && (
          <div ref={reportRef} className="space-y-4 bg-background p-2">
            {/* Campaign header */}
            <Card className="p-6">
              <div className="flex items-start gap-4">
                {selected.brand_logo_url && (
                  <img
                    src={selected.brand_logo_url}
                    alt={selected.brand_name || ''}
                    className="w-16 h-16 rounded-lg object-cover bg-muted"
                  />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold">{selected.name}</h2>
                    <Badge variant={selected.is_active ? 'default' : 'secondary'}>
                      {selected.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  {selected.brand_name && (
                    <p className="text-sm text-muted-foreground mt-1">{selected.brand_name}</p>
                  )}
                  {selected.description && (
                    <p className="text-sm mt-2">{selected.description}</p>
                  )}
                </div>
              </div>
            </Card>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Kpi icon={<BarChart3 className="w-4 h-4" />} label="Polls" value={polls.length} />
              <Kpi icon={<Users className="w-4 h-4" />} label="Total votes" value={totalVotes.toLocaleString()} />
              <Kpi
                icon={<BarChart3 className="w-4 h-4" />}
                label="Avg per poll"
                value={polls.length ? Math.round(totalVotes / polls.length).toLocaleString() : '0'}
              />
            </div>

            {loadingDetail ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <>
                {/* Per-poll results */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-3">Results by poll</h3>
                  <div className="space-y-4">
                    {polls.map((p) => (
                      <div key={p.poll_id} className="space-y-2">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="text-sm font-medium line-clamp-2">{p.question}</p>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {Number(p.total_votes).toLocaleString()} votes
                          </span>
                        </div>
                        <div className="flex h-8 rounded-md overflow-hidden bg-muted text-xs font-medium">
                          <div
                            className="bg-primary text-primary-foreground flex items-center justify-center px-2"
                            style={{ width: `${p.percent_a}%`, minWidth: p.percent_a > 0 ? '40px' : 0 }}
                            title={p.option_a}
                          >
                            {p.percent_a > 8 ? `${p.option_a} ${p.percent_a}%` : ''}
                          </div>
                          <div
                            className="bg-foreground text-background flex items-center justify-center px-2"
                            style={{ width: `${p.percent_b}%`, minWidth: p.percent_b > 0 ? '40px' : 0 }}
                            title={p.option_b}
                          >
                            {p.percent_b > 8 ? `${p.option_b} ${p.percent_b}%` : ''}
                          </div>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{p.option_a}: {p.percent_a}%</span>
                          <span>{p.option_b}: {p.percent_b}%</span>
                        </div>
                      </div>
                    ))}
                    {polls.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        No polls in this campaign yet.
                      </p>
                    )}
                  </div>
                </Card>

                {/* Demographics */}
                {totalVotes > 0 && (
                  <div className="grid md:grid-cols-2 gap-3">
                    <DemoChart title="By gender" data={genderData} />
                    <DemoChart title="By age" data={ageData} />
                    <Card className="p-4 md:col-span-2">
                      <h3 className="font-semibold mb-3 text-sm">Top cities</h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={cityData} layout="vertical" margin={{ left: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis type="category" dataKey="label" width={80} fontSize={11} />
                            <Tooltip />
                            <Bar dataKey="total" fill="hsl(var(--primary))" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        {icon}
        {label}
      </div>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </Card>
  );
}

function DemoChart({ title, data }: { title: string; data: Array<{ label: string; A: number; B: number; total: number }> }) {
  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-3 text-sm">{title}</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip />
            <Bar dataKey="A" stackId="s" fill="hsl(var(--primary))" />
            <Bar dataKey="B" stackId="s" fill="hsl(var(--foreground))" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function aggregateSegment(rows: DemoRow[], type: string) {
  const map = new Map<string, { label: string; A: number; B: number; total: number }>();
  for (const r of rows) {
    if (r.segment_type !== type) continue;
    const key = r.segment_value || 'unknown';
    const cur = map.get(key) || { label: key, A: 0, B: 0, total: 0 };
    if (r.choice === 'A') cur.A += Number(r.vote_count);
    else if (r.choice === 'B') cur.B += Number(r.vote_count);
    cur.total = cur.A + cur.B;
    map.set(key, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}
