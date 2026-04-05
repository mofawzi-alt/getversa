import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Search, Loader2, Trophy, Users, TrendingUp, 
  Download, BarChart3, Target, Crown, MapPin,
  Sparkles, ChevronDown, ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface BrandPoll {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  category: string | null;
  brandSide: 'A' | 'B';
  competitor: string;
  totalVotes: number;
  brandVotes: number;
  competitorVotes: number;
  brandPercent: number;
  competitorPercent: number;
  won: boolean;
  expiryType: string;
  startsAt: string | null;
  endsAt: string | null;
  demographics: {
    gender: Record<string, { brand: number; total: number }>;
    age: Record<string, { brand: number; total: number }>;
    city: Record<string, { brand: number; total: number }>;
  };
}

interface CompetitorResult {
  name: string;
  polls: number;
  wins: number;
  losses: number;
  winRate: number;
  avgBrandPercent: number;
}

export default function BrandIntelligence() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeBrand, setActiveBrand] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [expandedPolls, setExpandedPolls] = useState<Set<string>>(new Set());
  const reportRef = useRef<HTMLDivElement>(null);

  // Fetch all polls
  const { data: allPolls } = useQuery({
    queryKey: ['brand-intel-polls'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, category, created_at, ends_at, starts_at, expiry_type')
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch poll cycles for brand battle history
  const { data: pollCycles } = useQuery({
    queryKey: ['brand-intel-cycles', activeBrand],
    queryFn: async () => {
      if (!activeBrand || !allPolls) return [];
      const brandPolls = allPolls.filter(p =>
        p.option_a.toLowerCase().includes(activeBrand.toLowerCase()) ||
        p.option_b.toLowerCase().includes(activeBrand.toLowerCase())
      );
      const battlePollIds = brandPolls.filter((p: any) => p.expiry_type === 'brand_battle').map(p => p.id);
      if (!battlePollIds.length) return [];
      const { data, error } = await supabase
        .from('poll_cycles')
        .select('*')
        .in('poll_id', battlePollIds)
        .order('cycle_end', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeBrand && !!allPolls,
  });

  // Fetch all votes when a brand is active
  const { data: allVotes, isLoading: votesLoading } = useQuery({
    queryKey: ['brand-intel-votes', activeBrand],
    queryFn: async () => {
      if (!activeBrand) return [];
      const brandPolls = allPolls?.filter(p => 
        p.option_a.toLowerCase().includes(activeBrand.toLowerCase()) ||
        p.option_b.toLowerCase().includes(activeBrand.toLowerCase())
      );
      if (!brandPolls?.length) return [];
      const pollIds = brandPolls.map(p => p.id);
      
      // Batch fetch in chunks of 50
      const chunks: string[][] = [];
      for (let i = 0; i < pollIds.length; i += 50) {
        chunks.push(pollIds.slice(i, i + 50));
      }
      
      const allVoteData: any[] = [];
      for (const chunk of chunks) {
        const { data, error } = await supabase
          .from('votes')
          .select('poll_id, choice, voter_gender, voter_age_range, voter_city')
          .in('poll_id', chunk);
        if (error) throw error;
        if (data) allVoteData.push(...data);
      }
      return allVoteData;
    },
    enabled: !!activeBrand && !!allPolls,
  });

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setActiveBrand(searchQuery.trim());
    }
  };

  // Process brand data
  const brandData = useMemo(() => {
    if (!activeBrand || !allPolls || !allVotes) return null;

    const term = activeBrand.toLowerCase();
    const matchingPolls = allPolls.filter(p =>
      p.option_a.toLowerCase().includes(term) ||
      p.option_b.toLowerCase().includes(term)
    );

    if (!matchingPolls.length) return null;

    const brandPolls: BrandPoll[] = matchingPolls.map(poll => {
      const isA = poll.option_a.toLowerCase().includes(term);
      const brandSide: 'A' | 'B' = isA ? 'A' : 'B';
      const competitor = isA ? poll.option_b : poll.option_a;
      const pollVotes = allVotes.filter(v => v.poll_id === poll.id);
      const totalVotes = pollVotes.length;
      const brandVotes = pollVotes.filter(v => v.choice === brandSide).length;
      const competitorVotes = totalVotes - brandVotes;
      const brandPercent = totalVotes > 0 ? Math.round((brandVotes / totalVotes) * 100) : 0;
      const competitorPercent = totalVotes > 0 ? 100 - brandPercent : 0;

      // Demographics
      const demographics = {
        gender: {} as Record<string, { brand: number; total: number }>,
        age: {} as Record<string, { brand: number; total: number }>,
        city: {} as Record<string, { brand: number; total: number }>,
      };

      pollVotes.forEach(v => {
        const isBrand = v.choice === brandSide;
        if (v.voter_gender) {
          if (!demographics.gender[v.voter_gender]) demographics.gender[v.voter_gender] = { brand: 0, total: 0 };
          demographics.gender[v.voter_gender].total++;
          if (isBrand) demographics.gender[v.voter_gender].brand++;
        }
        if (v.voter_age_range) {
          if (!demographics.age[v.voter_age_range]) demographics.age[v.voter_age_range] = { brand: 0, total: 0 };
          demographics.age[v.voter_age_range].total++;
          if (isBrand) demographics.age[v.voter_age_range].brand++;
        }
        if (v.voter_city) {
          if (!demographics.city[v.voter_city]) demographics.city[v.voter_city] = { brand: 0, total: 0 };
          demographics.city[v.voter_city].total++;
          if (isBrand) demographics.city[v.voter_city].brand++;
        }
      });

      return {
        id: poll.id,
        question: poll.question,
        option_a: poll.option_a,
        option_b: poll.option_b,
        category: poll.category,
        brandSide,
        competitor,
        totalVotes,
        brandVotes,
        competitorVotes,
        brandPercent,
        competitorPercent,
        won: brandPercent > competitorPercent,
        expiryType: (poll as any).expiry_type || 'evergreen',
        startsAt: (poll as any).starts_at || null,
        endsAt: (poll as any).ends_at || null,
        demographics,
      };
    });

    // Aggregate
    const totalVotes = brandPolls.reduce((s, p) => s + p.brandVotes, 0);
    const totalPollVotes = brandPolls.reduce((s, p) => s + p.totalVotes, 0);
    const wins = brandPolls.filter(p => p.won).length;
    const winRate = brandPolls.length > 0 ? Math.round((wins / brandPolls.length) * 100) : 0;

    // Top demographics
    const genderAgg: Record<string, { brand: number; total: number }> = {};
    const ageAgg: Record<string, { brand: number; total: number }> = {};
    const cityAgg: Record<string, { brand: number; total: number }> = {};

    brandPolls.forEach(p => {
      Object.entries(p.demographics.gender).forEach(([k, v]) => {
        if (!genderAgg[k]) genderAgg[k] = { brand: 0, total: 0 };
        genderAgg[k].brand += v.brand;
        genderAgg[k].total += v.total;
      });
      Object.entries(p.demographics.age).forEach(([k, v]) => {
        if (!ageAgg[k]) ageAgg[k] = { brand: 0, total: 0 };
        ageAgg[k].brand += v.brand;
        ageAgg[k].total += v.total;
      });
      Object.entries(p.demographics.city).forEach(([k, v]) => {
        if (!cityAgg[k]) cityAgg[k] = { brand: 0, total: 0 };
        cityAgg[k].brand += v.brand;
        cityAgg[k].total += v.total;
      });
    });

    const topGender = Object.entries(genderAgg)
      .map(([k, v]) => ({ name: k, rate: v.total > 0 ? Math.round((v.brand / v.total) * 100) : 0, votes: v.total }))
      .sort((a, b) => b.rate - a.rate)[0];
    const topAge = Object.entries(ageAgg)
      .map(([k, v]) => ({ name: k, rate: v.total > 0 ? Math.round((v.brand / v.total) * 100) : 0, votes: v.total }))
      .sort((a, b) => b.rate - a.rate)[0];
    const topCity = Object.entries(cityAgg)
      .map(([k, v]) => ({ name: k, rate: v.total > 0 ? Math.round((v.brand / v.total) * 100) : 0, votes: v.total }))
      .sort((a, b) => b.rate - a.rate)[0];

    // Competitor comparison
    const competitorMap: Record<string, { wins: number; losses: number; polls: number; totalBrandPercent: number }> = {};
    brandPolls.forEach(p => {
      const comp = p.competitor;
      if (!competitorMap[comp]) competitorMap[comp] = { wins: 0, losses: 0, polls: 0, totalBrandPercent: 0 };
      competitorMap[comp].polls++;
      competitorMap[comp].totalBrandPercent += p.brandPercent;
      if (p.won) competitorMap[comp].wins++;
      else competitorMap[comp].losses++;
    });

    const competitors: CompetitorResult[] = Object.entries(competitorMap)
      .map(([name, data]) => ({
        name,
        polls: data.polls,
        wins: data.wins,
        losses: data.losses,
        winRate: data.polls > 0 ? Math.round((data.wins / data.polls) * 100) : 0,
        avgBrandPercent: data.polls > 0 ? Math.round(data.totalBrandPercent / data.polls) : 0,
      }))
      .sort((a, b) => b.polls - a.polls);

    return {
      brandPolls,
      totalVotes,
      totalPollVotes,
      wins,
      winRate,
      pollCount: brandPolls.length,
      topGender,
      topAge,
      topCity,
      competitors,
      genderAgg,
      ageAgg,
      cityAgg,
    };
  }, [activeBrand, allPolls, allVotes]);

  const togglePollExpand = (id: string) => {
    setExpandedPolls(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getDemoInsight = (poll: BrandPoll): string => {
    const insights: string[] = [];
    // Find strongest demographic for the brand
    const genderEntries = Object.entries(poll.demographics.gender)
      .map(([k, v]) => ({ name: k, rate: v.total > 2 ? Math.round((v.brand / v.total) * 100) : 0, total: v.total }))
      .filter(e => e.total > 2)
      .sort((a, b) => b.rate - a.rate);
    const ageEntries = Object.entries(poll.demographics.age)
      .map(([k, v]) => ({ name: k, rate: v.total > 2 ? Math.round((v.brand / v.total) * 100) : 0, total: v.total }))
      .filter(e => e.total > 2)
      .sort((a, b) => b.rate - a.rate);
    const cityEntries = Object.entries(poll.demographics.city)
      .map(([k, v]) => ({ name: k, rate: v.total > 2 ? Math.round((v.brand / v.total) * 100) : 0, total: v.total }))
      .filter(e => e.total > 2)
      .sort((a, b) => b.rate - a.rate);

    if (genderEntries.length && ageEntries.length && cityEntries.length) {
      const top = genderEntries[0];
      const topA = ageEntries[0];
      const topC = cityEntries[0];
      insights.push(`${activeBrand} wins among ${top.name.toLowerCase()} aged ${topA.name} in ${topC.name} (${top.rate}%)`);
      if (genderEntries.length > 1) {
        const bottom = genderEntries[genderEntries.length - 1];
        if (bottom.rate < 50) {
          insights.push(`but trails among ${bottom.name.toLowerCase()} (${bottom.rate}%)`);
        }
      }
    }
    return insights.join(' ') || 'Not enough demographic data';
  };

  const handleExportPDF = async () => {
    if (!reportRef.current || !brandData) return;
    setIsExporting(true);
    
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      // Header
      pdf.setFillColor(15, 15, 25);
      pdf.rect(0, 0, pageWidth, 50, 'F');
      pdf.setFillColor(139, 92, 246);
      pdf.rect(0, 48, pageWidth, 2, 'F');

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Versa Brand Intelligence Report', margin, 22);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'normal');
      pdf.text(activeBrand, margin, 32);
      pdf.setFontSize(10);
      const now = new Date();
      const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      pdf.text(`${monthNames[now.getMonth()]} ${now.getFullYear()}`, margin, 42);
      pdf.text('Confidential', pageWidth - margin - pdf.getTextWidth('Confidential'), 42);

      y = 60;
      pdf.setTextColor(50, 50, 50);

      // Summary Section
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(139, 92, 246);
      pdf.text('Brand Summary', margin, y);
      y += 8;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(60, 60, 60);

      const summaryItems = [
        [`Total Polls Featuring ${activeBrand}`, `${brandData.pollCount}`],
        [`Total Votes Received`, `${brandData.totalVotes.toLocaleString()}`],
        [`Overall Win Rate`, `${brandData.winRate}%`],
        [`Wins / Losses`, `${brandData.wins}W — ${brandData.pollCount - brandData.wins}L`],
      ];
      if (brandData.topGender) summaryItems.push([`Top Gender`, `${brandData.topGender.name} (${brandData.topGender.rate}% preference)`]);
      if (brandData.topAge) summaryItems.push([`Top Age Group`, `${brandData.topAge.name} (${brandData.topAge.rate}% preference)`]);
      if (brandData.topCity) summaryItems.push([`Top City`, `${brandData.topCity.name} (${brandData.topCity.rate}% preference)`]);

      summaryItems.forEach(([label, value]) => {
        pdf.setFont('helvetica', 'bold');
        pdf.text(label, margin, y);
        pdf.setFont('helvetica', 'normal');
        pdf.text(value, margin + 80, y);
        y += 6;
      });

      y += 6;

      // Competitor Comparison
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(139, 92, 246);
      pdf.text('Competitor Comparison', margin, y);
      y += 8;

      pdf.setFontSize(9);
      // Table header
      pdf.setFillColor(245, 243, 255);
      pdf.rect(margin, y - 4, contentWidth, 7, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(80, 80, 80);
      pdf.text('Competitor', margin + 2, y);
      pdf.text('Matchups', margin + 60, y);
      pdf.text('W-L', margin + 85, y);
      pdf.text('Win Rate', margin + 105, y);
      pdf.text('Avg %', margin + 130, y);
      y += 7;

      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(60, 60, 60);
      brandData.competitors.forEach(comp => {
        if (y > pageHeight - 30) {
          pdf.addPage();
          y = margin;
        }
        pdf.text(comp.name, margin + 2, y);
        pdf.text(`${comp.polls}`, margin + 60, y);
        pdf.text(`${comp.wins}-${comp.losses}`, margin + 85, y);
        pdf.text(`${comp.winRate}%`, margin + 105, y);
        pdf.text(`${comp.avgBrandPercent}%`, margin + 130, y);
        y += 6;
      });

      y += 8;

      // Poll-by-Poll
      if (y > pageHeight - 60) { pdf.addPage(); y = margin; }
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(139, 92, 246);
      pdf.text('Poll-by-Poll Breakdown', margin, y);
      y += 8;

      pdf.setFontSize(9);
      brandData.brandPolls.forEach((poll, idx) => {
        if (y > pageHeight - 40) { pdf.addPage(); y = margin; }
        
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(40, 40, 40);
        pdf.text(`${idx + 1}. ${poll.question}`, margin, y);
        y += 5;
        
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(60, 60, 60);
        const resultText = `${activeBrand} ${poll.brandPercent}% vs ${poll.competitor} ${poll.competitorPercent}% (${poll.totalVotes} votes)`;
        pdf.text(resultText, margin + 4, y);
        y += 5;

        const insight = getDemoInsight(poll);
        if (insight !== 'Not enough demographic data') {
          pdf.setFontSize(8);
          pdf.setTextColor(139, 92, 246);
          pdf.text(`↳ ${insight}`, margin + 4, y);
          pdf.setFontSize(9);
          y += 5;
        }
        y += 3;
      });

      // Footer
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.text(`Versa Brand Intelligence — ${activeBrand} — Confidential`, margin, pageHeight - 8);
        pdf.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 20, pageHeight - 8);
      }

      pdf.save(`Versa-Brand-Intelligence-${activeBrand}-${monthNames[now.getMonth()]}-${now.getFullYear()}.pdf`);
      toast.success('PDF report exported!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6" ref={reportRef}>
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-primary/5 to-accent/10 border border-primary/20 p-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-primary/20">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold">Brand Intelligence</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Deep competitive analysis and demographic insights for any brand
          </p>
          
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search any brand... e.g. Vodafone, Nike, STC"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="pl-10 bg-background/80 backdrop-blur-sm border-primary/20"
              />
            </div>
            <Button onClick={handleSearch} className="gap-2 px-6">
              <Search className="h-4 w-4" />
              Analyze
            </Button>
          </div>
        </div>
      </div>

      {votesLoading && activeBrand && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {activeBrand && !votesLoading && !brandData && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Search className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No polls found featuring "{activeBrand}"</p>
          </CardContent>
        </Card>
      )}

      {brandData && (
        <>
          {/* Export Button */}
          <div className="flex justify-end">
            <Button onClick={handleExportPDF} disabled={isExporting} variant="outline" className="gap-2 border-primary/30 text-primary hover:bg-primary/10">
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export PDF Report
            </Button>
          </div>

          {/* Brand Summary */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
              <CardContent className="p-4 text-center">
                <BarChart3 className="h-5 w-5 text-primary mx-auto mb-1" />
                <p className="text-2xl font-bold">{brandData.pollCount}</p>
                <p className="text-xs text-muted-foreground">Total Polls</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-accent/10 to-transparent border-accent/20">
              <CardContent className="p-4 text-center">
                <Users className="h-5 w-5 text-accent mx-auto mb-1" />
                <p className="text-2xl font-bold">{brandData.totalVotes.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Votes</p>
              </CardContent>
            </Card>
            <Card className={`bg-gradient-to-br ${brandData.winRate >= 50 ? 'from-green-500/10 border-green-500/20' : 'from-red-500/10 border-red-500/20'}`}>
              <CardContent className="p-4 text-center">
                <Trophy className="h-5 w-5 mx-auto mb-1" style={{ color: brandData.winRate >= 50 ? '#22c55e' : '#ef4444' }} />
                <p className="text-2xl font-bold">{brandData.winRate}%</p>
                <p className="text-xs text-muted-foreground">Win Rate</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-primary/5 to-transparent">
              <CardContent className="p-4 text-center">
                <TrendingUp className="h-5 w-5 text-primary mx-auto mb-1" />
                <p className="text-2xl font-bold">{brandData.wins}W — {brandData.pollCount - brandData.wins}L</p>
                <p className="text-xs text-muted-foreground">Record</p>
              </CardContent>
            </Card>
          </div>

          {/* Top Demographics */}
          <Card className="border-primary/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Core Audience
              </CardTitle>
              <CardDescription>Who chooses {activeBrand} the most</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {brandData.topGender && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Top Gender</span>
                  </div>
                  <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary">
                    {brandData.topGender.name} — {brandData.topGender.rate}%
                  </Badge>
                </div>
              )}
              {brandData.topAge && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-accent/5">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-accent" />
                    <span className="text-sm font-medium">Top Age Group</span>
                  </div>
                  <Badge variant="outline" className="bg-accent/10 border-accent/20 text-accent">
                    {brandData.topAge.name} — {brandData.topAge.rate}%
                  </Badge>
                </div>
              )}
              {brandData.topCity && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-green-500/5">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">Top City</span>
                  </div>
                  <Badge variant="outline" className="bg-green-500/10 border-green-500/20 text-green-500">
                    {brandData.topCity.name} — {brandData.topCity.rate}%
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Competitor Comparison */}
          <Card className="border-primary/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Crown className="h-4 w-4 text-primary" />
                Competitor Comparison
              </CardTitle>
              <CardDescription>Head-to-head performance against each competitor</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {brandData.competitors.map(comp => (
                <div key={comp.name} className="p-3 rounded-xl border border-border/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{activeBrand} vs {comp.name}</span>
                    <Badge variant={comp.winRate >= 50 ? 'default' : 'secondary'} className="text-xs">
                      {comp.wins}W-{comp.losses}L
                    </Badge>
                  </div>
                  <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`absolute top-0 left-0 h-full rounded-full transition-all ${
                        comp.avgBrandPercent >= 50 
                          ? 'bg-gradient-to-r from-primary to-green-500' 
                          : 'bg-gradient-to-r from-orange-500 to-red-500'
                      }`}
                      style={{ width: `${comp.avgBrandPercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{activeBrand} {comp.avgBrandPercent}%</span>
                    <span>{comp.name} {100 - comp.avgBrandPercent}%</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Poll-by-Poll Breakdown */}
          <Card className="border-primary/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Poll-by-Poll Breakdown
              </CardTitle>
              <CardDescription>{brandData.pollCount} polls featuring {activeBrand}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {brandData.brandPolls.map((poll, idx) => (
                <div key={poll.id} className="border border-border/50 rounded-xl overflow-hidden">
                  <button
                    onClick={() => togglePollExpand(poll.id)}
                    className="w-full p-3 flex items-center justify-between text-left hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                        {poll.won ? (
                          <Badge className="text-[10px] px-1.5 py-0 bg-green-500/20 text-green-500 border-0">WIN</Badge>
                        ) : (
                          <Badge className="text-[10px] px-1.5 py-0 bg-red-500/20 text-red-500 border-0">LOSS</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">{poll.totalVotes} votes</span>
                        {poll.expiryType !== 'evergreen' && (
                          <Badge className={`text-[10px] px-1.5 py-0 border-0 ${poll.expiryType === 'trending' ? 'bg-orange-500/20 text-orange-500' : 'bg-primary/20 text-primary'}`}>
                            {poll.expiryType === 'trending' ? '⚡ 48h' : '🏆 Monthly'}
                          </Badge>
                        )}
                      </div>
                      {poll.startsAt && poll.endsAt && (
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(poll.startsAt).toLocaleDateString()} — {new Date(poll.endsAt).toLocaleDateString()}
                        </p>
                      )}
                      <p className="text-sm font-medium truncate">{poll.question}</p>
                      <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                        <span className="font-semibold text-primary">{activeBrand} {poll.brandPercent}%</span>
                        <span>vs</span>
                        <span>{poll.competitor} {poll.competitorPercent}%</span>
                      </div>
                    </div>
                    {expandedPolls.has(poll.id) ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </button>

                  {expandedPolls.has(poll.id) && (
                    <div className="px-3 pb-3 pt-1 border-t border-border/30 space-y-3">
                      {/* Result bar */}
                      <div className="relative h-4 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`absolute top-0 left-0 h-full rounded-full ${poll.won ? 'bg-gradient-to-r from-primary to-green-500' : 'bg-gradient-to-r from-orange-500 to-red-500'}`}
                          style={{ width: `${poll.brandPercent}%` }}
                        />
                      </div>

                      {/* Demographic Insight */}
                      <div className="p-2 rounded-lg bg-primary/5 border border-primary/10">
                        <p className="text-xs text-primary font-medium flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          {getDemoInsight(poll)}
                        </p>
                      </div>

                      {/* Gender split */}
                      {Object.keys(poll.demographics.gender).length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">By Gender</p>
                          <div className="grid grid-cols-2 gap-1">
                            {Object.entries(poll.demographics.gender).map(([g, v]) => (
                              <div key={g} className="text-xs flex justify-between px-2 py-1 bg-muted/30 rounded">
                                <span>{g}</span>
                                <span className="font-medium">{v.total > 0 ? Math.round((v.brand / v.total) * 100) : 0}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Age split */}
                      {Object.keys(poll.demographics.age).length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">By Age</p>
                          <div className="grid grid-cols-2 gap-1">
                            {Object.entries(poll.demographics.age).map(([a, v]) => (
                              <div key={a} className="text-xs flex justify-between px-2 py-1 bg-muted/30 rounded">
                                <span>{a}</span>
                                <span className="font-medium">{v.total > 0 ? Math.round((v.brand / v.total) * 100) : 0}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* City split */}
                      {Object.keys(poll.demographics.city).length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">By City (Top 5)</p>
                          <div className="grid grid-cols-2 gap-1">
                            {Object.entries(poll.demographics.city)
                              .sort((a, b) => b[1].total - a[1].total)
                              .slice(0, 5)
                              .map(([c, v]) => (
                                <div key={c} className="text-xs flex justify-between px-2 py-1 bg-muted/30 rounded">
                                  <span>{c}</span>
                                  <span className="font-medium">{v.total > 0 ? Math.round((v.brand / v.total) * 100) : 0}%</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Brand Battle Cycle History */}
          {pollCycles && pollCycles.length > 0 && (
            <Card className="border-primary/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Brand Battle History
                </CardTitle>
                <CardDescription>Monthly cycle data for {activeBrand} brand battle polls</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {pollCycles.map((cycle: any) => {
                  const poll = allPolls?.find(p => p.id === cycle.poll_id);
                  if (!poll) return null;
                  const isA = poll.option_a.toLowerCase().includes(activeBrand.toLowerCase());
                  const brandPercent = isA ? cycle.percent_a : cycle.percent_b;
                  const compPercent = isA ? cycle.percent_b : cycle.percent_a;
                  const competitor = isA ? poll.option_b : poll.option_a;
                  const start = new Date(cycle.cycle_start).toLocaleDateString();
                  const end = new Date(cycle.cycle_end).toLocaleDateString();

                  return (
                    <div key={cycle.id} className="p-3 rounded-xl border border-border/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{activeBrand} vs {competitor}</span>
                        <Badge variant="outline" className="text-xs">Cycle {cycle.cycle_number}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{start} — {end} · {cycle.total_votes} votes</p>
                      <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`absolute top-0 left-0 h-full rounded-full ${brandPercent >= 50 ? 'bg-gradient-to-r from-primary to-green-500' : 'bg-gradient-to-r from-orange-500 to-red-500'}`}
                          style={{ width: `${brandPercent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{activeBrand} {brandPercent}%</span>
                        <span>{competitor} {compPercent}%</span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
