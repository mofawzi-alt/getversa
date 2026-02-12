import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import SwipeFeed from "./pages/SwipeFeed";
import PollHistory from "./pages/PollHistory";
import Profile from "./pages/Profile";
import EditProfile from "./pages/EditProfile";
import ProfileNotifications from "./pages/ProfileNotifications";
import ProfileCustomize from "./pages/ProfileCustomize";
import Notifications from "./pages/Notifications";
import Rewards from "./pages/Rewards";
import AdminDashboard from "./pages/AdminDashboard";
import Leaderboard from "./pages/Leaderboard";
import Badges from "./pages/Badges";
import CreatorDashboard from "./pages/CreatorDashboard";
import Friends from "./pages/Friends";
import FriendComparison from "./pages/FriendComparison";
import Privacy from "./pages/Privacy";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<ProtectedRoute requireOnboarding={false}><Onboarding /></ProtectedRoute>} />
            <Route path="/" element={<ProtectedRoute><SwipeFeed /></ProtectedRoute>} />
            <Route path="/history" element={<ProtectedRoute><PollHistory /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/profile/edit" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
            <Route path="/profile/notifications" element={<ProtectedRoute><ProfileNotifications /></ProtectedRoute>} />
            <Route path="/profile/customize" element={<ProtectedRoute><ProfileCustomize /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/rewards" element={<ProtectedRoute><Rewards /></ProtectedRoute>} />
            <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
            <Route path="/badges" element={<ProtectedRoute><Badges /></ProtectedRoute>} />
            <Route path="/creator" element={<ProtectedRoute><CreatorDashboard /></ProtectedRoute>} />
            <Route path="/friends" element={<ProtectedRoute><Friends /></ProtectedRoute>} />
            <Route path="/friends/:friendId" element={<ProtectedRoute><FriendComparison /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;