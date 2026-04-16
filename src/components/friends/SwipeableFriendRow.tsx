import { useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, animate, PanInfo } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Props {
  children: React.ReactNode;
  onDelete: () => void;
  friendName: string;
}

const REVEAL_WIDTH = 88;
const LONG_PRESS_MS = 550;

export default function SwipeableFriendRow({ children, onDelete, friendName }: Props) {
  const x = useMotionValue(0);
  const deleteOpacity = useTransform(x, [-REVEAL_WIDTH, -20, 0], [1, 0.4, 0]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x < -REVEAL_WIDTH / 2 || info.velocity.x < -300) {
      animate(x, -REVEAL_WIDTH, { type: 'spring', stiffness: 400, damping: 35 });
    } else {
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 35 });
    }
  };

  const startLongPress = () => {
    longPressTriggered.current = false;
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      if (navigator.vibrate) navigator.vibrate(40);
      setConfirmOpen(true);
    }, LONG_PRESS_MS);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <>
      <div className="relative overflow-hidden rounded-xl">
        {/* Delete action revealed behind row */}
        <motion.div
          style={{ opacity: deleteOpacity }}
          className="absolute inset-y-0 right-0 flex items-center justify-center bg-destructive text-destructive-foreground"
          onClick={() => {
            animate(x, 0, { type: 'spring', stiffness: 400, damping: 35 });
            setConfirmOpen(true);
          }}
        >
          <button
            className="h-full px-5 flex flex-col items-center justify-center gap-1"
            aria-label={`Delete ${friendName}`}
          >
            <Trash2 className="h-5 w-5" />
            <span className="text-[10px] font-bold">Delete</span>
          </button>
        </motion.div>

        {/* Swipeable foreground */}
        <motion.div
          style={{ x }}
          drag="x"
          dragConstraints={{ left: -REVEAL_WIDTH, right: 0 }}
          dragElastic={0.15}
          onDragEnd={handleDragEnd}
          onPointerDown={startLongPress}
          onPointerUp={cancelLongPress}
          onPointerCancel={cancelLongPress}
          onPointerLeave={cancelLongPress}
          onClickCapture={(e) => {
            if (longPressTriggered.current) {
              e.stopPropagation();
              e.preventDefault();
              longPressTriggered.current = false;
            }
          }}
          className="relative bg-background"
        >
          {children}
        </motion.div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {friendName}?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll no longer see their votes or be able to compare with them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete();
                setConfirmOpen(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
