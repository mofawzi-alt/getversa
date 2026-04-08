import { detectBrand } from '@/lib/brandDetection';

interface BrandDisclaimerProps {
  optionA: string;
  optionB: string;
  question: string;
}

export default function BrandDisclaimer({ optionA, optionB, question }: BrandDisclaimerProps) {
  const hasBrand = detectBrand(optionA) || detectBrand(optionB) || detectBrand(question);
  if (!hasBrand) return null;

  return (
    <p className="text-[9px] text-muted-foreground/40 text-center mt-1 px-2 leading-tight">
      Brand names are property of their respective owners. Versa is independent and unaffiliated.
    </p>
  );
}
