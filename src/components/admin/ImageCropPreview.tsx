import { AspectRatio } from '@/components/ui/aspect-ratio';

interface ImageCropPreviewProps {
  src: string;
  label: string;
}

/**
 * Shows how a poll image will appear across Hero (3:4), Browse (4:3), and History views.
 */
export default function ImageCropPreview({ src, label }: ImageCropPreviewProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{label} — Preview</p>
      <div className="grid grid-cols-3 gap-2">
        {/* Hero: 3:4 portrait */}
        <div>
          <p className="text-[10px] text-muted-foreground mb-1 text-center">Hero 3:4</p>
          <AspectRatio ratio={3 / 4} className="overflow-hidden rounded-md border border-border bg-muted">
            <img
              src={src}
              alt={`${label} hero preview`}
              className="w-full h-full object-cover object-center"
            />
          </AspectRatio>
        </div>
        {/* Browse: 4:3 landscape */}
        <div>
          <p className="text-[10px] text-muted-foreground mb-1 text-center">Browse 4:3</p>
          <AspectRatio ratio={4 / 3} className="overflow-hidden rounded-md border border-border bg-muted">
            <img
              src={src}
              alt={`${label} browse preview`}
              className="w-full h-full object-cover object-top"
            />
          </AspectRatio>
        </div>
        {/* History: contain */}
        <div>
          <p className="text-[10px] text-muted-foreground mb-1 text-center">History</p>
          <AspectRatio ratio={1} className="overflow-hidden rounded-md border border-border" style={{ backgroundColor: '#111' }}>
            <img
              src={src}
              alt={`${label} history preview`}
              className="w-full h-full object-contain"
            />
          </AspectRatio>
        </div>
      </div>
    </div>
  );
}
