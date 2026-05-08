/**
 * Shimmer skeleton that mirrors PollCard's exact layout.
 * Shows during initial feed load so there's never a blank screen.
 */
export default function PollCardSkeleton() {
  return (
    <div className="w-full max-w-[440px] mx-auto bg-card rounded-3xl shadow-lg border border-border/60 overflow-hidden animate-pulse">
      {/* Image area — same aspect ratio as PollCard */}
      <div className="relative grid grid-cols-2 gap-0 w-full aspect-[4/3] overflow-hidden">
        <div className="bg-muted" />
        <div className="bg-muted/80" />
        {/* Fake VS divider */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80" />
      </div>
      {/* Text area */}
      <div className="px-4 pt-3 pb-3 space-y-2">
        <div className="h-3 w-20 bg-muted rounded" />
        <div className="h-5 w-3/4 bg-muted rounded" />
        <div className="flex items-center gap-2 mt-2">
          <div className="h-3 w-16 bg-muted rounded" />
          <div className="h-5 w-14 bg-muted rounded-full" />
        </div>
      </div>
    </div>
  );
}
