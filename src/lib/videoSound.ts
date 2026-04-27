/**
 * Global controller ensuring only ONE poll video plays with sound at a time.
 * When a video unmutes, all others auto-mute.
 */
type Listener = (activeId: string | null) => void;

let activeId: string | null = null;
const listeners = new Set<Listener>();

export const videoSound = {
  getActive: () => activeId,
  setActive: (id: string | null) => {
    activeId = id;
    listeners.forEach((l) => l(activeId));
  },
  subscribe: (fn: Listener) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
