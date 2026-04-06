import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import SplashScreen, { isSplashSeen, markSplashSeen } from "@/components/SplashScreen";
import SwipeOverlay, { isSwipeOverlayDone, markSwipeOverlayDone } from "@/components/onboarding/SwipeOverlay";
import { AnimatePresence } from "framer-motion";

import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Home from "./pages/Home";

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
import Browse from "./pages/Browse";
import LiveDebate from "./pages/LiveDebate";
import SeasonalHub from "./pages/SeasonalHub";
import NotFound from "./pages/NotFound";
import TasteProfile from "./pages/TasteProfile";
import WeeklyTopResults from "./pages/WeeklyTopResults";
import { isWelcomeDone, markWelcomeDone } from "./components/onboarding/WelcomeFlow";

const queryClient = new QueryClient();

// Smart landing: first-time visitors see Splash → Onboarding → Auth, returning users go to /home
function SmartLanding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<'splash' | 'onboarding' | 'done'>('done');

  useEffect(() => {
    // If user is logged in or has completed onboarding before, go home
    if (user || isSwipeOverlayDone()) return;

    // First-time visitor
    if (!isSplashSeen()) {
      setPhase('splash');
      // Show splash for 1.5s then transition to onboarding
      const timer = setTimeout(() => {
        markSplashSeen();
        setPhase('onboarding');
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      // Splash seen but overlay not done — show onboarding
      setPhase('onboarding');
    }
  }, [user]);

  // Logged in or returning user
  if (user || isSwipeOverlayDone()) {
    return <Navigate to="/home" replace />;
  }

  return (
    <AnimatePresence mode="wait">
      {phase === 'splash' && (
        <SplashScreen key="splash" />
      )}
      {phase === 'onboarding' && (
        <SwipeOverlay
          key="onboarding"
          onDismiss={() => {
            markSwipeOverlayDone();
            markWelcomeDone();
            navigate('/auth?mode=signup', { replace: true });
          }}
        />
      )}
    </AnimatePresence>
  );
}

// DemographicsGuard — no longer redirects to onboarding since signup collects all fields.
// Kept as a pass-through wrapper for backward compatibility.
function DemographicsGuard({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function AppInner() {
  const { loading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // For returning users, show a brief loading state while auth resolves
    const minTimer = setTimeout(() => {
      if (!loading) setShowSplash(false);
    }, 400);
    return () => clearTimeout(minTimer);
  }, [loading]);

  useEffect(() => {
    if (!loading && showSplash) {
      const t = setTimeout(() => setShowSplash(false), 200);
      return () => clearTimeout(t);
    }
  }, [loading, showSplash]);

  if (showSplash) {
    // Minimal loading indicator for returning users (not the full splash)
    return (
      <div className="fixed inset-0 z-[200] bg-background flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Toaster />
      <Sonner />
      
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SmartLanding />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/onboarding" element={<ProtectedRoute requireOnboarding={false}><Onboarding /></ProtectedRoute>} />
          <Route path="/vote" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<DemographicsGuard><Home /></DemographicsGuard>} />
          <Route path="/explore" element={<DemographicsGuard><Explore /></DemographicsGuard>} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/live-debate" element={<DemographicsGuard><LiveDebate /></DemographicsGuard>} />
          <Route path="/seasonal/:slug" element={<SeasonalHub />} />
          <Route path="/history" element={<ProtectedRoute><PollHistory /></ProtectedRoute>} />
          <Route path="/archive" element={<PastPerspectives />} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/profile/edit" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
          <Route path="/profile/notifications" element={<ProtectedRoute><ProfileNotifications /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
          <Route path="/insights" element={<ProtectedRoute><InsightProfile /></ProtectedRoute>} />
          <Route path="/taste-profile" element={<ProtectedRoute><TasteProfile /></ProtectedRoute>} />
          <Route path="/weekly-results" element={<WeeklyTopResults />} />
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
