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
      className={`${sizeClasses[size]} w-auto object-contain [filter:brightness(0)_saturate(100%)_invert(22%)_sepia(93%)_saturate(2000%)_hue-rotate(216deg)_brightness(90%)_contrast(95%)] dark:[filter:brightness(0)_saturate(100%)_invert(55%)_sepia(80%)_saturate(1500%)_hue-rotate(196deg)_brightness(100%)_contrast(90%)] ${className}`}
    />
  );
}
