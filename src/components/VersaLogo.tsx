import versaLogoImg from '@/assets/versa-logo.png';

interface VersaLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function VersaLogo({ className = '', size = 'md' }: VersaLogoProps) {
  const sizeClasses = {
    sm: 'h-5',
    md: 'h-7',
    lg: 'h-10',
    xl: 'h-12',
  };

  return (
    <div
      className={`${sizeClasses[size]} aspect-[3/1] bg-primary ${className}`}
      style={{
        WebkitMaskImage: `url(${versaLogoImg})`,
        maskImage: `url(${versaLogoImg})`,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
      role="img"
      aria-label="Versa"
    />
  );
}
