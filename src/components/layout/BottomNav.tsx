import { forwardRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, User, LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const BottomNav = forwardRef<HTMLElement, object>(function BottomNav(_, ref) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!user) {
    return (
      <nav ref={ref} className="fixed bottom-0 left-0 right-0 bg-nav border-t border-border/40 safe-area-bottom z-50">
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
          <NavButton path="/" icon={Home} label="Vote" active={location.pathname === '/' || location.pathname === '/vote'} onClick={() => navigate('/')} />
          <NavButton path="/auth" icon={LogIn} label="Sign In" active={location.pathname === '/auth'} onClick={() => navigate('/auth')} />
        </div>
      </nav>
    );
  }

  return (
    <nav ref={ref} className="fixed bottom-0 left-0 right-0 bg-nav border-t border-border/40 safe-area-bottom z-50">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {/* Home */}
        <NavButton
          path="/home"
          icon={Home}
          label="Home"
          active={location.pathname === '/home'}
          onClick={() => navigate('/home')}
        />

        {/* Vote - center, highlighted */}
        <button
          onClick={() => navigate('/')}
          className="flex flex-col items-center gap-0.5 -mt-5"
        >
          <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
              location.pathname === '/' || location.pathname === '/vote'
                ? 'bg-primary shadow-[0_0_18px_hsl(var(--primary)/0.35)]'
                : 'bg-primary/90 hover:bg-primary shadow-[0_0_14px_hsl(var(--primary)/0.25)]'
            }`}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary-foreground">
                <path d="M3 12h4l3 9 4-18 3 9h4" />
              </svg>
            </div>
          <span className={`text-[10px] font-semibold ${
            location.pathname === '/' || location.pathname === '/vote' ? 'text-primary' : 'text-card-foreground/70'
          }`}>Vote</span>
        </button>

        {/* Profile */}
        <NavButton
          path="/profile"
          icon={User}
          label="Profile"
          active={location.pathname === '/profile' || location.pathname.startsWith('/profile/')}
          onClick={() => navigate('/profile')}
        />
      </div>
    </nav>
  );
});

function NavButton({ icon: Icon, label, active, onClick }: {
  path: string;
  icon: any;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-3 py-2 transition-all ${
        active ? 'text-primary' : 'text-card-foreground/70 hover:text-card-foreground'
      }`}
    >
      <Icon className={`h-5 w-5 ${active ? 'scale-110' : ''} transition-transform`} />
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

export default BottomNav;
