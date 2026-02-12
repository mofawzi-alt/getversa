import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { z } from 'zod';
import versaLogo from '@/assets/versa-logo-icon.png';

const authSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = authSchema.safeParse({ email, password });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }
    
    setLoading(true);
    
    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast.error('Invalid email or password');
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('Welcome back!');
          navigate('/');
        }
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          if (error.message.includes('already registered')) {
            toast.error('This email is already registered. Please sign in instead.');
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('Account created! Welcome to VERSA!');
          navigate('/onboarding');
        }
      }
    } catch (err) {
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 safe-area-top safe-area-bottom bg-background relative overflow-hidden">
      {/* Decorative Background Rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {/* Outer ring */}
        <div className="absolute w-[600px] h-[600px] rounded-full border-[3px] border-primary/10 animate-pulse" />
        {/* Middle ring */}
        <div className="absolute w-[450px] h-[450px] rounded-full border-[4px] border-primary/15" 
          style={{ animation: 'pulse 3s ease-in-out infinite 0.5s' }} />
        {/* Inner ring */}
        <div className="absolute w-[300px] h-[300px] rounded-full border-[5px] border-accent/20"
          style={{ animation: 'pulse 3s ease-in-out infinite 1s' }} />
        {/* Core glow */}
        <div className="absolute w-[180px] h-[180px] rounded-full bg-gradient-to-br from-primary/10 to-accent/10 blur-2xl" />
      </div>

      {/* Floating accent orbs */}
      <div className="absolute top-20 left-10 w-3 h-3 rounded-full bg-accent/60 animate-float" />
      <div className="absolute top-40 right-16 w-2 h-2 rounded-full bg-primary/50" 
        style={{ animation: 'float 4s ease-in-out infinite 1s' }} />
      <div className="absolute bottom-32 left-20 w-4 h-4 rounded-full bg-primary/40 animate-float" />
      <div className="absolute bottom-48 right-12 w-2 h-2 rounded-full bg-accent/50"
        style={{ animation: 'float 3.5s ease-in-out infinite 0.5s' }} />

      <div className="w-full max-w-sm space-y-8 animate-slide-up relative z-10">
        {/* Logo with glow effect */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/30 blur-xl rounded-full scale-110" />
            <img 
              src={versaLogo} 
              alt="Versa Logo" 
              className="w-28 h-28 rounded-2xl animate-float relative z-10"
            />
          </div>
        </div>

        {/* Logo Text */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <h1 className="text-5xl font-display font-bold text-primary tracking-tight">versa</h1>
          </div>
          <p className="text-muted-foreground">Decision Infrastructure</p>
        </div>

        {/* Auth Form */}
        <div className="bg-card/80 backdrop-blur-lg rounded-2xl p-6 shadow-card border border-border/50 relative">
          {/* Subtle accent line at top */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-1 bg-gradient-to-r from-primary via-accent to-primary rounded-full -translate-y-1/2" />
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-card-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-secondary/80 border-border/50 text-card-foreground placeholder:text-muted-foreground focus:border-accent focus:ring-accent/30"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-card-foreground">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-secondary/80 border-border/50 pr-10 text-card-foreground placeholder:text-muted-foreground focus:border-accent focus:ring-accent/30"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-accent transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold h-12 rounded-full shadow-accent transition-all hover:scale-[1.02] hover:shadow-lg"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isLogin ? (
                'Sign In'
              ) : (
                'Create Account'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <span className="text-accent font-medium hover:underline">
                {isLogin ? 'Sign up' : 'Sign in'}
              </span>
            </button>
          </div>
        </div>

        {/* Features Preview with ring-inspired design */}
        <div className="grid grid-cols-3 gap-4 text-center text-sm">
          <div className="space-y-2 group">
            <div className="w-12 h-12 mx-auto rounded-full border-2 border-primary/30 flex items-center justify-center group-hover:border-primary/60 transition-colors">
              <span className="text-xl">🗳️</span>
            </div>
            <p className="text-muted-foreground group-hover:text-foreground transition-colors">Vote</p>
          </div>
          <div className="space-y-2 group">
            <div className="w-12 h-12 mx-auto rounded-full border-2 border-accent/30 flex items-center justify-center group-hover:border-accent/60 transition-colors">
              <span className="text-xl">🏆</span>
            </div>
            <p className="text-muted-foreground group-hover:text-foreground transition-colors">Compete</p>
          </div>
          <div className="space-y-2 group">
            <div className="w-12 h-12 mx-auto rounded-full border-2 border-primary/30 flex items-center justify-center group-hover:border-primary/60 transition-colors">
              <span className="text-xl">🎁</span>
            </div>
            <p className="text-muted-foreground group-hover:text-foreground transition-colors">Earn</p>
          </div>
        </div>
      </div>
    </div>
  );
}