interface VersaLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
}

const sizeMap = {
  sm: 'text-xl',
  md: 'text-2xl',
  lg: 'text-3xl',
  xl: 'text-4xl',
  hero: 'text-5xl',
} as const;

export default function VersaLogo({ className = '', size = 'md' }: VersaLogoProps) {
  return (
    <div
      className={`inline-flex items-center ${className}`}
      role="img"
      aria-label="Versa"
    >
      <span className={`font-display font-bold tracking-tight leading-none text-foreground ${sizeMap[size]}`}>
        Versa
      </span>
    </div>
  );
}
