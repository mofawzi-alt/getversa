import wordmark from '@/assets/versa-wordmark.png';

interface VersaLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
}

const sizeMap = {
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-14',
  xl: 'h-16',
  hero: 'h-20',
} as const;

export default function VersaLogo({ className = '', size = 'md' }: VersaLogoProps) {
  return (
    <div
      className={`inline-flex items-center ${className}`}
      role="img"
      aria-label="Versa"
    >
      <img
        src={wordmark}
        alt="Versa"
        className={`${sizeMap[size]} w-auto select-none`}
        draggable={false}
      />
    </div>
  );
}
