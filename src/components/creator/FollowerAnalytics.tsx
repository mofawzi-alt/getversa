import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, TrendingUp, UserPlus } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function FollowerAnalytics() {
  const { user } = useAuth();

  const { data: followerData, isLoading } = useQuery({
    queryKey: ['creator-followers', user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Get followers
      const { data: follows, error } = await supabase
        .from('follows')
        .select('follower_id, created_at')
        .eq('following_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get follower demographics
      const followerIds = follows?.map(f => f.follower_id) || [];
      
      if (followerIds.length === 0) {
        return { 
          total: 0, 
          followers: [], 
          demographics: { gender: {}, age: {}, country: {} },
          growth: []
        };
      }

      const { data: users } = await supabase
        .from('users')
        .select('id, username, gender, age_range, country')
        .in('id', followerIds);

      // Aggregate demographics
      const demographics = {
        gender: {} as Record<string, number>,
        age: {} as Record<string, number>,
        country: {} as Record<string, number>,
      };

      users?.forEach(u => {
        if (u.gender) {
          demographics.gender[u.gender] = (demographics.gender[u.gender] || 0) + 1;
        }
        if (u.age_range) {
          demographics.age[u.age_range] = (demographics.age[u.age_range] || 0) + 1;
        }
        if (u.country) {
          demographics.country[u.country] = (demographics.country[u.country] || 0) + 1;
        }
      });

      // Calculate growth over time (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const growthMap: Record<string, number> = {};
      let cumulativeCount = follows?.filter(f => new Date(f.created_at) < thirtyDaysAgo).length || 0;

      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const newFollowers = follows?.filter(f => 
          f.created_at.startsWith(dateStr)
        ).length || 0;
        
        cumulativeCount += newFollowers;
        growthMap[dateStr] = cumulativeCount;
      }

      const growth = Object.entries(growthMap).map(([date, count]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        followers: count,
      }));

      return {
        total: follows?.length || 0,
        followers: users || [],
        demographics,
        growth,
      };
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!followerData || followerData.total === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg mb-2">No Followers Yet</h3>
          <p className="text-muted-foreground text-sm">
            Create engaging polls to attract followers who want to see your content
          </p>
        </CardContent>
      </Card>
    );
  }

  const genderData = Object.entries(followerData.demographics.gender).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  const ageData = Object.entries(followerData.demographics.age).map(([name, value]) => ({
    name,
    value,
  }));

  const countryData = Object.entries(followerData.demographics.country)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value]) => ({
      name,
      value,
    }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{followerData.total}</p>
                <p className="text-sm text-muted-foreground">Total Followers</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <UserPlus className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  +{followerData.growth.length > 1 
                    ? followerData.growth[followerData.growth.length - 1].followers - followerData.growth[0].followers
                    : 0}
                </p>
                <p className="text-sm text-muted-foreground">Last 30 Days</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Growth Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Follower Growth
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={followerData.growth}>
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="followers" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Demographics */}
      <div className="grid md:grid-cols-3 gap-4">
        {genderData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">By Gender</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={genderData} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={60} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {ageData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">By Age Range</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ageData} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={50} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {countryData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Top Countries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={countryData} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={60} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--chart-3))" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
