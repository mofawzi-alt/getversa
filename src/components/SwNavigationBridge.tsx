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
    if (!("serviceWorker" in navigator)) return;
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (data && data.type === "NAVIGATE" && typeof data.url === "string") {
        navigate(data.url);
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [navigate]);
  return null;
}
