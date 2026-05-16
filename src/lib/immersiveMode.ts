// Lightweight pub/sub for immersive mode — when active, AppHeader hides itself
// so a section (e.g. Live Debates) can take the full viewport TikTok-style.

const EVENT = 'versa:immersive-mode';

export function setImmersiveMode(active: boolean) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { active } }));
}

export function onImmersiveMode(cb: (active: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: Event) => cb((e as CustomEvent).detail?.active === true);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
