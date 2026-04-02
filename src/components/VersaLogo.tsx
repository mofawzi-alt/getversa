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
    <img
      src={versaLogoImg}
      alt="Versa"
      className={`${sizeClasses[size]} w-auto object-contain ${className}`}
    />
  );
}
