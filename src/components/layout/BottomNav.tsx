import { forwardRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, User, LogIn, Compass, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFriendsBadge } from '@/hooks/useFriendsBadge';

const BottomNav = forwardRef<HTMLElement, object>(function BottomNav(_, ref) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const friendsBadge = useFriendsBadge();

  // While auth is loading, show the full authenticated nav to prevent flash
  if (!user && !loading) {
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
          path="/friends"
          icon={Users}
          label="Friends"
          active={location.pathname === '/friends' || location.pathname.startsWith('/friends/')}
          onClick={() => navigate('/friends')}
          badge={friendsBadge}
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

function NavButton({ icon: Icon, label, active, onClick, badge }: {
  path: string;
  icon: any;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center gap-1 px-3 py-2 transition-all ${
        active ? 'text-primary' : 'text-card-foreground/70 hover:text-card-foreground'
      }`}
    >
      <div className="relative">
        <Icon className={`h-5 w-5 ${active ? 'scale-110' : ''} transition-transform`} />
        {badge && badge > 0 ? (
          <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center leading-none ring-2 ring-nav">
            {badge > 9 ? '9+' : badge}
          </span>
        ) : null}
      </div>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

export default BottomNav;
