import versaLogoImg from '@/assets/versa-logo.png';

interface VersaLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function VersaLogo({ className = '', size = 'md' }: VersaLogoProps) {
  const sizeClasses = {
    sm: 'h-5',
    md: 'h-7',
    lg: 'h-10',
  };

  return (
    <img
      src={versaLogoImg}
      alt="Versa"
      className={`${sizeClasses[size]} w-auto object-contain brightness-0 text-primary [filter:brightness(0)_saturate(100%)_invert(29%)_sepia(98%)_saturate(1752%)_hue-rotate(216deg)_brightness(96%)_contrast(91%)] ${className}`}
    />
  );
}
