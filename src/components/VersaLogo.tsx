interface VersaLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
}

const sizeMap = {
  sm: {
    mark: 'h-6 w-6 text-base rounded-md',
    wordmark: 'text-sm',
  },
  md: {
    mark: 'h-8 w-8 text-lg rounded-lg',
    wordmark: 'text-lg',
  },
  lg: {
    mark: 'h-10 w-10 text-xl rounded-xl',
    wordmark: 'text-2xl',
  },
  xl: {
    mark: 'h-14 w-14 text-3xl rounded-xl',
    wordmark: 'text-4xl',
  },
  hero: {
    mark: 'h-16 w-16 text-4xl rounded-2xl',
    wordmark: 'text-5xl',
  },
} as const;

export default function VersaLogo({ className = '', size = 'md' }: VersaLogoProps) {
  const sizes = sizeMap[size];

  return (
    <div
      className={`inline-flex items-center gap-2.5 ${className}`}
      role="img"
      aria-label="GetVersa"
    >
      <div
        className={`inline-flex items-center justify-center border border-border/70 bg-gradient-to-b from-card via-secondary/60 to-secondary shadow-card ${sizes.mark}`}
      >
        <span className="bg-gradient-to-b from-foreground via-foreground/80 to-muted-foreground bg-clip-text font-display font-black leading-none text-transparent">
          V
        </span>
      </div>
      <span className={`font-display font-bold leading-none text-foreground ${sizes.wordmark}`}>
        <span>G</span>
        <span className="font-medium text-muted-foreground">et</span>
        <span>V</span>
        <span className="font-medium text-muted-foreground">ersa</span>
      </span>
    </div>
  );
}
