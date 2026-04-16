import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Copy, QrCode, Share2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function ShareCompatibilityCard() {
  const { user, profile } = useAuth();
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!user) return null;

  const compareUrl = `${window.location.origin}/compare/u/${user.id}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(compareUrl);
      setCopied(true);
      toast.success('Link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Compare with @${profile?.username || 'me'} on Versa`,
          text: `See how compatible we are! 🤝`,
          url: compareUrl,
        });
      } catch {
        // User cancelled
      }
    } else {
      handleCopy();
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-4 space-y-3"
      >
        <div className="flex items-center gap-2">
          <Share2 className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Compatibility Link
          </span>
        </div>

        <p className="text-sm text-muted-foreground">
          Share your link to see how compatible you are with anyone
        </p>

        <div className="flex gap-2">
          <Button
            onClick={handleShare}
            className="flex-1 h-10 text-sm"
          >
            <Share2 className="h-4 w-4 mr-1.5" />
            Share Link
          </Button>
          <Button
            variant="outline"
            onClick={handleCopy}
            className="h-10 px-3"
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowQR(true)}
            className="h-10 px-3"
          >
            <QrCode className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>

      {/* QR Code Dialog */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="max-w-xs rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-center">Your Compatibility QR</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="p-4 bg-white rounded-2xl">
              <QRCodeSVG
                value={compareUrl}
                size={200}
                level="M"
                fgColor="#0a0a0a"
                bgColor="#ffffff"
                imageSettings={{
                  src: '',
                  height: 0,
                  width: 0,
                  excavate: false,
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Scan to compare compatibility with @{profile?.username || 'you'}
            </p>
            <Button onClick={handleCopy} variant="outline" size="sm" className="w-full">
              {copied ? <Check className="h-4 w-4 mr-1.5 text-green-500" /> : <Copy className="h-4 w-4 mr-1.5" />}
              {copied ? 'Copied!' : 'Copy Link'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
