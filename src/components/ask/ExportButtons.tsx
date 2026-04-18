import { useState } from 'react';
import { Copy, FileDown, Check } from 'lucide-react';
import { toast } from 'sonner';
import { buildCopyText, downloadResearchPdf, type ResearchPayload } from '@/lib/askExport';

export default function ExportButtons({ payload }: { payload: ResearchPayload }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildCopyText(payload));
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Copy failed');
    }
  };

  const onPdf = () => {
    try {
      downloadResearchPdf(payload);
    } catch (e) {
      console.error(e);
      toast.error('PDF export failed');
    }
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        onClick={onCopy}
        className="h-10 rounded-full border border-border bg-card text-xs font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Copied' : 'Copy summary'}
      </button>
      <button
        onClick={onPdf}
        className="h-10 rounded-full bg-foreground text-background text-xs font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
      >
        <FileDown className="h-3.5 w-3.5" />
        Download PDF
      </button>
    </div>
  );
}
