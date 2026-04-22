import wordmark from '@/assets/versa-wordmark.png';

interface VersaLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
}

const sizeMap = {
  sm: 'h-5',
  md: 'h-6',
  lg: 'h-8',
  xl: 'h-10',
  hero: 'h-12',
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
