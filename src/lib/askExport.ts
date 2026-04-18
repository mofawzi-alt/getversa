import jsPDF from 'jspdf';

export interface ResearchPoll {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  percent_a: number;
  percent_b: number;
  total_votes: number;
  category?: string | null;
  viewer_age_line?: string | null;
  viewer_city_line?: string | null;
  gender_teaser?: string | null;
}

export interface ResearchPayload {
  question: string;
  summary: string;
  polls: ResearchPoll[];
}

export function buildCopyText({ question, summary, polls }: ResearchPayload): string {
  const lines: string[] = [];
  lines.push(`Versa Research Brief`);
  lines.push(`Question: ${question}`);
  lines.push('');
  lines.push(`Summary: ${summary}`);
  lines.push('');
  lines.push(`Source polls (n=${polls.length}):`);
  polls.forEach((p, i) => {
    lines.push(`${i + 1}. ${p.question}`);
    lines.push(`   ${p.option_a}: ${p.percent_a}%  |  ${p.option_b}: ${p.percent_b}%  (n=${p.total_votes})`);
    if (p.viewer_age_line) lines.push(`   ${p.viewer_age_line}`);
    if (p.viewer_city_line) lines.push(`   ${p.viewer_city_line}`);
    if (p.gender_teaser) lines.push(`   ${p.gender_teaser}`);
  });
  lines.push('');
  lines.push(`Source: Versa (getversa.app) — Egypt's opinion pulse`);
  lines.push(`Generated: ${new Date().toLocaleDateString()}`);
  return lines.join('\n');
}

export function downloadResearchPdf(payload: ResearchPayload) {
  const { question, summary, polls } = payload;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  let y = margin;

  const ensureSpace = (need: number) => {
    if (y + need > pageH - margin) { doc.addPage(); y = margin; }
  };

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Versa Research Brief', margin, y);
  y += 22;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleDateString()} · getversa.app`, margin, y);
  y += 18;
  doc.setDrawColor(220);
  doc.line(margin, y, pageW - margin, y);
  y += 22;

  // Question
  doc.setTextColor(20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Research question', margin, y); y += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  const qLines = doc.splitTextToSize(question, pageW - margin * 2);
  doc.text(qLines, margin, y);
  y += qLines.length * 15 + 14;

  // Summary
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Headline finding', margin, y); y += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  const sLines = doc.splitTextToSize(summary, pageW - margin * 2);
  ensureSpace(sLines.length * 15);
  doc.text(sLines, margin, y);
  y += sLines.length * 15 + 18;

  // Polls
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Source polls (${polls.length})`, margin, y); y += 16;

  polls.forEach((p, i) => {
    ensureSpace(80);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    const qL = doc.splitTextToSize(`${i + 1}. ${p.question}`, pageW - margin * 2);
    doc.text(qL, margin, y); y += qL.length * 14 + 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(60);
    doc.text(`${p.option_a}: ${p.percent_a}%   |   ${p.option_b}: ${p.percent_b}%   ·   n=${p.total_votes}`, margin, y);
    y += 14;

    const extras = [p.viewer_age_line, p.viewer_city_line, p.gender_teaser].filter(Boolean) as string[];
    extras.forEach((line) => {
      const ll = doc.splitTextToSize(`• ${line}`, pageW - margin * 2 - 8);
      ensureSpace(ll.length * 12);
      doc.text(ll, margin + 8, y);
      y += ll.length * 12;
    });
    doc.setTextColor(20);
    y += 10;
  });

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(`Versa · getversa.app · Page ${i}/${pageCount}`, margin, pageH - 20);
  }

  const safeQ = question.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  doc.save(`versa-research-${safeQ || 'brief'}.pdf`);
}
