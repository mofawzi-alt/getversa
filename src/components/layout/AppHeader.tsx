import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Shield } from 'lucide-react';
import versaLogo from '@/assets/versa-logo-icon.png';

export default function AppHeader() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  if (!user) return null;

  return (
    <header className="fixed top-0 left-0 right-0 bg-background/80 backdrop-blur-lg border-b border-border/40 z-50 safe-area-top">
      <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
        {/* Logo/Title */}
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-2"
        >
          <img 
            src={versaLogo} 
            alt="Versa" 
            className="w-8 h-8 min-w-[32px] min-h-[32px] rounded-lg object-contain"
          />
          <span className="font-display font-bold text-xl text-primary">Versa</span>
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
