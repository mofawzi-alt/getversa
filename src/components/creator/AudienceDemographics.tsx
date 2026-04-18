import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Users, Globe, Calendar, TrendingUp } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const GENDER_COLORS: Record<string, string> = {
  'Male': 'hsl(210, 80%, 55%)',
  'Female': 'hsl(340, 75%, 55%)',
  'Unknown': 'hsl(var(--muted-foreground))',
};

interface DemographicData {
  gender: { name: string; value: number; percentage: number }[];
  ageRange: { name: string; value: number; percentage: number }[];
  country: { name: string; value: number; percentage: number }[];
  totalVoters: number;
}

export default function AudienceDemographics() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['creator-audience-demographics', user?.id],
    queryFn: async (): Promise<DemographicData> => {
      if (!user) throw new Error('Not authenticated');

      // Get all polls by this creator
      const { data: polls } = await supabase
        .from('polls')
        .select('id')
        .eq('created_by', user.id);

      if (!polls || polls.length === 0) {
        return { gender: [], ageRange: [], country: [], totalVoters: 0 };
      }

      const pollIds = polls.map(p => p.id);

      // Get all unique voters on creator's polls with demographics
      const { data: votes } = await supabase
        .from('votes')
        .select(`
          user_id,
          users!inner(gender, age_range, country)
        `)
        .in('poll_id', pollIds);

      if (!votes || votes.length === 0) {
        return { gender: [], ageRange: [], country: [], totalVoters: 0 };
      }

      // Get unique voters (only those with full demographic data)
      const uniqueVoters = new Map<string, { gender: string | null; age_range: string | null; country: string | null }>();
      votes.forEach(vote => {
        if (!uniqueVoters.has(vote.user_id)) {
          uniqueVoters.set(vote.user_id, {
            gender: (vote.users as any)?.gender || null,
            age_range: (vote.users as any)?.age_range || null,
            country: (vote.users as any)?.country || null,
          });
        }
      });

      const totalVoters = uniqueVoters.size;

      // Aggregate demographics — skip voters missing the field
      const genderCounts = new Map<string, number>();
      const ageCounts = new Map<string, number>();
      const countryCounts = new Map<string, number>();

      uniqueVoters.forEach(voter => {
        if (voter.gender) genderCounts.set(voter.gender, (genderCounts.get(voter.gender) || 0) + 1);
        if (voter.age_range) ageCounts.set(voter.age_range, (ageCounts.get(voter.age_range) || 0) + 1);
        if (voter.country) countryCounts.set(voter.country, (countryCounts.get(voter.country) || 0) + 1);
      });

      const toArray = (map: Map<string, number>) => {
        const total = Array.from(map.values()).reduce((s, n) => s + n, 0);
        if (total === 0) return [];
        return Array.from(map.entries())
          .map(([name, value]) => ({
            name,
            value,
            percentage: Math.round((value / total) * 100),
          }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10);
      };

      return {
        gender: toArray(genderCounts),
        ageRange: toArray(ageCounts),
        country: toArray(countryCounts),
        totalVoters,
      };
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data || data.totalVoters === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No audience data yet. Create polls to start gathering insights.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card className="bg-gradient-to-br from-primary/10 via-background to-accent/10 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-full bg-primary/20">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="text-4xl font-bold">{data.totalVoters.toLocaleString()}</p>
              <p className="text-muted-foreground">Unique Voters</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Gender Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Gender Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.gender}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={(props: any) => `${props.name}: ${props.percentage}%`}
                    labelLine={false}
                  >
                    {data.gender.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={GENDER_COLORS[entry.name] || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [value, 'Voters']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-4 mt-2">
              {data.gender.map((item, index) => (
                <div key={item.name} className="flex items-center gap-2 text-sm">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: GENDER_COLORS[item.name] || COLORS[index % COLORS.length] }}
                  />
                  <span>{item.name}</span>
                  <span className="text-muted-foreground">({item.percentage}%)</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Age Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Age Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.ageRange} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={60}
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip 
                    formatter={(value: number, _, props) => [
                      `${value} voters (${props.payload.percentage}%)`,
                      'Count'
                    ]}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar 
                    dataKey="value" 
                    fill="hsl(var(--primary))" 
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Country Distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Geographic Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.country}>
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip 
                  formatter={(value: number, _, props) => [
                    `${value} voters (${props.payload.percentage}%)`,
                    'Count'
                  ]}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar 
                  dataKey="value" 
                  fill="hsl(var(--accent))" 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
