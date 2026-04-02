import versaLogoImg from '@/assets/versa-logo.png';

interface VersaLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function VersaLogo({ className = '', size = 'md' }: VersaLogoProps) {
  const sizeMap = {
    sm: { height: 20, width: 60 },
    md: { height: 28, width: 84 },
    lg: { height: 40, width: 120 },
    xl: { height: 48, width: 144 },
  };

  const { height, width } = sizeMap[size];

  return (
    <div
      className={`bg-primary ${className}`}
      style={{
        height,
        width,
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
