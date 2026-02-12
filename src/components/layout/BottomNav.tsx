import { forwardRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Bell, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/notifications', icon: Bell, label: 'Alerts' },
  { path: '/profile', icon: User, label: 'Profile' },
];

const BottomNav = forwardRef<HTMLElement, object>(function BottomNav(_, ref) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Show minimal nav for guests (only Home)
  const visibleItems = user ? navItems : navItems.filter(item => item.path === '/');

  return (
    <nav ref={ref} className="fixed bottom-0 left-0 right-0 bg-nav border-t border-border/40 safe-area-bottom z-50">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {visibleItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path;
          
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center gap-1 px-3 py-2 transition-all ${
                isActive
                  ? 'text-primary'
                  : 'text-card-foreground/70 hover:text-card-foreground'
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
});

export default BottomNav;