import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import SplashScreen from "@/components/SplashScreen";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Home from "./pages/Home";
import SwipeFeed from "./pages/SwipeFeed";
import PollHistory from "./pages/PollHistory";
import PastPerspectives from "./pages/PastPerspectives";
import Profile from "./pages/Profile";
import EditProfile from "./pages/EditProfile";
import ProfileNotifications from "./pages/ProfileNotifications";
import Notifications from "./pages/Notifications";
import AdminDashboard from "./pages/AdminDashboard";
import Privacy from "./pages/Privacy";
import InsightProfile from "./pages/InsightProfile";
import Explore from "./pages/Explore";
import LiveDebate from "./pages/LiveDebate";
import SeasonalHub from "./pages/SeasonalHub";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Smart landing: everyone goes to voting first (zero friction)
function SmartLanding() {
  return <Navigate to="/home" replace />;
}

function AppInner() {
  const { loading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Show splash for minimum time, then wait for auth
    const minTimer = setTimeout(() => {
      if (!loading) setShowSplash(false);
    }, 1500);
    return () => clearTimeout(minTimer);
  }, [loading]);

  // Once loading finishes after min time, hide splash
  useEffect(() => {
    if (!loading && showSplash) {
      const t = setTimeout(() => setShowSplash(false), 300);
      return () => clearTimeout(t);
    }
  }, [loading, showSplash]);

  return (
    <>
      {showSplash && <SplashScreen />}
      <Toaster />
      <Sonner />
      <PWAInstallPrompt />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SmartLanding />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/onboarding" element={<ProtectedRoute requireOnboarding={false}><Onboarding /></ProtectedRoute>} />
          <Route path="/vote" element={<SwipeFeed />} />
          <Route path="/home" element={<Home />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/live-debate" element={<LiveDebate />} />
          <Route path="/seasonal/:slug" element={<SeasonalHub />} />
          <Route path="/history" element={<ProtectedRoute><PollHistory /></ProtectedRoute>} />
          <Route path="/archive" element={<PastPerspectives />} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/profile/edit" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
          <Route path="/profile/notifications" element={<ProtectedRoute><ProfileNotifications /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
          <Route path="/insights" element={<ProtectedRoute><InsightProfile /></ProtectedRoute>} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <AppInner />
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
