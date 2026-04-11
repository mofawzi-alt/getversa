import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, MessageCircle, Download, ArrowRight, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getPollDisplayImageSrc } from '@/lib/pollImages';

interface CinematicResultsProps {
  poll: {
    id: string;
    question: string;
    option_a: string;
    option_b: string;
    image_a_url: string | null;
    image_b_url: string | null;
    category: string | null;
  };
  choice: 'A' | 'B';
  percentA: number;
  percentB: number;
  totalVotes: number;
  onNext: () => void;
  visible: boolean;
}

// ── Pattern detection ──
interface PatternResult {
  line: string;
}

async function detectPattern(userId: string, currentPollId: string, currentChoice: 'A' | 'B'): Promise<PatternResult | null> {
  try {
    const { data: recentVotes } = await supabase
      .from('votes')
      .select('poll_id, choice, category, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);

    if (!recentVotes || recentVotes.length < 5) return null;

    // Check: disagreed with majority streak
    const pollIds = recentVotes.slice(0, 10).map(v => v.poll_id);
    const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: pollIds });
    if (results && results.length > 0) {
      const resultMap = new Map(results.map(r => [r.poll_id, r]));
      let minorityStreak = 0;
      for (const vote of recentVotes.slice(0, 10)) {
        const r = resultMap.get(vote.poll_id);
        if (!r) continue;
        const userPct = vote.choice === 'A' ? r.percent_a : r.percent_b;
        if (userPct < 50) minorityStreak++;
        else break;
      }
      if (minorityStreak >= 3) {
        return { line: `You've disagreed with the majority ${minorityStreak} polls in a row.` };
      }

      // Check: majority agreement streak
      let majorityStreak = 0;
      for (const vote of recentVotes.slice(0, 15)) {
        const r = resultMap.get(vote.poll_id);
        if (!r) continue;
        const userPct = vote.choice === 'A' ? r.percent_a : r.percent_b;
        if (userPct >= 50) majorityStreak++;
        else break;
      }
      if (majorityStreak >= 5) {
        // Check if current vote broke the streak
        const currentResult = resultMap.get(currentPollId);
        if (currentResult) {
          const currentPct = currentChoice === 'A' ? currentResult.percent_a : currentResult.percent_b;
          if (currentPct < 50) {
            return { line: `You and most people agreed on the last ${majorityStreak} polls — until this one.` };
          }
        }
        return { line: `You've aligned with the majority ${majorityStreak} polls in a row.` };
      }
    }

    // Check: option A/B tag pattern (local vs international, etc.)
    const { data: votesWithPolls } = await supabase
      .from('votes')
      .select('choice, polls!inner(option_a_tag, option_b_tag)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (votesWithPolls && votesWithPolls.length >= 5) {
      const tagCounts: Record<string, number> = {};
      for (const v of votesWithPolls) {
        const poll = v.polls as any;
        const tag = v.choice === 'A' ? poll?.option_a_tag : poll?.option_b_tag;
        if (tag) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
      const topTag = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0];
      if (topTag && topTag[1] >= 5) {
        return { line: `This is the ${topTag[1]}th time you chose ${topTag[0].toLowerCase()}.` };
      }
    }

    // Check: changed usual pattern
    if (recentVotes.length >= 8) {
      const aCount = recentVotes.filter(v => v.choice === 'A').length;
      const bCount = recentVotes.filter(v => v.choice === 'B').length;
      const ratio = aCount / (aCount + bCount);
      if ((ratio > 0.7 && currentChoice === 'B') || (ratio < 0.3 && currentChoice === 'A')) {
        return { line: 'You changed your usual pattern on this one.' };
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ── Teaser hint generator ──
async function generateTeaser(pollId: string, percentA: number, percentB: number): Promise<string | null> {
  try {
    const diff = Math.abs(percentA - percentB);
    // Only show teaser if something interesting
    if (diff < 10) return null;

    const { data: votes } = await supabase
      .from('votes')
      .select('voter_gender, voter_age_range, voter_city')
      .eq('poll_id', pollId)
      .limit(200);

    if (!votes || votes.length < 10) return null;

    // Check gender split
    const maleVotes = votes.filter(v => v.voter_gender === 'Male');
    const femaleVotes = votes.filter(v => v.voter_gender === 'Female');
    if (maleVotes.length >= 5 && femaleVotes.length >= 5) {
      const maleA = maleVotes.filter(v => (v as any).choice === 'A' || true).length; // simplified
      const genderDiff = Math.abs((maleVotes.length / votes.length) - 0.5);
      if (genderDiff > 0.15) {
        return 'There is a surprising gender split on this poll.';
      }
    }

    // Check city split
    const cities = [...new Set(votes.map(v => v.voter_city).filter(Boolean))];
    if (cities.length >= 2) {
      return `${cities[0]} and ${cities[1]} are on opposite sides of this one.`;
    }

    // Check age split
    const ageGroups = [...new Set(votes.map(v => v.voter_age_range).filter(Boolean))];
    if (ageGroups.length >= 2) {
      return 'Your age group sees this differently from the overall result.';
    }

    return null;
  } catch {
    return null;
  }
}

// ── Personal statement ──
function getPersonalStatement(userPercent: number, city?: string | null): string {
  if (userPercent >= 55) return "You voted with most people on this one.";
  if (userPercent >= 45) return `${city || 'People'} ${city ? 'is' : 'are'} almost perfectly split on this one.`;
  if (userPercent >= 25) return "You see this differently from most people.";
  return `Only ${userPercent}% of people chose this. You're in rare company.`;
}

// ── Animated counter ──
function CountUp({ target, duration = 1200, delay = 0, className }: { target: number; duration?: number; delay?: number; className?: string }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start - delay;
      if (elapsed < 0) { requestAnimationFrame(animate); return; }
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, duration, delay]);
  return <span className={className}>{value}%</span>;
}

// ── Share card generator ──
function useShareCard(props: {
  question: string; optionA: string; optionB: string;
  percentA: number; percentB: number;
  imageAUrl: string | null; imageBUrl: string | null;
  choice: 'A' | 'B'; city?: string | null; isMinority: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generate = useCallback(async (): Promise<Blob | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const W = 1080, H = 1920;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    // Background
    const bg = props.isMinority ? '#020617' : '#0F172A';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle grid
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let y = 0; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // Minority badge
    if (props.isMinority) {
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath(); ctx.roundRect(W/2 - 120, 120, 240, 44, 22); ctx.fill();
      ctx.fillStyle = '#020617';
      ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('MINORITY OPINION', W/2, 149);
    }

    // Question
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 52px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    const words = props.question.split(' ');
    let lines: string[] = []; let cl = '';
    for (const w of words) {
      const test = cl ? `${cl} ${w}` : w;
      if (ctx.measureText(test).width > W - 200) { lines.push(cl); cl = w; } else cl = test;
    }
    if (cl) lines.push(cl);
    let y = props.isMinority ? 240 : 200;
    for (const l of lines) { ctx.fillText(l, W/2, y); y += 66; }

    // Load images
    const loadImg = (url: string): Promise<HTMLImageElement | null> =>
      new Promise(r => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => r(i); i.onerror = () => r(null); i.src = url; });
    const [imgA, imgB] = await Promise.all([
      props.imageAUrl ? loadImg(props.imageAUrl) : null,
      props.imageBUrl ? loadImg(props.imageBUrl) : null,
    ]);

    const imgY = y + 30;
    const imgW = 460, imgH = 520, gap = 40;
    const ax = W/2 - imgW - gap/2, bx = W/2 + gap/2;

    for (const [img, x, side] of [[imgA, ax, 'A'], [imgB, bx, 'B']] as const) {
      ctx.save();
      ctx.beginPath(); ctx.roundRect(x, imgY, imgW, imgH, 24); ctx.clip();
      if (img) {
        const s = Math.max(imgW / img.width, imgH / img.height);
        ctx.drawImage(img, x + (imgW - img.width*s)/2, imgY + (imgH - img.height*s)/2, img.width*s, img.height*s);
      } else { ctx.fillStyle = '#1e293b'; ctx.fillRect(x, imgY, imgW, imgH); }
      ctx.restore();
      if (side === props.choice) {
        ctx.strokeStyle = '#2563EB'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.roundRect(x, imgY, imgW, imgH, 24); ctx.stroke();
      }
    }

    // Result bar
    const barY = imgY + imgH + 60;
    const barW = W - 160, barH = 20, barX = 80;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 10); ctx.fill();
    const aW = barW * (props.percentA / 100);
    ctx.fillStyle = props.choice === 'A' ? '#2563EB' : '#64748B';
    ctx.beginPath(); ctx.roundRect(barX, barY, aW, barH, 10); ctx.fill();
    ctx.fillStyle = props.choice === 'B' ? '#2563EB' : '#64748B';
    ctx.beginPath(); ctx.roundRect(barX + aW, barY, barW - aW, barH, 10); ctx.fill();

    // Percentages on sides
    ctx.font = 'bold 56px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = props.choice === 'A' ? '#2563EB' : '#94A3B8';
    ctx.fillText(`${props.percentA}%`, barX, barY + 80);
    ctx.textAlign = 'right';
    ctx.fillStyle = props.choice === 'B' ? '#2563EB' : '#94A3B8';
    ctx.fillText(`${props.percentB}%`, barX + barW, barY + 80);

    // Personal statement
    const userPct = props.choice === 'A' ? props.percentA : props.percentB;
    const stmt = userPct >= 50
      ? `I voted with the ${userPct}%`
      : `I voted with the ${userPct}% minority`;
    ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(stmt, W/2, barY + 150);

    // City
    if (props.city) {
      ctx.font = '28px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText(props.city, W/2, barY + 195);
    }

    // VERSA branding + CTA
    ctx.font = 'bold 40px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'right';
    ctx.fillText('VERSA', W - 60, H - 90);

    // Prominent link CTA — use poll-specific deep link
    const pollLink = `getversa.app/poll/${props.question ? '' : ''}`;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = 'bold 32px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Vote now 👉 getversa.app', W / 2, H - 40);

    return new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.92));
  }, [props]);

  return { canvasRef, generate };
}

// ── Main component ──
export default function CinematicResults({ poll, choice, percentA, percentB, totalVotes, onNext, visible }: CinematicResultsProps) {
  const { user, profile } = useAuth();
  const userPercent = choice === 'A' ? percentA : percentB;
  const isMinority = userPercent < 25;

  // Animation step control
  const [step, setStep] = useState(0);
  const [showNextHint, setShowNextHint] = useState(false);
  const [patternLine, setPatternLine] = useState<string | null>(null);
  const [teaserLine, setTeaserLine] = useState<string | null>(null);

  const imgA = getPollDisplayImageSrc({ imageUrl: poll.image_a_url, option: poll.option_a, question: poll.question, side: 'A' });
  const imgB = getPollDisplayImageSrc({ imageUrl: poll.image_b_url, option: poll.option_b, question: poll.question, side: 'B' });

  const { canvasRef, generate } = useShareCard({
    question: poll.question, optionA: poll.option_a, optionB: poll.option_b,
    percentA, percentB, imageAUrl: poll.image_a_url, imageBUrl: poll.image_b_url,
    choice, city: profile?.city, isMinority,
  });

  // Fetch pattern + teaser in parallel
  useEffect(() => {
    if (!visible) return;
    if (user?.id) {
      detectPattern(user.id, poll.id, choice).then(p => setPatternLine(p?.line || null));
    }
    generateTeaser(poll.id, percentA, percentB).then(t => setTeaserLine(t));
  }, [visible, user?.id, poll.id, choice, percentA, percentB]);

  // Animation sequence
  useEffect(() => {
    if (!visible) { setStep(0); setShowNextHint(false); return; }
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Step 1: bg (0ms), Step 2: images (300ms), Step 3: glow (500ms), Step 4: number (800ms)
    // Step 5: statement (2000ms), Step 6: pattern (2400ms), Step 7: teaser (2700ms)
    // Step 8: celebrity (3000ms), Step 9: share card (3300ms), Step 10: buttons (3800ms)
    const delays = [0, 300, 500, 800, 2000, 2400, 2700, 3000, 3300, 3800];
    delays.forEach((d, i) => timers.push(setTimeout(() => setStep(i + 1), d)));
    timers.push(setTimeout(() => setShowNextHint(true), 5000));
    return () => timers.forEach(clearTimeout);
  }, [visible]);

  const handleShare = useCallback(async (type: 'instagram' | 'whatsapp' | 'save') => {
    try {
      const blob = await generate();
      if (!blob) { toast.error('Failed to generate'); return; }
      const file = new File([blob], 'versa-result.jpg', { type: 'image/jpeg' });

      const username = profile?.username || '';
      const pollUrl = `${window.location.origin}/poll/${poll.id}?c=${choice}${username ? `&by=${encodeURIComponent(username)}` : ''}`;

      if (type === 'save') {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'versa-result.jpg'; a.click();
        URL.revokeObjectURL(url);
        toast.success('Saved to downloads 📸');
        return;
      }

      const shareText = `What would you choose? Vote on Versa 👉 ${pollUrl}`;

      if (type === 'whatsapp') {
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ text: shareText, files: [file] });
        } else {
          window.open(`https://wa.me/?text=${encodeURIComponent(`📊 ${poll.question}\n\n${shareText}`)}`, '_blank');
        }
        return;
      }

      // Instagram / generic share
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'VERSA', text: shareText, url: pollUrl, files: [file] });
      } else {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          toast.success('Image copied! Paste it in your Instagram story 📋');
        } catch {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = 'versa-result.jpg'; a.click();
          URL.revokeObjectURL(url);
          toast.success('Image saved! Open Instagram and share it 📸');
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') toast.error('Share failed');
    }
  }, [generate, poll.question, poll.id, choice, profile?.username]);

  const bgColor = isMinority ? '#020617' : '#0F172A';
  const accentColor = isMinority ? '#F59E0B' : '#ffffff';
  const statement = getPersonalStatement(userPercent, profile?.city);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex flex-col overflow-y-auto"
          style={{ backgroundColor: bgColor }}
        >
          <canvas ref={canvasRef} className="hidden" />

          {/* Background images — dimmed */}
          {step >= 2 && (
            <div className="absolute inset-0 flex pointer-events-none">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: choice === 'A' ? 0.15 : 0.08 }}
                transition={{ duration: 0.5, delay: step >= 3 ? 0 : 0.3 }}
                className="w-1/2 h-full relative overflow-hidden"
              >
                <img src={imgA} alt="" className="w-full h-full object-cover" />
                {choice === 'A' && step >= 3 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0"
                    style={{ boxShadow: `inset 0 0 80px ${isMinority ? 'rgba(245,158,11,0.3)' : 'rgba(37,99,235,0.3)'}` }}
                  />
                )}
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: choice === 'B' ? 0.15 : 0.08 }}
                transition={{ duration: 0.5, delay: step >= 3 ? 0 : 0.3 }}
                className="w-1/2 h-full relative overflow-hidden"
              >
                <img src={imgB} alt="" className="w-full h-full object-cover" />
                {choice === 'B' && step >= 3 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0"
                    style={{ boxShadow: `inset 0 0 80px ${isMinority ? 'rgba(245,158,11,0.3)' : 'rgba(37,99,235,0.3)'}` }}
                  />
                )}
              </motion.div>
            </div>
          )}

          {/* Gold edge glow for minority */}
          {isMinority && step >= 4 && (
            <div className="absolute inset-0 pointer-events-none" style={{
              boxShadow: 'inset 0 0 120px rgba(245,158,11,0.12)',
            }} />
          )}

          {/* Content */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-8 min-h-0">
            {/* Minority badge */}
            {isMinority && step >= 4 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-4 px-5 py-1.5 rounded-full"
                style={{ backgroundColor: '#F59E0B' }}
              >
                <span className="text-[11px] font-bold tracking-[0.15em] text-[#020617] uppercase">
                  Minority Opinion
                </span>
              </motion.div>
            )}

            {/* Big number */}
            {step >= 4 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                className="text-center"
              >
                <span
                  className="font-bold tracking-tight block"
                  style={{
                    fontSize: 'clamp(72px, 20vw, 120px)',
                    color: accentColor,
                    lineHeight: 1,
                  }}
                >
                  <CountUp target={userPercent} duration={1200} />
                </span>
              </motion.div>
            )}

            {/* Personal statement */}
            {step >= 5 && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="mt-3 text-center text-base font-medium max-w-xs"
                style={{ color: 'rgba(255,255,255,0.85)' }}
              >
                {statement}
              </motion.p>
            )}

            {/* Minority second line */}
            {isMinority && step >= 5 && (
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="mt-1 text-center text-sm max-w-xs"
                style={{ color: 'rgba(255,255,255,0.5)' }}
              >
                The most interesting opinions are the ones nobody expects.
              </motion.p>
            )}

            {/* Pattern insight */}
            {step >= 6 && patternLine && (
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-4 text-center text-sm font-semibold max-w-xs"
                style={{ color: '#F59E0B' }}
              >
                {patternLine}
              </motion.p>
            )}

            {/* Teaser hint */}
            {step >= 7 && teaserLine && (
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-3 text-center text-sm italic max-w-xs"
                style={{ color: '#64748B' }}
              >
                {teaserLine}
              </motion.p>
            )}
          </div>

          {/* Bottom section: share card + buttons */}
          <div className="relative z-10 px-5 pb-6 space-y-3">
            {/* Share card preview */}
            {step >= 9 && (
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, type: 'spring', damping: 25 }}
                className="rounded-2xl p-4 border"
                style={{
                  backgroundColor: 'rgba(15,23,42,0.9)',
                  borderColor: isMinority ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.1)',
                }}
              >
                <p className="text-white font-bold text-sm text-center mb-3">{poll.question}</p>
                <div className="flex gap-2 mb-3">
                  <div className="flex-1 rounded-xl overflow-hidden aspect-[3/4]">
                    <img src={imgA} alt={poll.option_a} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 rounded-xl overflow-hidden aspect-[3/4]">
                    <img src={imgB} alt={poll.option_b} className="w-full h-full object-cover" />
                  </div>
                </div>
                {/* Bar */}
                <div className="h-2 rounded-full overflow-hidden flex mb-2" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                  <div className="h-full rounded-l-full" style={{ width: `${percentA}%`, backgroundColor: choice === 'A' ? '#2563EB' : '#475569' }} />
                  <div className="h-full rounded-r-full" style={{ width: `${percentB}%`, backgroundColor: choice === 'B' ? '#2563EB' : '#475569' }} />
                </div>
                <div className="flex justify-between text-xs font-bold">
                  <span style={{ color: choice === 'A' ? '#2563EB' : '#94A3B8' }}>{percentA}%</span>
                  <span className="text-white/50 text-[10px]">
                    {userPercent >= 50 ? `I voted with the ${userPercent}%` : `I voted with the ${userPercent}% minority`}
                  </span>
                  <span style={{ color: choice === 'B' ? '#2563EB' : '#94A3B8' }}>{percentB}%</span>
                </div>
              </motion.div>
            )}

            {/* Share buttons */}
            {step >= 10 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="space-y-2"
              >
                <Button
                  onClick={() => handleShare('instagram')}
                  className="w-full h-12 rounded-xl font-bold text-base gap-2"
                  style={{
                    backgroundColor: isMinority ? '#F59E0B' : '#2563EB',
                    color: isMinority ? '#020617' : '#ffffff',
                  }}
                >
                  <Share2 className="h-5 w-5" />
                  Share to Instagram Stories
                </Button>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleShare('whatsapp')}
                    variant="outline"
                    className="flex-1 h-10 rounded-xl font-semibold text-sm gap-2 border-white/10 text-white bg-white/5 hover:bg-white/10"
                  >
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </Button>
                  <Button
                    onClick={() => handleShare('save')}
                    variant="outline"
                    className="flex-1 h-10 rounded-xl font-semibold text-sm gap-2 border-white/10 text-white bg-white/5 hover:bg-white/10"
                  >
                    <Download className="h-4 w-4" />
                    Save
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Next poll */}
            <AnimatePresence>
              {showNextHint && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0.4, 0.9, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  exit={{ opacity: 0 }}
                  onClick={onNext}
                  className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold"
                  style={{ color: 'rgba(255,255,255,0.6)' }}
                >
                  Next battle <ArrowRight className="h-4 w-4" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
