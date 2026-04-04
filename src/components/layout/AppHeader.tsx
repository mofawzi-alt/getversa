import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Shield } from 'lucide-react';
import VersaLogo from '@/components/VersaLogo';

export default function AppHeader() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  return (
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
        <div className="flex items-center gap-2">
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
  );
}
