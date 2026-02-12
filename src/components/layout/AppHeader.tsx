import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Trophy, Award, Crown, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import versaLogo from '@/assets/versa-logo-icon.png';

const menuItems = [
  { path: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
  { path: '/badges', icon: Award, label: 'Badges' },
  { path: '/creator', icon: Crown, label: 'Creator Dashboard' },
];

export default function AppHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!user) return null;

  const allMenuItems = isAdmin 
    ? [...menuItems, { path: '/admin', icon: Shield, label: 'Admin Panel' }]
    : menuItems;

  const handleNavigate = (path: string) => {
    navigate(path);
    setSheetOpen(false);
  };

  const isMenuItemActive = allMenuItems.some(item => location.pathname === item.path);

  return (
    <header className="fixed top-0 left-0 right-0 bg-background/80 backdrop-blur-lg border-b border-border/40 z-50 safe-area-top">
      <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
        {/* Hamburger Menu */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button
              className={`p-2 rounded-lg transition-all ${
                isMenuItemActive
                  ? 'text-primary bg-primary/10'
                  : 'text-foreground hover:text-primary hover:bg-primary/10'
              }`}
            >
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 bg-background border-border/40">
            <SheetHeader className="text-left pb-4 border-b border-border/40">
              <div className="flex items-center gap-3">
                <img src={versaLogo} alt="Versa" className="w-10 h-10 rounded-xl" />
                <SheetTitle className="text-foreground">Menu</SheetTitle>
              </div>
            </SheetHeader>
            <nav className="py-4 space-y-1">
              {allMenuItems.map(({ path, icon: Icon, label }) => {
                const isActive = location.pathname === path;
                
                return (
                  <button
                    key={path}
                    onClick={() => handleNavigate(path)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      isActive
                        ? 'text-primary bg-primary/10 font-medium'
                        : 'text-foreground/70 hover:text-foreground hover:bg-secondary/50'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>

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

        {/* Placeholder for symmetry */}
        <div className="w-9" />
      </div>
    </header>
  );
}
