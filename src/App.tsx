import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import SplashScreen, { isSplashSeen, markSplashSeen } from "@/components/SplashScreen";
import SwipeOverlay, { isSwipeOverlayDone, markSwipeOverlayDone } from "@/components/onboarding/SwipeOverlay";
import { AnimatePresence } from "framer-motion";

import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Home from "./pages/Home";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Terms from "./pages/Terms";
import CookieConsent from "./components/CookieConsent";

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
import JoinOrganization from "./pages/JoinOrganization";
import Friends from "./pages/Friends";
import FriendComparison from "./pages/FriendComparison";
import SharedPoll from "./pages/SharedPoll";
import UserProfile from "./pages/UserProfile";
import Compare from "./pages/Compare";
import CompareUser from "./pages/CompareUser";
import PersonalityResults from "./pages/PersonalityResults";
import BrandPortal from "./pages/BrandPortal";
 import { isWelcomeDone, markWelcomeDone } from "./components/onboarding/WelcomeFlow";

const queryClient = new QueryClient();

// Smart landing: Splash → Swipe Overlay → Home (vote on real polls)
type LandingPhase = 'splash' | 'onboarding' | 'done';

function SmartLanding() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<LandingPhase>('done');

  useEffect(() => {
    if (user) return;

    if (!isSplashSeen()) {
      setPhase('splash');
      const timer = setTimeout(() => {
        markSplashSeen();
        if (isSwipeOverlayDone()) {
          setPhase('done');
        } else {
          setPhase('onboarding');
        }
      }, 1500);
      return () => clearTimeout(timer);
    } else if (!isSwipeOverlayDone()) {
      setPhase('onboarding');
    } else {
      setPhase('done');
    }
  }, [user]);

  if (user || phase === 'done') {
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
            setPhase('done');
          }}
        />
      )}
    </AnimatePresence>
  );
}

// DemographicsGuard — pass-through
function DemographicsGuard({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function AppInner() {
  const { loading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
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
      <CookieConsent />
      
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SmartLanding />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/onboarding" element={<ProtectedRoute requireOnboarding={false}><Onboarding /></ProtectedRoute>} />
          <Route path="/vote" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<DemographicsGuard><Home /></DemographicsGuard>} />
          <Route path="/explore" element={<DemographicsGuard><Explore /></DemographicsGuard>} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/poll/:id" element={<SharedPoll />} />
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
          <Route path="/personality" element={<ProtectedRoute><PersonalityResults /></ProtectedRoute>} />
          <Route path="/weekly-results" element={<WeeklyTopResults />} />
          <Route path="/friends" element={<ProtectedRoute><Friends /></ProtectedRoute>} />
          <Route path="/friends/:friendId" element={<ProtectedRoute><FriendComparison /></ProtectedRoute>} />
          <Route path="/compare" element={<ProtectedRoute><Compare /></ProtectedRoute>} />
          <Route path="/compare/u/:userId" element={<CompareUser />} />
          <Route path="/brands" element={<ProtectedRoute><BrandPortal /></ProtectedRoute>} />
          <Route path="/user/:userId" element={<UserProfile />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<Terms />} />
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
