import AppLayout from '@/components/layout/AppLayout';
import CaughtUpInsights from '@/components/feed/CaughtUpInsights';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col p-4 pb-24">
        {/* Header */}
        <header className="mb-4">
          <h1 className="text-2xl font-display font-bold text-gradient">VERSA</h1>
        </header>

        {/* Insights + Trending */}
        <CaughtUpInsights onRefresh={() => navigate('/vote')} />
      </div>
    </AppLayout>
  );
}
