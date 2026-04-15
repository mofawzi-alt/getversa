import { forwardRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, User, LogIn, Compass, Clock, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const BottomNav = forwardRef<HTMLElement, object>(function BottomNav(_, ref) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!user) {
    return (
      <nav ref={ref} className="fixed bottom-0 left-0 right-0 bg-nav border-t border-border/40 safe-area-bottom z-50">
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
          <NavButton path="/" icon={Home} label="Home" active={location.pathname === '/' || location.pathname === '/home'} onClick={() => navigate('/')} />
          <NavButton path="/browse" icon={Compass} label="Browse" active={location.pathname === '/browse'} onClick={() => navigate('/browse')} />
          <NavButton path="/auth" icon={LogIn} label="Sign In" active={location.pathname === '/auth'} onClick={() => navigate('/auth')} />
        </div>
      </nav>
    );
  }

  return (
    <nav ref={ref} className="fixed bottom-0 left-0 right-0 bg-nav border-t border-border/40 safe-area-bottom z-50">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        <NavButton
          path="/home"
          icon={Home}
          label="Home"
          active={location.pathname === '/home'}
          onClick={() => navigate('/home')}
        />
        <NavButton
          path="/browse"
          icon={Compass}
          label="Browse"
          active={location.pathname === '/browse'}
          onClick={() => navigate('/browse')}
        />
        <NavButton
          path="/history"
          icon={Clock}
          label="History"
          active={location.pathname === '/history'}
          onClick={() => navigate('/history')}
        />
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
