import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Share2, Loader2, TrendingUp, TrendingDown, Minus, Users, Lightbulb, Target, BarChart3, Brain, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

// Concept Score Ring
function ConceptScoreRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#16a34a' : score >= 60 ? '#2563eb' : score >= 40 ? '#eab308' : '#ef4444';

  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <motion.circle
          cx="60" cy="60" r="54" fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold" style={{ color }}>{score}</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Concept Score</span>
      </div>
    </div>
  );
}

// Section Header
function SectionHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

// Impact Badge
function ImpactBadge({ impact }: { impact: string }) {
  const colors = {
    high: 'bg-red-100 text-red-700 border-red-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-green-100 text-green-700 border-green-200',
  };
  return (
    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${colors[impact as keyof typeof colors] || colors.low}`}>
      {impact}
    </span>
  );
}

export default function DecisionIntelligenceReport() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const shareToken = searchParams.get('token');

  const { data: report, isLoading, error } = useQuery({
    queryKey: ['di-report', id, shareToken],
    queryFn: async () => {
      let query = supabase
        .from('decision_intelligence_reports')
        .select('*');

      if (shareToken) {
        query = query.eq('share_token', shareToken).eq('report_status', 'complete');
      } else {
        query = query.eq('id', id!);
      }

      const { data, error } = await query.single();
      if (error) throw error;
      return data;
    },
    enabled: !!id || !!shareToken,
  });

  // Fetch poll info
  const { data: poll } = useQuery({
    queryKey: ['di-report-poll', report?.poll_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('polls')
        .select('question, option_a, option_b, category, image_a_url, image_b_url')
        .eq('id', report!.poll_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!report?.poll_id,
  });

  const handleShare = async () => {
    if (!report?.share_token) return;
    const url = `${window.location.origin}/di/report/${report.id}?token=${report.share_token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Share link copied to clipboard!');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleExportPDF = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold mb-2">Report Not Found</h2>
        <p className="text-muted-foreground text-sm mb-4">This report may have been removed or the link is invalid.</p>
        <Button onClick={() => navigate(-1)} variant="outline">Go Back</Button>
      </div>
    );
  }

  const drivers = (report.drivers_of_choice as any[]) || [];
  const segments = (report.audience_segments as any[]) || [];
  const momentum = (report.trend_momentum as any) || {};
  const recommendations = (report.brand_recommendations as any[]) || [];
  const personalitySegments = (report.personality_segments as any[]) || [];

  const MomentumIcon = momentum.direction?.includes('growing') ? TrendingUp : momentum.direction === 'stable' ? Minus : TrendingDown;

  return (
    <div className="min-h-screen bg-background print:bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b print:hidden">
        <div className="max-w-3xl mx-auto flex items-center justify-between p-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-secondary hover:bg-secondary/80">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-1" /> Share
            </Button>
            <Button size="sm" variant="outline" onClick={handleExportPDF}>
              <Download className="h-4 w-4 mr-1" /> PDF
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-4 pb-20 space-y-8">
        {/* Report Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4 pt-4"
        >
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
            <Brain className="h-3 w-3" />
            Decision Intelligence Report
          </div>
          <h1 className="text-2xl font-bold leading-tight">
            {poll?.question || `${report.winner_option} vs ${report.loser_option}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            Based on {report.total_votes.toLocaleString()} votes · Generated {new Date(report.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </motion.div>

        {/* Concept Score */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-secondary/30 rounded-2xl p-6"
        >
          <ConceptScoreRing score={report.concept_score} />
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-green-50 rounded-xl border border-green-100">
              <p className="text-2xl font-bold text-green-700">{report.winner_pct}%</p>
              <p className="text-xs text-green-600 font-medium mt-1">{report.winner_option}</p>
              <p className="text-[10px] text-green-500 uppercase mt-0.5">Winner</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-xl border border-red-100">
              <p className="text-2xl font-bold text-red-700">{report.loser_pct}%</p>
              <p className="text-xs text-red-600 font-medium mt-1">{report.loser_option}</p>
              <p className="text-[10px] text-red-500 uppercase mt-0.5">Runner-up</p>
            </div>
          </div>
        </motion.div>

        {/* Executive Summary */}
        {report.executive_summary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-primary/5 border border-primary/10 rounded-2xl p-6"
          >
            <SectionHeader icon={FileText} title="Executive Summary" />
            <p className="text-sm leading-relaxed text-foreground/80">{report.executive_summary}</p>
          </motion.div>
        )}

        {/* Drivers of Choice */}
        {drivers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <SectionHeader icon={Lightbulb} title="Drivers of Choice" subtitle="What's behind the decision" />
            <div className="space-y-3">
              {drivers.map((driver: any, i: number) => (
                <div key={i} className="p-4 bg-secondary/30 rounded-xl border">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm">{driver.driver}</h3>
                    <ImpactBadge impact={driver.impact} />
                  </div>
                  <p className="text-sm text-muted-foreground">{driver.explanation}</p>
                  {driver.supporting_data && (
                    <p className="text-xs text-primary/70 mt-2 italic">📊 {driver.supporting_data}</p>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Audience Segments */}
        {segments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <SectionHeader icon={Users} title="Audience Segments" subtitle="Who voted and why" />
            <div className="space-y-3">
              {segments.map((seg: any, i: number) => (
                <div key={i} className="p-4 bg-secondary/30 rounded-xl border">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-sm">{seg.segment_name}</h3>
                      {seg.versa_archetype && (
                        <span className="text-[10px] text-muted-foreground">Versa type: {seg.versa_archetype}</span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold">{seg.size_pct}%</span>
                      <p className="text-[10px] text-muted-foreground">of voters</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      seg.preference === 'A' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      Prefers: {seg.preference === 'A' ? report.winner_option : report.loser_option}
                    </span>
                    <span className="text-[10px] text-muted-foreground capitalize">{seg.preference_strength}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{seg.description}</p>
                  <div className="mt-2 p-2 bg-background rounded-lg">
                    <p className="text-xs"><span className="font-semibold">Brand implication:</span> {seg.brand_implication}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Trend Momentum */}
        {momentum.insight && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-secondary/30 rounded-2xl p-6"
          >
            <SectionHeader icon={TrendingUp} title="Trend Momentum" subtitle="Where the needle is moving" />
            <div className="flex items-center gap-4 mb-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                momentum.direction?.includes('growing_A') ? 'bg-green-100' :
                momentum.direction?.includes('growing_B') ? 'bg-blue-100' :
                'bg-gray-100'
              }`}>
                <MomentumIcon className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold text-sm capitalize">{momentum.direction?.replace('_', ' ')}</p>
                <p className="text-xs text-muted-foreground">Velocity: <span className="capitalize">{momentum.velocity}</span></p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{momentum.insight}</p>
          </motion.div>
        )}

        {/* Personality → Business Segments */}
        {personalitySegments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <SectionHeader icon={Brain} title="Personality-to-Business Mapping" subtitle="Versa archetypes translated for brand strategy" />
            <div className="grid grid-cols-1 gap-3">
              {personalitySegments.map((seg: any, i: number) => (
                <div key={i} className="p-4 bg-secondary/30 rounded-xl border">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-xs text-muted-foreground">{seg.versa_type}</span>
                      <span className="mx-1.5 text-muted-foreground">→</span>
                      <span className="font-semibold text-sm">{seg.business_label}</span>
                    </div>
                    <span className="text-sm font-bold">{seg.pct_of_voters}%</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{seg.key_behavior}</p>
                  <div className="p-2 bg-primary/5 rounded-lg">
                    <p className="text-xs"><span className="font-semibold text-primary">Opportunity:</span> {seg.brand_opportunity}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Brand Recommendations */}
        {recommendations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <SectionHeader icon={Target} title="Brand Recommendations" subtitle="Actionable next steps" />
            <div className="space-y-3">
              {recommendations.map((rec: any, i: number) => (
                <div key={i} className="p-4 bg-secondary/30 rounded-xl border relative overflow-hidden">
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                    rec.priority === 'high' ? 'bg-red-500' : rec.priority === 'medium' ? 'bg-amber-500' : 'bg-green-500'
                  }`} />
                  <div className="pl-3">
                    <div className="flex items-center justify-between mb-2">
                      <ImpactBadge impact={rec.priority} />
                      <span className="text-[10px] text-muted-foreground">Target: {rec.target_segment}</span>
                    </div>
                    <p className="text-sm font-medium">{rec.recommendation}</p>
                    <p className="text-xs text-muted-foreground mt-1">{rec.rationale}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Methodology */}
        {report.methodology_note && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="text-center pt-4 border-t"
          >
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Methodology</p>
            <p className="text-xs text-muted-foreground">{report.methodology_note}</p>
            <p className="text-[10px] text-muted-foreground mt-3">
              Powered by Versa Decision Intelligence · {new Date(report.created_at).toLocaleDateString()}
            </p>
          </motion.div>
        )}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          header, .print\\:hidden { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .max-w-3xl { max-width: 100%; }
        }
      `}</style>
    </div>
  );
}
