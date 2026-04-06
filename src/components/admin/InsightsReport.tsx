import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, FileText, Download, Trophy, Users, MapPin, Calendar, Sparkles } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const GENDER_COLORS: Record<string, string> = {
  'Male': 'hsl(210, 80%, 55%)',
  'Female': 'hsl(340, 75%, 55%)',
  'Prefer not to say': 'hsl(var(--muted-foreground))',
  'Unknown': 'hsl(var(--muted-foreground))',
};

const AGE_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe'];
const CITY_COLORS = ['#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4', '#ccfbf1'];

export default function InsightsReport() {
  const [selectedPollId, setSelectedPollId] = useState<string>('');
  const reportRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);

  const { data: polls, isLoading: pollsLoading } = useQuery({
    queryKey: ['insights-report-polls'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, category, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: reportData, isLoading: reportLoading } = useQuery({
    queryKey: ['insights-report-data', selectedPollId],
    queryFn: async () => {
      if (!selectedPollId) return null;

      const poll = polls?.find(p => p.id === selectedPollId);
      if (!poll) return null;

      const { data: votes, error } = await supabase
        .from('votes')
        .select('choice, voter_gender, voter_age_range, voter_city, voter_country')
        .eq('poll_id', selectedPollId);

      if (error) throw error;
      if (!votes || votes.length === 0) return { poll, votes: [], totalVotes: 0 };

      const totalVotes = votes.length;
      const votesA = votes.filter(v => v.choice === 'A').length;
      const votesB = votes.filter(v => v.choice === 'B').length;
      const percentA = Math.round((votesA / totalVotes) * 100);
      const percentB = 100 - percentA;
      const winner = votesA >= votesB ? poll.option_a : poll.option_b;
      const winnerChoice = votesA >= votesB ? 'A' : 'B';

      // Gender breakdown
      const genderMap = new Map<string, { a: number; b: number; total: number }>();
      votes.forEach(v => {
        const g = v.voter_gender || 'Unknown';
        if (!genderMap.has(g)) genderMap.set(g, { a: 0, b: 0, total: 0 });
        const entry = genderMap.get(g)!;
        entry.total++;
        if (v.choice === 'A') entry.a++; else entry.b++;
      });
      const genderBreakdown = Array.from(genderMap.entries())
        .map(([name, { a, b, total }]) => ({
          name,
          total,
          percentA: total > 0 ? Math.round((a / total) * 100) : 0,
          percentB: total > 0 ? Math.round((b / total) * 100) : 0,
        }))
        .sort((a, b) => b.total - a.total);

      // Age breakdown
      const ageMap = new Map<string, { a: number; b: number; total: number }>();
      votes.forEach(v => {
        const age = v.voter_age_range || 'Unknown';
        if (!ageMap.has(age)) ageMap.set(age, { a: 0, b: 0, total: 0 });
        const entry = ageMap.get(age)!;
        entry.total++;
        if (v.choice === 'A') entry.a++; else entry.b++;
      });
      const ageBreakdown = Array.from(ageMap.entries())
        .map(([name, { a, b, total }]) => ({
          name,
          total,
          percentA: total > 0 ? Math.round((a / total) * 100) : 0,
          percentB: total > 0 ? Math.round((b / total) * 100) : 0,
        }))
        .sort((a, b) => b.total - a.total);

      // City breakdown
      const cityMap = new Map<string, { a: number; b: number; total: number }>();
      votes.forEach(v => {
        const city = v.voter_city || 'Unknown';
        if (!cityMap.has(city)) cityMap.set(city, { a: 0, b: 0, total: 0 });
        const entry = cityMap.get(city)!;
        entry.total++;
        if (v.choice === 'A') entry.a++; else entry.b++;
      });
      const cityBreakdown = Array.from(cityMap.entries())
        .map(([name, { a, b, total }]) => ({
          name,
          total,
          percentA: total > 0 ? Math.round((a / total) * 100) : 0,
          percentB: total > 0 ? Math.round((b / total) * 100) : 0,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      return {
        poll,
        totalVotes,
        votesA,
        votesB,
        percentA,
        percentB,
        winner,
        winnerChoice,
        genderBreakdown,
        ageBreakdown,
        cityBreakdown,
      };
    },
    enabled: !!selectedPollId && !!polls,
  });

  const generateInsight = async () => {
    if (!reportData || !reportData.totalVotes) return;
    setIsGeneratingInsight(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-creator', {
        body: {
          polls: [{
            question: reportData.poll.question,
            option_a: reportData.poll.option_a,
            option_b: reportData.poll.option_b,
            category: reportData.poll.category,
            totalVotes: reportData.totalVotes,
            percentA: reportData.percentA,
            percentB: reportData.percentB,
            genderBreakdown: reportData.genderBreakdown,
            ageBreakdown: reportData.ageBreakdown,
            cityBreakdown: reportData.cityBreakdown,
          }],
        },
      });
      if (error) throw error;
      setAiInsight(data?.insights || 'Unable to generate insight.');
    } catch (err) {
      console.error('Insight generation error:', err);
      // Fallback: generate a local insight
      const topGender = reportData.genderBreakdown[0];
      const topAge = reportData.ageBreakdown[0];
      const topCity = reportData.cityBreakdown[0];
      const winner = reportData.winner;
      
      let insight = '';
      if (topGender && topAge && topCity) {
        const genderPref = topGender.percentA > topGender.percentB 
          ? reportData.poll.option_a : reportData.poll.option_b;
        insight = `${topGender.name} voters (${topGender.total} votes) prefer ${genderPref} at ${Math.max(topGender.percentA, topGender.percentB)}%. `;
        insight += `The ${topAge.name} age group is the most active with ${topAge.total} votes. `;
        insight += `${topCity.name} leads in participation with ${topCity.total} votes.`;
      } else {
        insight = `${winner} wins with ${Math.max(reportData.percentA, reportData.percentB)}% of total votes.`;
      }
      setAiInsight(insight);
    } finally {
      setIsGeneratingInsight(false);
    }
  };

  const exportPdf = async () => {
    if (!reportRef.current || !reportData) return;
    setIsGeneratingPdf(true);
    
    try {
      // Dynamic import for html2canvas
      const html2canvasModule = await import('html2canvas');
      const html2canvas = html2canvasModule.default;
      const { jsPDF } = await import('jspdf');
      
      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, Math.min(pdfHeight, pdf.internal.pageSize.getHeight()));
      
      const fileName = `Versa_Insights_${reportData.poll.option_a}_vs_${reportData.poll.option_b}.pdf`
        .replace(/[^a-zA-Z0-9_\-.]/g, '_');
      pdf.save(fileName);
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // When poll changes, reset insight
  const handlePollChange = (pollId: string) => {
    setSelectedPollId(pollId);
    setAiInsight('');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Insights Report
          </CardTitle>
          <p className="text-xs text-muted-foreground">Select a poll to generate a shareable insights summary</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={selectedPollId} onValueChange={handlePollChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select a poll..." />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {polls?.map(poll => (
                <SelectItem key={poll.id} value={poll.id}>
                  <span className="truncate">{poll.option_a} vs {poll.option_b}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {selectedPollId && reportData && reportData.totalVotes > 0 && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={generateInsight}
                disabled={isGeneratingInsight}
                className="flex-1"
              >
                {isGeneratingInsight ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                Generate Insight
              </Button>
              <Button
                size="sm"
                onClick={exportPdf}
                disabled={isGeneratingPdf}
                className="flex-1"
              >
                {isGeneratingPdf ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Download className="h-3 w-3 mr-1" />}
                Export PDF
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {reportLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {reportData && reportData.totalVotes === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No votes yet for this poll.
          </CardContent>
        </Card>
      )}

      {reportData && reportData.totalVotes > 0 && (
        <div
          ref={reportRef}
          className="space-y-4 bg-background p-4 rounded-xl"
          style={{ minWidth: '320px' }}
        >
          {/* Header */}
          <div className="text-center space-y-2 pb-3 border-b border-border">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Versa Insights Report</p>
            <h2 className="text-lg font-bold leading-tight">{reportData.poll.question}</h2>
            {reportData.poll.category && (
              <Badge variant="secondary" className="text-[10px]">{reportData.poll.category}</Badge>
            )}
          </div>

          {/* Winner & Stats */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-xl bg-secondary/50">
              <p className="text-2xl font-bold text-primary">{reportData.totalVotes.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">Total Votes</p>
            </div>
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
              <div className="flex items-center justify-center gap-1">
                <Trophy className="h-3.5 w-3.5 text-primary" />
                <p className="text-sm font-bold text-primary truncate">{reportData.winner}</p>
              </div>
              <p className="text-[10px] text-muted-foreground">Winner</p>
            </div>
            <div className="p-3 rounded-xl bg-secondary/50">
              <p className="text-2xl font-bold text-primary">
                {Math.max(reportData.percentA, reportData.percentB)}%
              </p>
              <p className="text-[10px] text-muted-foreground">Win Rate</p>
            </div>
          </div>

          {/* Percentage Split Bar */}
          <Card>
            <CardContent className="pt-4 pb-3 space-y-2">
              <div className="flex justify-between text-xs font-medium">
                <span>{reportData.poll.option_a}</span>
                <span>{reportData.poll.option_b}</span>
              </div>
              <div className="flex h-8 rounded-full overflow-hidden">
                <div
                  className="flex items-center justify-center text-xs font-bold text-white transition-all"
                  style={{ width: `${reportData.percentA}%`, backgroundColor: '#6366f1' }}
                >
                  {reportData.percentA}%
                </div>
                <div
                  className="flex items-center justify-center text-xs font-bold text-white transition-all"
                  style={{ width: `${reportData.percentB}%`, backgroundColor: '#ec4899' }}
                >
                  {reportData.percentB}%
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Gender Breakdown */}
          <Card>
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-primary" />
                By Gender
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="space-y-2">
                {reportData.genderBreakdown.map(g => {
                  const genderColor = GENDER_COLORS[g.name] || 'hsl(var(--muted-foreground))';
                  return (
                    <div key={g.name} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: genderColor }} />
                          {g.name}
                        </span>
                        <span className="text-muted-foreground">{g.total} votes</span>
                      </div>
                      <div className="flex h-5 rounded-full overflow-hidden bg-muted">
                        <div
                          className="flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ width: `${g.percentA}%`, backgroundColor: genderColor }}
                        >
                          {g.percentA > 15 ? `${g.percentA}%` : ''}
                        </div>
                        <div
                          className="flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ width: `${g.percentB}%`, backgroundColor: genderColor, opacity: 0.5 }}
                        >
                          {g.percentB > 15 ? `${g.percentB}%` : ''}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Age Breakdown */}
          <Card>
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                By Age Range
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="space-y-2">
                {reportData.ageBreakdown.map(a => (
                  <div key={a.name} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{a.name}</span>
                      <span className="text-muted-foreground">{a.total} votes</span>
                    </div>
                    <div className="flex h-5 rounded-full overflow-hidden bg-muted">
                      <div
                        className="flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ width: `${a.percentA}%`, backgroundColor: '#6366f1' }}
                      >
                        {a.percentA > 15 ? `${a.percentA}%` : ''}
                      </div>
                      <div
                        className="flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ width: `${a.percentB}%`, backgroundColor: '#ec4899' }}
                      >
                        {a.percentB > 15 ? `${a.percentB}%` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* City Breakdown */}
          <Card>
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                By City (Top 10)
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="space-y-2">
                {reportData.cityBreakdown.map(c => (
                  <div key={c.name} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted-foreground">{c.total} votes</span>
                    </div>
                    <div className="flex h-5 rounded-full overflow-hidden bg-muted">
                      <div
                        className="flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ width: `${c.percentA}%`, backgroundColor: '#6366f1' }}
                      >
                        {c.percentA > 15 ? `${c.percentA}%` : ''}
                      </div>
                      <div
                        className="flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ width: `${c.percentB}%`, backgroundColor: '#ec4899' }}
                      >
                        {c.percentB > 15 ? `${c.percentB}%` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* AI Insight */}
          {aiInsight && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Key Insight
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <p className="text-sm leading-relaxed">{aiInsight}</p>
              </CardContent>
            </Card>
          )}

          {/* Footer */}
          <div className="text-center pt-2 border-t border-border">
            <p className="text-[9px] text-muted-foreground">
              Generated by Versa • {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
