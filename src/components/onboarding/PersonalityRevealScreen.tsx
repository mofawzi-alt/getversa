import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import ShareToStoryButton from '@/components/stories/ShareToStoryButton';
import versaLogoImg from '@/assets/versa-wordmark.png';

// ── Onboarding poll option map for personalized descriptions ──
const POLL_OPTIONS: Record<number, { question: string; optionA: string; optionB: string; tagA: string; tagB: string }> = {
  1:  { question: 'Ahly or Zamalek?', optionA: 'Ahly', optionB: 'Zamalek', tagA: 'loyal', tagB: 'elite' },
  2:  { question: 'Delivery or cook at home?', optionA: 'Delivery', optionB: 'Cook at home', tagA: 'spontaneous', tagB: 'homebody' },
  3:  { question: 'Cairo or Dubai to live?', optionA: 'Cairo', optionB: 'Dubai', tagA: 'rooted', tagB: 'ambitious' },
  4:  { question: 'Save or invest?', optionA: 'Save', optionB: 'Invest', tagA: 'practical', tagB: 'risktaker' },
  5:  { question: 'Big wedding or intimate?', optionA: 'Big wedding', optionB: 'Intimate', tagA: 'social', tagB: 'private' },
  6:  { question: 'Startup or corporate?', optionA: 'Startup', optionB: 'Corporate', tagA: 'risktaker', tagB: 'stable' },
  7:  { question: 'Starbucks or local café?', optionA: 'Starbucks', optionB: 'Local café', tagA: 'global', tagB: 'authentic' },
  8:  { question: 'Work from home or office?', optionA: 'Work from home', optionB: 'Office', tagA: 'independent', tagB: 'social' },
  9:  { question: 'TikTok or Instagram?', optionA: 'TikTok', optionB: 'Instagram', tagA: 'trendsetter', tagB: 'curated' },
  10: { question: 'Egypt or abroad for work?', optionA: 'Egypt', optionB: 'Abroad', tagA: 'rooted', tagB: 'explorer' },
  11: { question: 'Koshary or pasta?', optionA: 'Koshary', optionB: 'Pasta', tagA: 'authentic', tagB: 'global' },
  12: { question: 'Compound or city apartment?', optionA: 'Compound', optionB: 'City apartment', tagA: 'luxury', tagB: 'authentic' },
  13: { question: 'Cash or card?', optionA: 'Cash', optionB: 'Card', tagA: 'practical', tagB: 'digital' },
  14: { question: 'Netflix or Shahid?', optionA: 'Netflix', optionB: 'Shahid', tagA: 'global', tagB: 'local' },
  15: { question: 'Sahel or Sharm?', optionA: 'Sahel', optionB: 'Sharm', tagA: 'social', tagB: 'explorer' },
};

// ── 6 Archetypes mapped to onboarding trait tags ──
interface Archetype {
  name: string;
  emoji: string;
  coreTraits: string[]; // tags that strongly signal this archetype
  description: string; // template (not used directly — personalized description is built dynamically)
}

const ARCHETYPES: Archetype[] = [
  {
    name: 'The Rooted Realist',
    emoji: '🏛️',
    coreTraits: ['rooted', 'practical', 'authentic', 'stable', 'homebody', 'local', 'loyal'],
    description: 'Grounded in tradition, you know exactly who you are.',
  },
  {
    name: 'The Bold Maverick',
    emoji: '⚡',
    coreTraits: ['risktaker', 'ambitious', 'explorer', 'spontaneous', 'trendsetter'],
    description: 'You chase the edge — risk, novelty, and ambition fuel you.',
  },
  {
    name: 'The Social Architect',
    emoji: '🤝',
    coreTraits: ['social', 'global', 'elite', 'luxury', 'curated'],
    description: 'You build connections and curate experiences for the world around you.',
  },
  {
    name: 'The Quiet Strategist',
    emoji: '🎯',
    coreTraits: ['private', 'independent', 'practical', 'digital', 'stable'],
    description: 'You move in silence — calculated, private, and always three steps ahead.',
  },
  {
    name: 'The Culture Keeper',
    emoji: '🌍',
    coreTraits: ['authentic', 'rooted', 'local', 'loyal', 'homebody'],
    description: 'Proudly local, deeply authentic — you carry the culture forward.',
  },
  {
    name: 'The Global Explorer',
    emoji: '✈️',
    coreTraits: ['global', 'explorer', 'ambitious', 'trendsetter', 'digital', 'risktaker'],
    description: 'The world is your playground — borders are just suggestions.',
  },
];

function scoreArchetype(tagCounts: Map<string, number>, archetype: Archetype): number {
  let score = 0;
  for (const trait of archetype.coreTraits) {
    score += tagCounts.get(trait) || 0;
  }
  return score;
}

function determineArchetype(tagCounts: Map<string, number>): Archetype {
  let best = ARCHETYPES[0];
  let bestScore = -1;
  for (const arch of ARCHETYPES) {
    const s = scoreArchetype(tagCounts, arch);
    if (s > bestScore) { bestScore = s; best = arch; }
  }
  return best;
}

function getTopTraits(tagCounts: Map<string, number>, count: number): string[] {
  return [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([tag]) => tag);
}

// Friendly tag → display name
const TAG_DISPLAY: Record<string, string> = {
  loyal: 'Loyal', elite: 'Elite', spontaneous: 'Spontaneous', homebody: 'Homebody',
  rooted: 'Rooted', ambitious: 'Ambitious', practical: 'Practical', risktaker: 'Risk Taker',
  social: 'Social', private: 'Private', stable: 'Stable', global: 'Global',
  authentic: 'Authentic', independent: 'Independent', trendsetter: 'Trendsetter',
  curated: 'Curated', explorer: 'Explorer', luxury: 'Luxury', digital: 'Digital', local: 'Local',
};

// Build personalized description from actual vote choices
function buildPersonalizedDescription(
  votes: { pollOrder: number; choice: 'A' | 'B' }[],
  archetype: Archetype,
  tagCounts: Map<string, number>,
): string {
  // Get the specific option names the user chose
  const chosenOptions: string[] = [];
  const chosenTags: string[] = [];
  for (const v of votes) {
    const poll = POLL_OPTIONS[v.pollOrder];
    if (!poll) continue;
    const optName = v.choice === 'A' ? poll.optionA : poll.optionB;
    const optTag = v.choice === 'A' ? poll.tagA : poll.tagB;
    chosenOptions.push(optName);
    chosenTags.push(optTag);
  }

  // Pick 2-3 most characterful choices to mention
  // Prioritize choices that match the archetype's core traits
  const scored = votes.map((v, i) => {
    const poll = POLL_OPTIONS[v.pollOrder];
    if (!poll) return { name: '', tag: '', score: 0, order: v.pollOrder };
    const tag = v.choice === 'A' ? poll.tagA : poll.tagB;
    const name = v.choice === 'A' ? poll.optionA : poll.optionB;
    const isCore = archetype.coreTraits.includes(tag) ? 2 : 0;
    return { name, tag, score: isCore + (tagCounts.get(tag) || 0), order: v.pollOrder };
  }).filter(s => s.name).sort((a, b) => b.score - a.score);

  const topPicks = scored.slice(0, 3);
  const names = topPicks.map(p => p.name);

  // Get top 2 trait tags for the summary line
  const topTraits = getTopTraits(tagCounts, 2);
  const traitWords = topTraits.map(t => TAG_DISPLAY[t] || t).join(' and ').toLowerCase();

  // Build the sentence
  if (names.length >= 3) {
    return `You chose ${names[0]}, ${names[1]}, and ${names[2]}. ${capitalize(traitWords)} — that's your signature.`;
  } else if (names.length === 2) {
    return `You chose ${names[0]} and ${names[1]}. ${capitalize(traitWords)} defines how you move.`;
  }
  return `You chose ${names[0]}. ${capitalize(traitWords)} runs through every choice you make.`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Minority score calculation ──
async function calculateMinorityScore(
  userId: string,
  pollIds: string[],
  userChoices: Map<string, 'A' | 'B'>,
): Promise<number> {
  // Get results for all onboarding polls
  const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: pollIds });
  if (!results || results.length === 0) return 0;

  let minorityCount = 0;
  for (const r of results) {
    const userChoice = userChoices.get(r.poll_id);
    if (!userChoice) continue;
    const userPercent = userChoice === 'A' ? r.percent_a : (100 - r.percent_a);
    if (userPercent < 50) minorityCount++;
  }

  return Math.round((minorityCount / pollIds.length) * 100);
}

// ── Main Component ──
interface PersonalityRevealScreenProps {
  onComplete: () => void;
}

export default function PersonalityRevealScreen({ onComplete }: PersonalityRevealScreenProps) {
  const { user } = useAuth();
  const [phase, setPhase] = useState<'loading' | 'reveal'>('loading');
  const [archetype, setArchetype] = useState<Archetype | null>(null);
  const [personalizedDesc, setPersonalizedDesc] = useState('');
  const [topTraits, setTopTraits] = useState<string[]>([]);
  const [minorityScore, setMinorityScore] = useState(0);
  const [animatedMinority, setAnimatedMinority] = useState(0);
  const [showShareCard, setShowShareCard] = useState(false);
  const [showCTAs, setShowCTAs] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    async function analyze() {
      if (!user) {
        // Fallback for unauthenticated
        setArchetype(ARCHETYPES[0]);
        setPersonalizedDesc('Your choices tell a story. Sign up to see the full picture.');
        setTopTraits(['authentic', 'rooted', 'practical']);
        setMinorityScore(25);
        setPhase('reveal');
        return;
      }

      // Fetch onboarding poll IDs
      const { data: obRows } = await supabase
        .from('onboarding_polls')
        .select('poll_id, display_order')
        .order('display_order', { ascending: true });

      if (!obRows || obRows.length === 0) {
        setArchetype(ARCHETYPES[0]);
        setPhase('reveal');
        return;
      }

      const pollIds = obRows.map(r => r.poll_id);
      const orderMap = new Map(obRows.map(r => [r.poll_id, r.display_order]));

      // Fetch user's votes on these polls
      const { data: votes } = await supabase
        .from('votes')
        .select('poll_id, choice')
        .eq('user_id', user.id)
        .in('poll_id', pollIds);

      if (!votes || votes.length === 0) {
        setArchetype(ARCHETYPES[0]);
        setPhase('reveal');
        return;
      }

      // Fetch poll data for tags
      const { data: polls } = await supabase
        .from('polls')
        .select('id, option_a_tag, option_b_tag')
        .in('id', pollIds);

      if (!polls) {
        setArchetype(ARCHETYPES[0]);
        setPhase('reveal');
        return;
      }

      // Build tag counts and vote record
      const tagCounts = new Map<string, number>();
      const userChoices = new Map<string, 'A' | 'B'>();
      const voteRecords: { pollOrder: number; choice: 'A' | 'B' }[] = [];

      for (const vote of votes) {
        const poll = polls.find(p => p.id === vote.poll_id);
        if (!poll) continue;
        const choice = vote.choice as 'A' | 'B';
        userChoices.set(vote.poll_id, choice);
        const tag = choice === 'A' ? poll.option_a_tag : poll.option_b_tag;
        if (tag) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        const order = orderMap.get(vote.poll_id) || 0;
        voteRecords.push({ pollOrder: order, choice });
      }

      // Determine archetype
      const arch = determineArchetype(tagCounts);
      setArchetype(arch);

      // Build personalized description
      const desc = buildPersonalizedDescription(voteRecords, arch, tagCounts);
      setPersonalizedDesc(desc);

      // Top 3 traits
      setTopTraits(getTopTraits(tagCounts, 3));

      // Minority score
      const minScore = await calculateMinorityScore(user.id, pollIds, userChoices);
      setMinorityScore(minScore);

      setPhase('reveal');
    }

    analyze();
  }, [user]);

  // Animate minority counter
  useEffect(() => {
    if (phase !== 'reveal') return;
    // Start counting at 1800ms
    const startDelay = setTimeout(() => {
      const duration = 1500;
      const startTime = Date.now();
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        setAnimatedMinority(Math.round(progress * minorityScore));
        if (progress >= 1) clearInterval(interval);
      }, 30);
      return () => clearInterval(interval);
    }, 1800);
    return () => clearTimeout(startDelay);
  }, [phase, minorityScore]);

  // Trigger share card and CTAs
  useEffect(() => {
    if (phase !== 'reveal') return;
    const t1 = setTimeout(() => setShowShareCard(true), 3000);
    const t2 = setTimeout(() => setShowCTAs(true), 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [phase]);

  // ── Share card image generation ──
  const generateShareImage = useCallback(async (): Promise<Blob | null> => {
    const canvas = canvasRef.current;
    if (!canvas || !archetype) return null;

    const W = 1080;
    const H = 1920;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Dark gradient background
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#0a0a1a');
    grad.addColorStop(0.3, '#141432');
    grad.addColorStop(0.6, '#1e1e3a');
    grad.addColorStop(1, '#0d0d1f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Radial glow
    const glow = ctx.createRadialGradient(W / 2, 600, 0, W / 2, 600, 500);
    glow.addColorStop(0, 'rgba(232, 57, 42, 0.15)');
    glow.addColorStop(1, 'rgba(232, 57, 42, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Emoji
    ctx.font = '160px serif';
    ctx.textAlign = 'center';
    ctx.fillText(archetype.emoji, W / 2, 520);

    // "Your Versa Type"
    ctx.font = 'bold 28px "Inter", "Space Grotesk", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.letterSpacing = '6px';
    ctx.fillText('YOUR VERSA TYPE', W / 2, 620);

    // Archetype name
    ctx.font = 'bold 72px "Space Grotesk", "Inter", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(archetype.name, W / 2, 730);

    // Personalized description
    ctx.font = '32px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    const words = personalizedDesc.split(' ');
    let line = '';
    let y = 830;
    for (const word of words) {
      const test = line + word + ' ';
      if (ctx.measureText(test).width > W - 200) {
        ctx.fillText(line.trim(), W / 2, y);
        line = word + ' ';
        y += 50;
      } else {
        line = test;
      }
    }
    if (line.trim()) ctx.fillText(line.trim(), W / 2, y);

    // Trait pills
    const pillY = y + 80;
    const pillSpacing = 240;
    const startX = W / 2 - (topTraits.length - 1) * pillSpacing / 2;
    ctx.font = 'bold 28px "Inter", sans-serif';
    for (let i = 0; i < topTraits.length; i++) {
      const px = startX + i * pillSpacing;
      const label = TAG_DISPLAY[topTraits[i]] || topTraits[i];
      const tw = ctx.measureText(label).width;
      // Pill background
      ctx.fillStyle = 'rgba(232, 57, 42, 0.2)';
      const pw = tw + 50;
      ctx.beginPath();
      ctx.roundRect(px - pw / 2, pillY - 20, pw, 48, 24);
      ctx.fill();
      // Pill border
      ctx.strokeStyle = 'rgba(232, 57, 42, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Pill text
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText(label, px, pillY + 10);
    }

    // getversa.app
    ctx.font = '600 26px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillText('Find your type at getversa.app', W / 2, H - 200);

    // @join.versa
    ctx.font = '24px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillText('@join.versa', W / 2, H - 150);

    // Logo
    try {
      const logo = new Image();
      logo.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        logo.onload = () => resolve();
        logo.onerror = reject;
        logo.src = versaLogoImg;
      });
      const destH = 50;
      const destW = (logo.width / logo.height) * destH;
      ctx.drawImage(logo, (W - destW) / 2, H - 100, destW, destH);
    } catch {
      // fallback text
      ctx.font = 'bold 36px "Space Grotesk", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText('VERSA', W / 2, H - 70);
    }

    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  }, [archetype, personalizedDesc, topTraits]);

  const handleShareType = useCallback(async () => {
    setGenerating(true);
    try {
      const blob = await generateShareImage();
      if (!blob) { toast.error('Failed to generate card'); return; }

      const file = new File([blob], 'versa-personality.jpg', { type: 'image/jpeg' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `I'm ${archetype?.name} on Versa`,
          text: `My Versa type: ${archetype?.name} ${archetype?.emoji}\n${personalizedDesc}\n\nFind your type at getversa.app`,
        });
      } else {
        // Fallback: download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'versa-personality.jpg';
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Personality card downloaded! Share it to your stories ✨');
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') toast.error('Share failed');
    } finally {
      setGenerating(false);
    }
  }, [generateShareImage, archetype, personalizedDesc]);

  const minorityBadge = minorityScore > 40
    ? { label: 'Independent thinker', emoji: '🧠' }
    : minorityScore < 20
    ? { label: 'With the crowd', emoji: '👥' }
    : null;

  if (phase === 'loading') {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-6"
        style={{ background: 'linear-gradient(180deg, #0a0a1a 0%, #141432 50%, #1e1e3a 100%)' }}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4 text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            className="w-16 h-16 rounded-full border-4 border-white/30 border-t-white"
          />
          <p className="text-lg font-display font-bold text-white">
            Analyzing your choices…
          </p>
          <p className="text-sm text-white/50">Building your identity</p>
        </motion.div>
      </div>
    );
  }

  if (!archetype) return null;

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto safe-area-top safe-area-bottom"
      style={{ background: 'linear-gradient(180deg, #0a0a1a 0%, #141432 40%, #1e1e3a 70%, #0d0d1f 100%)' }}
    >
      {/* Dark overlay fade in — 0ms */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="min-h-full flex flex-col items-center justify-center px-6 py-10"
      >
        {/* Radial glow behind content */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 50% 35%, rgba(232,57,42,0.08) 0%, transparent 60%)' }}
        />

        <div className="relative z-10 flex flex-col items-center text-center max-w-sm w-full">
          {/* ELEMENT: Emoji — 300ms */}
          <motion.div
            initial={{ opacity: 0, y: -60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 15 }}
            className="text-7xl mb-4"
          >
            {archetype.emoji}
          </motion.div>

          {/* ELEMENT 1: Archetype name — 600ms */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            <p className="text-[10px] font-bold tracking-[4px] text-white/30 uppercase mb-2">
              Your Versa Type
            </p>
            <h1 className="text-3xl font-display font-bold text-white mb-3">
              {archetype.name}
            </h1>
          </motion.div>

          {/* ELEMENT 2: Personalized description — 900ms */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.4 }}
            className="text-sm text-white/65 leading-relaxed mb-5 max-w-[300px]"
          >
            {personalizedDesc}
          </motion.p>

          {/* ELEMENT 3: Three trait pills — 1100ms, 1300ms, 1500ms */}
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {topTraits.map((trait, i) => (
              <motion.span
                key={trait}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.1 + i * 0.2, type: 'spring', stiffness: 300, damping: 20 }}
                className="px-4 py-2 rounded-full text-xs font-bold text-white/90"
                style={{
                  background: 'rgba(232, 57, 42, 0.15)',
                  border: '1px solid rgba(232, 57, 42, 0.3)',
                }}
              >
                {TAG_DISPLAY[trait] || trait}
              </motion.span>
            ))}
          </div>

          {/* ELEMENT 4: Minority score — 1800ms */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.8, duration: 0.4 }}
            className="mb-6 flex flex-col items-center gap-2"
          >
            <p className="text-sm text-white/50">
              You voted against the majority{' '}
              <span className="text-white font-bold text-lg">{animatedMinority}%</span>
              {' '}of the time
            </p>
            {minorityBadge && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 3.3, type: 'spring' }}
                className="px-3 py-1.5 rounded-full text-xs font-bold"
                style={{
                  background: minorityScore > 40
                    ? 'rgba(99, 102, 241, 0.2)'
                    : 'rgba(255, 255, 255, 0.1)',
                  border: minorityScore > 40
                    ? '1px solid rgba(99, 102, 241, 0.4)'
                    : '1px solid rgba(255, 255, 255, 0.2)',
                  color: minorityScore > 40 ? '#a5b4fc' : 'rgba(255,255,255,0.7)',
                }}
              >
                {minorityBadge.emoji} {minorityBadge.label}
              </motion.span>
            )}
          </motion.div>

          {/* ELEMENT 5: Share card preview — 3000ms */}
          <AnimatePresence>
            {showShareCard && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full rounded-2xl p-5 mb-6 text-center"
                style={{
                  background: 'linear-gradient(160deg, rgba(20,20,50,0.9) 0%, rgba(30,30,58,0.9) 100%)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(20px)',
                }}
              >
                <div className="text-4xl mb-2">{archetype.emoji}</div>
                <h3 className="text-xl font-display font-bold text-white mb-1">{archetype.name}</h3>
                <div className="flex justify-center gap-1.5 mb-3">
                  {topTraits.map(t => (
                    <span key={t} className="px-2.5 py-1 rounded-full text-[10px] font-bold text-white/80"
                      style={{ background: 'rgba(232,57,42,0.15)', border: '1px solid rgba(232,57,42,0.25)' }}
                    >
                      {TAG_DISPLAY[t] || t}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-white/50 leading-relaxed mb-3 max-w-[260px] mx-auto">
                  {personalizedDesc}
                </p>
                <p className="text-[10px] text-white/25">Find your type at getversa.app</p>
                <p className="text-[10px] text-white/20">@join.versa</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ELEMENT 6: Two CTA buttons — 3500ms */}
          <AnimatePresence>
            {showCTAs && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, type: 'spring', stiffness: 200, damping: 20 }}
                className="w-full space-y-3"
              >
                {/* Share your type — uses existing Web Share API / download fallback */}
                <Button
                  onClick={handleShareType}
                  disabled={generating}
                  className="w-full h-14 rounded-2xl font-display font-bold text-base gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #E8392A 0%, #d42d1f 100%)',
                    color: '#fff',
                  }}
                >
                  <Share2 className="h-5 w-5" />
                  {generating ? 'Generating...' : 'Share your type'}
                </Button>

                {/* Post to Versa story */}
                {user && (
                  <ShareToStoryButton
                    storyType="achievement"
                    content={{
                      title: archetype.name,
                      emoji: archetype.emoji,
                      description: personalizedDesc,
                      traits: topTraits.map(t => TAG_DISPLAY[t] || t),
                      minority_score: minorityScore,
                    }}
                    variant="compact"
                    className="w-full"
                  />
                )}

                {/* See what Egypt chose */}
                <Button
                  onClick={onComplete}
                  variant="outline"
                  className="w-full h-14 rounded-2xl font-display font-bold text-base border-white/15 text-white hover:bg-white/10"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                >
                  See what Egypt chose 🇪🇬
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Hidden canvas for share image generation */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
