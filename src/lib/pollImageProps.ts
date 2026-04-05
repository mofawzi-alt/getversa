import { shouldUseBrandTreatment, getBrandBgColor, shouldUseDarkText } from '@/lib/brandConfig';

interface PollImageRenderProps {
  imageUrl: string | null;
  option: string;
  question?: string;
  side: 'A' | 'B';
}

/**
 * Returns style props and className for a poll option image container + img.
 * 
 * Brand treatment: centered logo on brand-colored background with 20%+ padding
 * Photo treatment: full-bleed object-cover with center positioning
 * 
 * Use `containerStyle` on the wrapper div, and `imgClassName` on the <img>.
 */
export function getPollImageProps(props: PollImageRenderProps) {
  const { imageUrl, option } = props;
  const isBrand = shouldUseBrandTreatment(option, imageUrl);
  const bgColor = isBrand ? getBrandBgColor(option) : undefined;
  const darkText = isBrand ? shouldUseDarkText(option) : false;

  return {
    isBrand,
    bgColor,
    darkText,
    containerStyle: isBrand ? { backgroundColor: bgColor } as React.CSSProperties : {},
    containerClassName: isBrand ? 'flex items-center justify-center' : '',
    imgClassName: isBrand
      ? 'max-w-[60%] max-h-[60%] object-contain'
      : 'w-full h-full object-cover object-center',
    labelClassName: isBrand && darkText ? 'text-gray-900' : 'text-white',
  };
}
