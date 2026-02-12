import { Button } from '@/components/ui/button';
import { X, Download, Circle } from 'lucide-react';

interface Poll {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  image_a_url?: string | null;
  image_b_url?: string | null;
  category?: string | null;
  is_sponsored?: boolean;
  sponsor_name?: string;
}

interface VoteResult {
  pollId: string;
  choice: 'A' | 'B';
  percentA: number;
  percentB: number;
  totalVotes: number;
}

interface DemographicData {
  label: string;
  optionA: number;
  optionB: number;
  total: number;
}

interface InsightViewProps {
  poll: Poll;
  result: VoteResult;
  onClose: () => void;
  demographics?: {
    byAge?: DemographicData[];
    byGender?: DemographicData[];
    byCountry?: DemographicData[];
  };
}

// Generate poll ID from actual ID
const generatePollCode = (id: string): string => {
  const prefix = id.slice(0, 2).toUpperCase();
  const suffix = id.slice(-3).toUpperCase();
  return `#${prefix}-${suffix}`;
};

// Calculate signal strength (1-5 based on vote count and margin)
const calculateSignalStrength = (totalVotes: number, percentA: number, percentB: number): number => {
  const margin = Math.abs(percentA - percentB);
  const voteScore = Math.min(totalVotes / 500, 1) * 2.5;
  const marginScore = (margin / 100) * 2.5;
  return Math.min(Math.round(voteScore + marginScore), 5);
};

// Get signal quality metrics
const getSignalMetrics = (totalVotes: number, percentA: number, percentB: number) => {
  const margin = Math.abs(percentA - percentB);
  
  return {
    consistency: totalVotes > 200 ? 'High' : totalVotes > 50 ? 'Medium' : 'Low',
    velocity: totalVotes > 100 ? 'Fast' : totalVotes > 30 ? 'Medium' : 'Slow',
    polarization: margin > 40 ? 'High' : margin > 15 ? 'Medium' : 'Low',
    diversity: totalVotes > 150 ? 'Broad' : totalVotes > 50 ? 'Balanced' : 'Narrow',
  };
};

// Generate key insight text
const generateInsightText = (
  poll: Poll, 
  percentA: number, 
  percentB: number, 
  totalVotes: number,
  category?: string | null
): { primary: string; secondary: string } => {
  const winner = percentA > percentB ? poll.option_a : poll.option_b;
  const loser = percentA > percentB ? poll.option_b : poll.option_a;
  const margin = Math.abs(percentA - percentB);
  const winnerPercent = Math.max(percentA, percentB);
  
  const categoryText = category ? ` in ${category}` : '';
  
  let primary: string;
  if (margin >= 30) {
    primary = `${winner} dominates ${loser} with a ${margin}-point lead${categoryText}.`;
  } else if (margin >= 15) {
    primary = `${winner} leads ${loser} by ${margin} points${categoryText}.`;
  } else if (margin >= 5) {
    primary = `${winner} edges ahead of ${loser} with ${winnerPercent}% preference${categoryText}.`;
  } else {
    primary = `Split decision: ${poll.option_a} and ${poll.option_b} are statistically tied${categoryText}.`;
  }
  
  const secondary = `Preference stabilized after ${totalVotes.toLocaleString()} votes.`;
  
  return { primary, secondary };
};

// Signal strength indicator component
const SignalStrengthIndicator = ({ strength }: { strength: number }) => (
  <div className="flex items-center gap-1">
    <span className="text-xs text-muted-foreground mr-1">Signal</span>
    {[1, 2, 3, 4, 5].map((dot) => (
      <Circle
        key={dot}
        className={`h-2 w-2 ${
          dot <= strength 
            ? 'fill-emerald-500 text-emerald-500' 
            : 'fill-muted text-muted'
        }`}
      />
    ))}
  </div>
);

// Signal quality metric label
const MetricLabel = ({ label, value }: { label: string; value: string }) => {
  const getValueColor = (val: string) => {
    if (['High', 'Fast', 'Broad'].includes(val)) return 'text-emerald-400';
    if (['Medium', 'Balanced'].includes(val)) return 'text-amber-400';
    return 'text-muted-foreground';
  };
  
  return (
    <div className="flex flex-col items-center p-3 bg-muted/30 rounded-lg">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</span>
      <span className={`text-sm font-semibold ${getValueColor(value)}`}>{value}</span>
    </div>
  );
};

// Demographic bar component
const DemographicBar = ({ data, optionA, optionB }: { 
  data: DemographicData; 
  optionA: string; 
  optionB: string;
}) => {
  const percentA = data.total > 0 ? Math.round((data.optionA / data.total) * 100) : 0;
  const percentB = 100 - percentA;
  const winner = percentA > percentB ? optionA : optionB;
  const winnerPercent = Math.max(percentA, percentB);
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-foreground">{data.label}</span>
        <span className="text-sm text-muted-foreground">
          {winner} <span className="font-semibold text-foreground">{winnerPercent}%</span>
        </span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-muted/50">
        <div 
          className="bg-option-a transition-all"
          style={{ width: `${percentA}%` }}
        />
        <div 
          className="bg-option-b transition-all"
          style={{ width: `${percentB}%` }}
        />
      </div>
    </div>
  );
};

export default function InsightView({ poll, result, onClose, demographics }: InsightViewProps) {
  const signalStrength = calculateSignalStrength(result.totalVotes, result.percentA, result.percentB);
  const signalMetrics = getSignalMetrics(result.totalVotes, result.percentA, result.percentB);
  const insight = generateInsightText(poll, result.percentA, result.percentB, result.totalVotes, poll.category);
  
  const winnerIsA = result.percentA > result.percentB;
  
  // Filter demographics to show only high-signal segments (>10 votes)
  const minVotesThreshold = 10;
  const filteredDemographics: DemographicData[] = [];
  
  if (demographics?.byGender) {
    demographics.byGender
      .filter(d => d.total >= minVotesThreshold)
      .slice(0, 1)
      .forEach(d => filteredDemographics.push(d));
  }
  if (demographics?.byAge) {
    demographics.byAge
      .filter(d => d.total >= minVotesThreshold)
      .sort((a, b) => b.total - a.total)
      .slice(0, 1)
      .forEach(d => filteredDemographics.push(d));
  }
  if (demographics?.byCountry) {
    demographics.byCountry
      .filter(d => d.total >= minVotesThreshold)
      .slice(0, 1)
      .forEach(d => filteredDemographics.push(d));
  }

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      <div className="min-h-full flex flex-col max-w-2xl mx-auto">
        {/* Header Section */}
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Left side */}
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-widest text-primary font-semibold">VERSA INSIGHT</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">{generatePollCode(poll.id)}</span>
                  {poll.category && (
                    <>
                      <span className="text-muted">•</span>
                      <span>{poll.category}</span>
                    </>
                  )}
                  <span className="text-muted">•</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-400">
                    ENDED
                  </span>
                </div>
              </div>
            </div>
            
            {/* Right side */}
            <div className="flex items-center gap-4">
              <SignalStrengthIndicator strength={signalStrength} />
              <div className="text-right">
                <div className="text-lg font-bold text-foreground">{result.totalVotes.toLocaleString()}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Votes</div>
              </div>
              <button 
                onClick={onClose} 
                className="p-2 hover:bg-muted rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 space-y-6">
          {/* Poll Title */}
          <h1 className="text-xl md:text-2xl font-display font-bold text-foreground text-center leading-tight">
            {poll.question}
          </h1>

          {/* Hero Result Cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* Option A */}
            <div className={`relative rounded-xl overflow-hidden ${winnerIsA ? 'ring-2 ring-option-a shadow-lg shadow-option-a/20' : ''}`}>
              <div className="aspect-[4/5] bg-muted">
                {poll.image_a_url ? (
                  <img 
                    src={poll.image_a_url} 
                    alt={poll.option_a} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-option-a/30 to-option-a/10 flex items-center justify-center">
                    <span className="text-4xl font-bold text-option-a/50">A</span>
                  </div>
                )}
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 pt-12">
                <p className="text-sm font-medium text-white/90 mb-1">{poll.option_a}</p>
                <p className={`text-3xl font-bold ${winnerIsA ? 'text-option-a' : 'text-white'}`}>
                  {result.percentA}%
                </p>
              </div>
              {winnerIsA && (
                <div className="absolute top-3 right-3 px-2 py-1 bg-option-a/90 rounded text-[10px] font-semibold uppercase tracking-wider text-option-a-foreground">
                  Winner
                </div>
              )}
            </div>

            {/* Option B */}
            <div className={`relative rounded-xl overflow-hidden ${!winnerIsA ? 'ring-2 ring-option-b shadow-lg shadow-option-b/20' : ''}`}>
              <div className="aspect-[4/5] bg-muted">
                {poll.image_b_url ? (
                  <img 
                    src={poll.image_b_url} 
                    alt={poll.option_b} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-option-b/30 to-option-b/10 flex items-center justify-center">
                    <span className="text-4xl font-bold text-option-b/50">B</span>
                  </div>
                )}
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 pt-12">
                <p className="text-sm font-medium text-white/90 mb-1">{poll.option_b}</p>
                <p className={`text-3xl font-bold ${!winnerIsA ? 'text-option-b' : 'text-white'}`}>
                  {result.percentB}%
                </p>
              </div>
              {!winnerIsA && (
                <div className="absolute top-3 right-3 px-2 py-1 bg-option-b/90 rounded text-[10px] font-semibold uppercase tracking-wider text-option-b-foreground">
                  Winner
                </div>
              )}
            </div>
          </div>

          {/* Comparison Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span className="text-option-a">{result.percentA}%</span>
              <span className="text-option-b">{result.percentB}%</span>
            </div>
            <div className="flex h-3 rounded-full overflow-hidden bg-muted/50">
              <div 
                className={`bg-option-a transition-all ${winnerIsA ? 'shadow-lg shadow-option-a/30' : ''}`}
                style={{ width: `${result.percentA}%` }}
              />
              <div 
                className={`bg-option-b transition-all ${!winnerIsA ? 'shadow-lg shadow-option-b/30' : ''}`}
                style={{ width: `${result.percentB}%` }}
              />
            </div>
          </div>

          {/* Key Insight */}
          <section className="bg-muted/30 rounded-xl p-4 border border-border">
            <h2 className="text-[10px] uppercase tracking-widest text-primary font-semibold mb-2">Key Insight</h2>
            <p className="text-foreground font-medium leading-relaxed">{insight.primary}</p>
            <p className="text-sm text-muted-foreground mt-2">{insight.secondary}</p>
          </section>

          {/* Audience Snapshot */}
          {filteredDemographics.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Audience Snapshot</h2>
              <div className="space-y-4 bg-muted/20 rounded-xl p-4 border border-border/50">
                {filteredDemographics.map((demo, idx) => (
                  <DemographicBar 
                    key={idx} 
                    data={demo} 
                    optionA={poll.option_a}
                    optionB={poll.option_b}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Signal Quality Panel */}
          <section className="space-y-3">
            <h2 className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Signal Quality</h2>
            <div className="grid grid-cols-4 gap-2">
              <MetricLabel label="Consistency" value={signalMetrics.consistency} />
              <MetricLabel label="Velocity" value={signalMetrics.velocity} />
              <MetricLabel label="Polarization" value={signalMetrics.polarization} />
              <MetricLabel label="Diversity" value={signalMetrics.diversity} />
            </div>
          </section>
        </main>

        {/* Footer CTA */}
        <footer className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border p-4">
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1 h-12"
              onClick={onClose}
            >
              Close
            </Button>
            <Button 
              className="flex-1 h-12 bg-primary hover:bg-primary/90"
              onClick={() => {
                // Placeholder for PDF export
                console.log('Export insight as PDF');
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Export Insight
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
