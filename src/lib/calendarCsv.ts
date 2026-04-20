// CSV import/export utilities for the Poll Calendar
export interface CalendarCsvRow {
  release_date: string;
  category?: string;
  question: string;
  option_a: string;
  option_b: string;
  why_viral?: string;
  source?: string;
  image_a_url?: string;
  image_b_url?: string;
  target_country?: string;
  target_age_range?: string;
  target_gender?: string;
}

export const CSV_HEADERS = [
  'release_date',
  'category',
  'question',
  'option_a',
  'option_b',
  'why_viral',
  'source',
  'image_a_url',
  'image_b_url',
  'target_country',
  'target_age_range',
  'target_gender',
];

export const CSV_TEMPLATE = [
  CSV_HEADERS.join(','),
  '2026-04-21,Financial Services,Do you trust mobile wallets as much as cash?,Yes — fully,No — cash is safer,Instapay fee launch sparked debate,Instapay news,,,Egypt,,',
  '2026-04-22,FMCG & Food,Have you switched to a cheaper food brand?,Yes — I changed brands,No — I kept my usual,Food inflation is the daily pain point,CAPMAS data,,,Egypt,,',
].join('\n');

export function downloadCsvTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'poll-calendar-template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Tiny CSV parser supporting quoted fields and escaped quotes
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else cur += ch;
    } else {
      if (ch === ',') { out.push(cur); cur = ''; }
      else if (ch === '"') { inQuotes = true; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function parseCalendarCsv(text: string): { rows: CalendarCsvRow[]; errors: string[] } {
  const errors: string[] = [];
  const rows: CalendarCsvRow[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows, errors: ['Empty file'] };

  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = (k: string) => header.indexOf(k);

  const required = ['release_date', 'question', 'option_a', 'option_b'];
  for (const r of required) {
    if (idx(r) === -1) errors.push(`Missing required column: ${r}`);
  }
  if (errors.length > 0) return { rows, errors };

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const get = (k: string) => {
      const j = idx(k);
      return j >= 0 ? (cols[j] ?? '').trim() : '';
    };

    const release_date = get('release_date');
    const question = get('question');
    const option_a = get('option_a');
    const option_b = get('option_b');

    if (!release_date || !question || !option_a || !option_b) {
      errors.push(`Row ${i + 1}: missing required field`);
      continue;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(release_date)) {
      errors.push(`Row ${i + 1}: release_date must be YYYY-MM-DD`);
      continue;
    }

    rows.push({
      release_date,
      category: get('category') || undefined,
      question,
      option_a,
      option_b,
      why_viral: get('why_viral') || undefined,
      source: get('source') || undefined,
      image_a_url: get('image_a_url') || undefined,
      image_b_url: get('image_b_url') || undefined,
      target_country: get('target_country') || 'Egypt',
      target_age_range: get('target_age_range') || undefined,
      target_gender: get('target_gender') || undefined,
    });
  }

  return { rows, errors };
}
