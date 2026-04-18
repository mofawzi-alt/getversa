import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, Clock, Search, Sparkles } from 'lucide-react';
import VersaLogo from '@/components/VersaLogo';
import GlobalPollSearch from '@/components/search/GlobalPollSearch';

export default function AppHeader() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 bg-background/80 backdrop-blur-lg border-b border-border/40 z-50 safe-area-top">
        <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
          {/* Logo */}
          <button 
            onClick={() => navigate(user ? '/home' : '/')}
            className="flex items-center gap-2"
          >
            <VersaLogo size="sm" />
          </button>

          {/* Right side actions */}
          <div className="flex items-center gap-1">
            {user && (
              <button
                onClick={() => navigate('/ask')}
                className="p-2 rounded-lg text-foreground hover:text-primary hover:bg-primary/10 transition-all"
                aria-label="Ask Versa"
              >
                <Sparkles className="h-5 w-5" />
              </button>
            )}
            {user && (
              <button
                onClick={() => setSearchOpen(true)}
                className="p-2 rounded-lg text-foreground hover:text-primary hover:bg-primary/10 transition-all"
                aria-label="Search polls"
              >
                <Search className="h-5 w-5" />
              </button>
            )}
            {user && (
              <button
                onClick={() => navigate('/history')}
                className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-all"
                aria-label="My Votes"
              >
                <Clock className="h-5 w-5" />
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className="p-2 rounded-lg text-foreground hover:text-primary hover:bg-primary/10 transition-all"
              >
                <Shield className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </header>
      <GlobalPollSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
