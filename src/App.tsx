import { useState, useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import SplashScreen, { isSplashSeen, markSplashSeen } from "@/components/SplashScreen";
import SwipeOverlay, { isSwipeOverlayDone, markSwipeOverlayDone } from "@/components/onboarding/SwipeOverlay";
import { AnimatePresence } from "framer-motion";

// Eagerly loaded — landing + most-visited routes
const Home = lazy(() => import("./pages/Home"));
import Auth from "./pages/Auth";
import CookieConsent from "./components/CookieConsent";

// Lazy-loaded — keep these out of the initial bundle
const Onboarding = lazy(() => import("./pages/Onboarding"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const Terms = lazy(() => import("./pages/Terms"));
const PollHistory = lazy(() => import("./pages/PollHistory"));
const PastPerspectives = lazy(() => import("./pages/PastPerspectives"));
const Profile = lazy(() => import("./pages/Profile"));
const EditProfile = lazy(() => import("./pages/EditProfile"));
const ProfileNotifications = lazy(() => import("./pages/ProfileNotifications"));
const Notifications = lazy(() => import("./pages/Notifications"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const Privacy = lazy(() => import("./pages/Privacy"));
const InsightProfile = lazy(() => import("./pages/InsightProfile"));
const Explore = lazy(() => import("./pages/Explore"));
const Browse = lazy(() => import("./pages/Browse"));
const LiveDebate = lazy(() => import("./pages/LiveDebate"));
const SeasonalHub = lazy(() => import("./pages/SeasonalHub"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TasteProfile = lazy(() => import("./pages/TasteProfile"));
const WeeklyTopResults = lazy(() => import("./pages/WeeklyTopResults"));
const JoinOrganization = lazy(() => import("./pages/JoinOrganization"));
const Friends = lazy(() => import("./pages/Friends"));
const FriendComparison = lazy(() => import("./pages/FriendComparison"));
const SharedPoll = lazy(() => import("./pages/SharedPoll"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const Compare = lazy(() => import("./pages/Compare"));
const CompareUser = lazy(() => import("./pages/CompareUser"));
const GroupCompare = lazy(() => import("./pages/GroupCompare"));
const PersonalityResults = lazy(() => import("./pages/PersonalityResults"));
const BrandPortal = lazy(() => import("./pages/BrandPortal"));
const Messages = lazy(() => import("./pages/Messages"));
const ChatThread = lazy(() => import("./pages/ChatThread"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const Play = lazy(() => import("./pages/Play"));
const PlayPredict = lazy(() => import("./pages/PlayPredict"));
const PlayDuels = lazy(() => import("./pages/PlayDuels"));
const PlayDuel = lazy(() => import("./pages/PlayDuel"));
const BrandCampaign = lazy(() => import("./pages/BrandCampaign"));
const BrandClientPortal = lazy(() => import("./pages/BrandClientPortal"));
const FocusGroup = lazy(() => import("./pages/FocusGroup"));
const Rewards = lazy(() => import("./pages/Rewards"));
const Ask = lazy(() => import("./pages/Ask"));
const Support = lazy(() => import("./pages/Support"));

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

// DemographicsGuard — forces OAuth users to complete demographics before using the app
import CompleteDemographicsModal from "@/components/onboarding/CompleteDemographicsModal";
function DemographicsGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  if (loading || !user || !profile) return <>{children}</>;
  const incomplete = !profile.age_range || !profile.gender || !profile.city;
  if (incomplete) return <CompleteDemographicsModal />;
  return <>{children}</>;
}

// Lightweight fallback shown while a lazy route chunk loads
function RouteFallback() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
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
        <Suspense fallback={<RouteFallback />}>
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
            <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
            <Route path="/rewards" element={<ProtectedRoute><Rewards /></ProtectedRoute>} />
            <Route path="/ask" element={<Ask />} />
            <Route path="/play" element={<Play />} />
            <Route path="/play/predict" element={<ProtectedRoute><PlayPredict /></ProtectedRoute>} />
            <Route path="/play/duels" element={<ProtectedRoute><PlayDuels /></ProtectedRoute>} />
            <Route path="/play/duels/:id" element={<ProtectedRoute><PlayDuel /></ProtectedRoute>} />
            <Route path="/friends/:friendId" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
            <Route path="/friends/:friendId/compare" element={<ProtectedRoute><FriendComparison /></ProtectedRoute>} />
            <Route path="/compare" element={<ProtectedRoute><Compare /></ProtectedRoute>} />
            <Route path="/compare/u/:userId" element={<CompareUser />} />
            <Route path="/compare/group" element={<ProtectedRoute><GroupCompare /></ProtectedRoute>} />
            <Route path="/brands" element={<ProtectedRoute><BrandPortal /></ProtectedRoute>} />
            <Route path="/brand/portal" element={<ProtectedRoute><BrandClientPortal /></ProtectedRoute>} />
            <Route path="/campaign/:id" element={<BrandCampaign />}/>
            <Route path="/focus-group/:id" element={<ProtectedRoute><FocusGroup /></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
            <Route path="/messages/:conversationId" element={<ProtectedRoute><ChatThread /></ProtectedRoute>} />
            <Route path="/user/:userId" element={<UserProfile />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/support" element={<Support />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <AppInner />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
