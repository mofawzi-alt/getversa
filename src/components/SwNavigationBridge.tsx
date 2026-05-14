import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Listens for NAVIGATE messages from the service worker (push notification clicks)
 * and routes via React Router. This is essential on iOS PWAs where
 * client.navigate() is unreliable.
 */
export default function SwNavigationBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    const navigateTo = (url: string) => {
      if (!url.startsWith("/")) return;
      navigate(url);
    };

    try {
      const pending = localStorage.getItem("versa_pending_notification_route");
      if (pending) {
        localStorage.removeItem("versa_pending_notification_route");
        navigateTo(pending);
      }
    } catch {}

    const nativeHandler = (event: Event) => {
      const detail = (event as CustomEvent<{ url?: string }>).detail;
      if (typeof detail?.url === "string") navigateTo(detail.url);
    };
    window.addEventListener("versa:navigate", nativeHandler);

    if (!("serviceWorker" in navigator)) {
      return () => window.removeEventListener("versa:navigate", nativeHandler);
    }

    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (data && data.type === "NAVIGATE" && typeof data.url === "string") {
        navigateTo(data.url);
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => {
      window.removeEventListener("versa:navigate", nativeHandler);
      navigator.serviceWorker.removeEventListener("message", handler);
    };
  }, [navigate]);
  return null;
}
