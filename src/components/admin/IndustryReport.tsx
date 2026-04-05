import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2, Download, Trophy, Users, BarChart3,
  TrendingUp, Crown, MapPin, Sparkles, ChevronDown,
  ChevronUp, Building2, Target
} from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

interface BrandPerformance {
  name: string;
  totalVotes: number;
  wins: number;
  losses: number;
  polls: number;
  winRate: number;
  avgPercent: number;
  topGender: { name: string; rate: number } | null;
  topAge: { name: string; rate: number } | null;
  topCity: { name: string; rate: number } | null;
  competitors: { name: string; wins: number; losses: number }[];
}

export default function IndustryReport() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [expandedBrand, setExpandedBrand] = useState<string | null>(null);

  const { data: categories, isLoading: catsLoading } = useQuery({
    queryKey: ['industry-report-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('polls')
        .select('category')
        .eq('is_active', true)
        .not('category', 'is', null);
      if (error) throw error;
      const counts = new Map<string, number>();
      data.forEach(p => {
        if (p.category) counts.set(p.category, (counts.get(p.category) || 0) + 1);
      });
      return Array.from(counts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
    },
  });

  const { data: polls } = useQuery({
    queryKey: ['industry-report-polls', selectedCategory],
    queryFn: async () => {
      if (!selectedCategory) return [];
      const { data, error } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b')
        .eq('category', selectedCategory)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCategory,
  });

  const { data: votes, isLoading: votesLoading } = useQuery({
    queryKey: ['industry-report-votes', selectedCategory, polls?.length],
    queryFn: async () => {
      if (!polls?.length) return [];
      const pollIds = polls.map(p => p.id);
      const chunks: string[][] = [];
      for (let i = 0; i < pollIds.length; i += 50) chunks.push(pollIds.slice(i, i + 50));
      const all: any[] = [];
      for (const chunk of chunks) {
        const { data, error } = await supabase
          .from('votes')
          .select('poll_id, choice, voter_gender, voter_age_range, voter_city')
          .in('poll_id', chunk);
        if (error) throw error;
        if (data) all.push(...data);
      }
      return all;
    },
    enabled: !!polls?.length,
  });

  const industryData = useMemo(() => {
    if (!polls?.length || !votes) return null;

    // Collect all unique brand names (options)
    const brandMap = new Map<string, {
      votes: number;
      wins: number;
      losses: number;
      polls: number;
      totalPercent: number;
      genderAgg: Record<string, { brand: number; total: number }>;
      ageAgg: Record<string, { brand: number; total: number }>;
      cityAgg: Record<string, { brand: number; total: number }>;
      competitors: Map<string, { wins: number; losses: number }>;
    }>();

    const ensureBrand = (name: string) => {
      if (!brandMap.has(name)) {
        brandMap.set(name, {
          votes: 0, wins: 0, losses: 0, polls: 0, totalPercent: 0,
          genderAgg: {}, ageAgg: {}, cityAgg: {},
          competitors: new Map(),
        });
      }
      return brandMap.get(name)!;
    };

    polls.forEach(poll => {
      const pollVotes = votes.filter(v => v.poll_id === poll.id);
      const total = pollVotes.length;
      if (total === 0) return;

      const votesA = pollVotes.filter(v => v.choice === 'A').length;
      const votesB = total - votesA;
      const percA = Math.round((votesA / total) * 100);
      const percB = 100 - percA;
      const winnerSide = votesA > votesB ? 'A' : votesB > votesA ? 'B' : null;

      // Process both options
      [{ name: poll.option_a, side: 'A' as const, opp: poll.option_b, myVotes: votesA, myPerc: percA },
       { name: poll.option_b, side: 'B' as const, opp: poll.option_a, myVotes: votesB, myPerc: percB }]
        .forEach(({ name, side, opp, myVotes, myPerc }) => {
          const b = ensureBrand(name);
          b.polls++;
          b.votes += myVotes;
          b.totalPercent += myPerc;
          if (winnerSide === side) b.wins++;
          else if (winnerSide) b.losses++;

          // Competitor tracking
          if (!b.competitors.has(opp)) b.competitors.set(opp, { wins: 0, losses: 0 });
          const comp = b.competitors.get(opp)!;
          if (winnerSide === side) comp.wins++;
          else if (winnerSide) comp.losses++;

          // Demographics
          pollVotes.forEach(v => {
            const isBrand = v.choice === side;
            if (v.voter_gender) {
              if (!b.genderAgg[v.voter_gender]) b.genderAgg[v.voter_gender] = { brand: 0, total: 0 };
              b.genderAgg[v.voter_gender].total++;
              if (isBrand) b.genderAgg[v.voter_gender].brand++;
            }
            if (v.voter_age_range) {
              if (!b.ageAgg[v.voter_age_range]) b.ageAgg[v.voter_age_range] = { brand: 0, total: 0 };
              b.ageAgg[v.voter_age_range].total++;
              if (isBrand) b.ageAgg[v.voter_age_range].brand++;
            }
            if (v.voter_city) {
              if (!b.cityAgg[v.voter_city]) b.cityAgg[v.voter_city] = { brand: 0, total: 0 };
              b.cityAgg[v.voter_city].total++;
              if (isBrand) b.cityAgg[v.voter_city].brand++;
            }
          });
        });
    });

    const getTop = (agg: Record<string, { brand: number; total: number }>) => {
      const entries = Object.entries(agg)
        .map(([k, v]) => ({ name: k, rate: v.total > 2 ? Math.round((v.brand / v.total) * 100) : 0, total: v.total }))
        .filter(e => e.total > 2)
        .sort((a, b) => b.rate - a.rate);
      return entries[0] ? { name: entries[0].name, rate: entries[0].rate } : null;
    };

    const brands: BrandPerformance[] = Array.from(brandMap.entries())
      .map(([name, d]) => ({
        name,
        totalVotes: d.votes,
        wins: d.wins,
        losses: d.losses,
        polls: d.polls,
        winRate: d.polls > 0 ? Math.round((d.wins / d.polls) * 100) : 0,
        avgPercent: d.polls > 0 ? Math.round(d.totalPercent / d.polls) : 0,
        topGender: getTop(d.genderAgg),
        topAge: getTop(d.ageAgg),
        topCity: getTop(d.cityAgg),
        competitors: Array.from(d.competitors.entries())
          .map(([cn, cd]) => ({ name: cn, wins: cd.wins, losses: cd.losses }))
          .sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses)),
      }))
      .sort((a, b) => b.totalVotes - a.totalVotes);

    const totalVotes = votes.length;
    const totalPolls = polls.length;

    return { brands, totalVotes, totalPolls };
  }, [polls, votes]);

  const handleExportPDF = async () => {
    if (!industryData || !selectedCategory) return;
    setIsExporting(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pw = 210, ph = 297, m = 15, cw = pw - m * 2;
      let y = m;
      const now = new Date();
      const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

      // Header
      pdf.setFillColor(15, 15, 25);
      pdf.rect(0, 0, pw, 50, 'F');
      pdf.setFillColor(139, 92, 246);
      pdf.rect(0, 48, pw, 2, 'F');

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Versa Industry Report', m, 22);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'normal');
      pdf.text(selectedCategory, m, 32);
      pdf.setFontSize(10);
      pdf.text(`${months[now.getMonth()]} ${now.getFullYear()}`, m, 42);
      pdf.text('Confidential', pw - m - pdf.getTextWidth('Confidential'), 42);

      y = 58;
      pdf.setTextColor(50, 50, 50);

      // Summary
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(139, 92, 246);
      pdf.text('Industry Overview', m, y);
      y += 8;
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(60, 60, 60);
      pdf.text(`Total Polls: ${industryData.totalPolls}`, m, y); y += 6;
      pdf.text(`Total Votes: ${industryData.totalVotes.toLocaleString()}`, m, y); y += 6;
      pdf.text(`Brands Tracked: ${industryData.brands.length}`, m, y); y += 10;

      // Brand Rankings Table
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(139, 92, 246);
      pdf.text('Brand Rankings', m, y);
      y += 8;

      pdf.setFontSize(8);
      pdf.setFillColor(245, 243, 255);
      pdf.rect(m, y - 4, cw, 7, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(80, 80, 80);
      pdf.text('#', m + 2, y);
      pdf.text('Brand', m + 10, y);
      pdf.text('Votes', m + 65, y);
      pdf.text('W-L', m + 85, y);
      pdf.text('Win%', m + 100, y);
      pdf.text('Avg%', m + 115, y);
      pdf.text('Top Demo', m + 130, y);
      y += 7;

      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(60, 60, 60);
      industryData.brands.forEach((brand, idx) => {
        if (y > ph - 30) { pdf.addPage(); y = m; }
        pdf.text(`${idx + 1}`, m + 2, y);
        pdf.text(brand.name.substring(0, 20), m + 10, y);
        pdf.text(`${brand.totalVotes}`, m + 65, y);
        pdf.text(`${brand.wins}-${brand.losses}`, m + 85, y);
        pdf.text(`${brand.winRate}%`, m + 100, y);
        pdf.text(`${brand.avgPercent}%`, m + 115, y);
        const demo = brand.topGender ? `${brand.topGender.name} ${brand.topGender.rate}%` : '-';
        pdf.text(demo.substring(0, 18), m + 130, y);
        y += 6;
      });

      y += 8;

      // Per-brand details
      industryData.brands.slice(0, 15).forEach(brand => {
        if (y > ph - 50) { pdf.addPage(); y = m; }
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(139, 92, 246);
        pdf.text(brand.name, m, y);
        y += 6;

        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(60, 60, 60);
        pdf.text(`${brand.totalVotes} votes | ${brand.winRate}% win rate | ${brand.wins}W-${brand.losses}L`, m + 2, y);
        y += 5;
        if (brand.topGender) { pdf.text(`Top Gender: ${brand.topGender.name} (${brand.topGender.rate}%)`, m + 2, y); y += 4; }
        if (brand.topAge) { pdf.text(`Top Age: ${brand.topAge.name} (${brand.topAge.rate}%)`, m + 2, y); y += 4; }
        if (brand.topCity) { pdf.text(`Top City: ${brand.topCity.name} (${brand.topCity.rate}%)`, m + 2, y); y += 4; }

        // Competitor results
        if (brand.competitors.length > 0) {
          y += 2;
          pdf.setFontSize(8);
          brand.competitors.slice(0, 5).forEach(comp => {
            if (y > ph - 20) { pdf.addPage(); y = m; }
            pdf.text(`vs ${comp.name}: ${comp.wins}W-${comp.losses}L`, m + 4, y);
            y += 4;
          });
        }
        y += 6;
      });

      // Footer
      const tp = pdf.getNumberOfPages();
      for (let i = 1; i <= tp; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`Versa Industry Report — ${selectedCategory} — Confidential`, m, ph - 8);
        pdf.text(`Page ${i} of ${tp}`, pw - m - 20, ph - 8);
      }

      pdf.save(`Versa-Industry-Report-${selectedCategory.replace(/\s+/g, '-')}-${months[now.getMonth()]}-${now.getFullYear()}.pdf`);
      toast.success('Industry report exported!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent/20 via-accent/5 to-primary/10 border border-accent/20 p-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-accent/20">
              <Building2 className="h-5 w-5 text-accent" />
            </div>
            <h2 className="text-xl font-bold">Industry Report</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Aggregated brand performance within an industry category
          </p>

          <div className="flex gap-2">
            <div className="flex-1">
              <Select value={selectedCategory || ''} onValueChange={setSelectedCategory}>
                <SelectTrigger className="bg-background/80 backdrop-blur-sm border-accent/20">
                  <SelectValue placeholder="Select an industry..." />
                </SelectTrigger>
                <SelectContent>
                  {catsLoading ? (
                    <div className="p-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
                  ) : categories?.map(cat => (
                    <SelectItem key={cat.name} value={cat.name}>
                      {cat.name} ({cat.count} polls)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {industryData && (
              <Button onClick={handleExportPDF} disabled={isExporting} className="gap-2">
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                PDF
              </Button>
            )}
          </div>
        </div>
      </div>

      {votesLoading && selectedCategory && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {industryData && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{industryData.totalPolls}</p>
                <p className="text-xs text-muted-foreground">Polls</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-accent/10 to-transparent border-accent/20">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{industryData.totalVotes.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Votes</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-primary/5 to-transparent">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{industryData.brands.length}</p>
                <p className="text-xs text-muted-foreground">Brands</p>
              </CardContent>
            </Card>
          </div>

          {/* Brand Leaderboard */}
          <Card className="border-primary/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Crown className="h-4 w-4 text-primary" />
                Brand Leaderboard — {selectedCategory}
              </CardTitle>
              <CardDescription>All brands ranked by total votes received</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {industryData.brands.map((brand, idx) => (
                <div key={brand.name} className="border border-border/50 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedBrand(expandedBrand === brand.name ? null : brand.name)}
                    className="w-full p-3 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors"
                  >
                    <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 ${
                      idx === 0 ? 'bg-yellow-500/20 text-yellow-600' :
                      idx === 1 ? 'bg-muted text-muted-foreground' :
                      idx === 2 ? 'bg-orange-500/20 text-orange-600' :
                      'bg-muted/50 text-muted-foreground'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{brand.name}</p>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span>{brand.totalVotes.toLocaleString()} votes</span>
                        <span>•</span>
                        <span className={brand.winRate >= 50 ? 'text-green-500' : 'text-red-500'}>{brand.winRate}% win</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {brand.wins}W-{brand.losses}L
                    </Badge>
                    {expandedBrand === brand.name ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                  </button>

                  {expandedBrand === brand.name && (
                    <div className="px-3 pb-3 pt-1 border-t border-border/30 space-y-3">
                      {/* Avg performance bar */}
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Avg Vote Share</span>
                          <span className="font-medium">{brand.avgPercent}%</span>
                        </div>
                        <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`absolute top-0 left-0 h-full rounded-full ${brand.avgPercent >= 50 ? 'bg-gradient-to-r from-primary to-green-500' : 'bg-gradient-to-r from-orange-500 to-red-500'}`}
                            style={{ width: `${brand.avgPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Demographics */}
                      <div className="grid grid-cols-3 gap-2">
                        {brand.topGender && (
                          <div className="p-2 rounded-lg bg-primary/5 text-center">
                            <Users className="h-3 w-3 text-primary mx-auto mb-1" />
                            <p className="text-[10px] text-muted-foreground">Top Gender</p>
                            <p className="text-xs font-medium">{brand.topGender.name}</p>
                            <p className="text-[10px] text-primary">{brand.topGender.rate}%</p>
                          </div>
                        )}
                        {brand.topAge && (
                          <div className="p-2 rounded-lg bg-accent/5 text-center">
                            <BarChart3 className="h-3 w-3 text-accent mx-auto mb-1" />
                            <p className="text-[10px] text-muted-foreground">Top Age</p>
                            <p className="text-xs font-medium">{brand.topAge.name}</p>
                            <p className="text-[10px] text-accent">{brand.topAge.rate}%</p>
                          </div>
                        )}
                        {brand.topCity && (
                          <div className="p-2 rounded-lg bg-green-500/5 text-center">
                            <MapPin className="h-3 w-3 text-green-500 mx-auto mb-1" />
                            <p className="text-[10px] text-muted-foreground">Top City</p>
                            <p className="text-xs font-medium">{brand.topCity.name}</p>
                            <p className="text-[10px] text-green-500">{brand.topCity.rate}%</p>
                          </div>
                        )}
                      </div>

                      {/* Competitor results */}
                      {brand.competitors.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Head-to-Head</p>
                          <div className="space-y-1">
                            {brand.competitors.slice(0, 5).map(comp => (
                              <div key={comp.name} className="flex items-center justify-between text-xs px-2 py-1 bg-muted/30 rounded">
                                <span>vs {comp.name}</span>
                                <Badge variant={comp.wins > comp.losses ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                                  {comp.wins}W-{comp.losses}L
                                </Badge>
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
        </>
      )}
    </div>
  );
}
