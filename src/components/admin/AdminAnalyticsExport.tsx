import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AdminAnalyticsExport() {
  const [exporting, setExporting] = useState<string | null>(null);

  const exportPollsCSV = async () => {
    setExporting('polls');
    try {
      const { data: polls } = await supabase
        .from('polls')
        .select('*')
        .order('created_at', { ascending: false });

      if (!polls || polls.length === 0) {
        toast.error('No polls to export');
        setExporting(null);
        return;
      }

      const pollIds = polls.map(p => p.id);
      const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: pollIds });

      let csv = "Poll ID,Question,Option A,Option B,Category,Target Gender,Target Age,Target Country,Total Votes,Votes A,Votes B,Percent A,Percent B,Is Active,Is Daily,Created At,Ends At\n";
      
      polls.forEach(poll => {
        const result = results?.find(r => r.poll_id === poll.id);
        csv += `"${poll.id}","${poll.question}","${poll.option_a}","${poll.option_b}","${poll.category || ''}","${poll.target_gender || 'All'}","${poll.target_age_range || 'All'}","${poll.target_country || 'All'}","${result?.total_votes || 0}","${result?.votes_a || 0}","${result?.votes_b || 0}","${result?.percent_a || 0}%","${result?.percent_b || 0}%","${poll.is_active}","${poll.is_daily_poll}","${poll.created_at}","${poll.ends_at || ''}"\n`;
      });

      downloadCSV(csv, 'polls-export');
      toast.success('Polls exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export polls');
    } finally {
      setExporting(null);
    }
  };

  const exportVotesCSV = async () => {
    setExporting('votes');
    try {
      const { data: votes } = await supabase
        .from('votes')
        .select('*, users!inner(username, gender, age_range, country), polls!inner(question)')
        .order('created_at', { ascending: false })
        .limit(10000);

      if (!votes || votes.length === 0) {
        toast.error('No votes to export');
        setExporting(null);
        return;
      }

      let csv = "Vote ID,Poll ID,Poll Question,Choice,Voter Gender,Voter Age Range,Voter Country,Voted At\n";
      
      votes.forEach((vote: any) => {
        csv += `"${vote.id}","${vote.poll_id}","${vote.polls?.question || ''}","${vote.choice}","${vote.users?.gender || 'Unknown'}","${vote.users?.age_range || 'Unknown'}","${vote.users?.country || 'Unknown'}","${vote.created_at}"\n`;
      });

      downloadCSV(csv, 'votes-with-demographics');
      toast.success('Votes exported with demographics');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export votes');
    } finally {
      setExporting(null);
    }
  };

  const exportDemographicsCSV = async () => {
    setExporting('demographics');
    try {
      const { data: users } = await supabase
        .from('users')
        .select('id, gender, age_range, country, points, current_streak, created_at');

      const { data: votes } = await supabase
        .from('votes')
        .select('user_id');

      if (!users) {
        toast.error('No user data to export');
        setExporting(null);
        return;
      }

      // Count votes per user
      const voteCounts = new Map<string, number>();
      votes?.forEach(v => {
        voteCounts.set(v.user_id, (voteCounts.get(v.user_id) || 0) + 1);
      });

      let csv = "User ID,Gender,Age Range,Country,Total Points,Current Streak,Total Votes,Joined At\n";
      
      users.forEach(user => {
        csv += `"${user.id}","${user.gender || 'Unknown'}","${user.age_range || 'Unknown'}","${user.country || 'Unknown'}","${user.points || 0}","${user.current_streak || 0}","${voteCounts.get(user.id) || 0}","${user.created_at}"\n`;
      });

      downloadCSV(csv, 'user-demographics');
      toast.success('Demographics exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export demographics');
    } finally {
      setExporting(null);
    }
  };

  const exportRetentionCSV = async () => {
    setExporting('retention');
    try {
      const { data: votes } = await supabase
        .from('votes')
        .select('user_id, created_at')
        .order('created_at', { ascending: true });

      if (!votes || votes.length === 0) {
        toast.error('No vote data to analyze');
        setExporting(null);
        return;
      }

      // Analyze retention
      const userVoteCounts = new Map<string, number>();
      const userFirstVote = new Map<string, string>();
      const userLastVote = new Map<string, string>();

      votes.forEach(vote => {
        const count = userVoteCounts.get(vote.user_id) || 0;
        userVoteCounts.set(vote.user_id, count + 1);
        
        if (!userFirstVote.has(vote.user_id)) {
          userFirstVote.set(vote.user_id, vote.created_at || '');
        }
        userLastVote.set(vote.user_id, vote.created_at || '');
      });

      let csv = "User ID,Total Votes,First Vote Date,Last Vote Date,Voter Type\n";
      
      userVoteCounts.forEach((count, odUserId) => {
        const voterType = count === 1 ? 'First-time' : count < 5 ? 'Returning' : 'Loyal';
        csv += `"${odUserId}","${count}","${userFirstVote.get(odUserId)}","${userLastVote.get(odUserId)}","${voterType}"\n`;
      });

      downloadCSV(csv, 'voter-retention');
      toast.success('Retention data exported');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export retention data');
    } finally {
      setExporting(null);
    }
  };

  const exportResponseTimeCSV = async () => {
    setExporting('timing');
    try {
      const { data: polls } = await supabase
        .from('polls')
        .select('id, question, created_at');

      const { data: votes } = await supabase
        .from('votes')
        .select('poll_id, created_at')
        .order('created_at', { ascending: true });

      if (!polls || !votes) {
        toast.error('No data to analyze');
        setExporting(null);
        return;
      }

      const pollCreationMap = new Map(polls.map(p => [p.id, new Date(p.created_at || '').getTime()]));

      let csv = "Poll ID,Poll Question,Vote Time,Response Time (minutes),Hour of Day\n";
      
      votes.forEach(vote => {
        const pollCreated = pollCreationMap.get(vote.poll_id);
        const voteTime = new Date(vote.created_at || '').getTime();
        const responseMinutes = pollCreated ? Math.round((voteTime - pollCreated) / 60000) : 0;
        const hour = new Date(vote.created_at || '').getHours();
        const poll = polls.find(p => p.id === vote.poll_id);
        
        csv += `"${vote.poll_id}","${poll?.question || ''}","${vote.created_at}","${responseMinutes}","${hour}"\n`;
      });

      downloadCSV(csv, 'response-times');
      toast.success('Response time data exported');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export response times');
    } finally {
      setExporting(null);
    }
  };

  const exportSummaryCSV = async () => {
    setExporting('summary');
    try {
      // Gather all summary stats
      const { data: polls } = await supabase.from('polls').select('id, created_at');
      const { data: votes } = await supabase.from('votes').select('user_id, created_at');
      const { data: users } = await supabase.from('users').select('id, gender, age_range, country');

      if (!polls || !votes || !users) {
        toast.error('No data available');
        setExporting(null);
        return;
      }

      // Calculate metrics
      const uniqueVoters = new Set(votes.map(v => v.user_id)).size;
      const returningVoters = Array.from(
        votes.reduce((acc, v) => {
          acc.set(v.user_id, (acc.get(v.user_id) || 0) + 1);
          return acc;
        }, new Map<string, number>())
      ).filter(([_, count]) => count >= 2).length;

      const genderBreakdown = users.reduce((acc, u) => {
        const g = u.gender || 'Unknown';
        acc[g] = (acc[g] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const ageBreakdown = users.reduce((acc, u) => {
        const a = u.age_range || 'Unknown';
        acc[a] = (acc[a] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const countryBreakdown = users.reduce((acc, u) => {
        const c = u.country || 'Unknown';
        acc[c] = (acc[c] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      let csv = "Metric,Value\n";
      csv += `Total Polls,${polls.length}\n`;
      csv += `Total Votes,${votes.length}\n`;
      csv += `Total Users,${users.length}\n`;
      csv += `Unique Voters,${uniqueVoters}\n`;
      csv += `Returning Voters (2+ votes),${returningVoters}\n`;
      csv += `Retention Rate,${uniqueVoters > 0 ? Math.round((returningVoters / uniqueVoters) * 100) : 0}%\n`;
      csv += `Avg Votes per Poll,${polls.length > 0 ? Math.round(votes.length / polls.length) : 0}\n`;
      csv += `\nGender Breakdown\n`;
      Object.entries(genderBreakdown).forEach(([g, c]) => {
        csv += `${g},${c}\n`;
      });
      csv += `\nAge Range Breakdown\n`;
      Object.entries(ageBreakdown).forEach(([a, c]) => {
        csv += `${a},${c}\n`;
      });
      csv += `\nCountry Breakdown\n`;
      Object.entries(countryBreakdown).forEach(([co, c]) => {
        csv += `${co},${c}\n`;
      });

      downloadCSV(csv, 'platform-summary');
      toast.success('Summary report exported');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export summary');
    } finally {
      setExporting(null);
    }
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.style.display = 'none';
    document.body.appendChild(link);
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Analytics Data
          </CardTitle>
          <CardDescription>
            Download comprehensive analytics including demographics, retention, and response times
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="text-center space-y-3">
                  <FileSpreadsheet className="h-8 w-8 mx-auto text-green-500" />
                  <h3 className="font-medium">Polls Data</h3>
                  <p className="text-xs text-muted-foreground">
                    All polls with targeting, votes, and results
                  </p>
                  <Button 
                    onClick={exportPollsCSV} 
                    disabled={exporting === 'polls'}
                    className="w-full"
                    size="sm"
                  >
                    {exporting === 'polls' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Download CSV'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="text-center space-y-3">
                  <FileSpreadsheet className="h-8 w-8 mx-auto text-blue-500" />
                  <h3 className="font-medium">Votes + Demographics</h3>
                  <Badge variant="secondary" className="text-xs">Gender, Age, Country</Badge>
                  <p className="text-xs text-muted-foreground">
                    All votes with voter demographics
                  </p>
                  <Button 
                    onClick={exportVotesCSV} 
                    disabled={exporting === 'votes'}
                    className="w-full"
                    size="sm"
                  >
                    {exporting === 'votes' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Download CSV'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="text-center space-y-3">
                  <FileSpreadsheet className="h-8 w-8 mx-auto text-purple-500" />
                  <h3 className="font-medium">User Demographics</h3>
                  <Badge variant="secondary" className="text-xs">Full Breakdown</Badge>
                  <p className="text-xs text-muted-foreground">
                    User profiles with activity stats
                  </p>
                  <Button 
                    onClick={exportDemographicsCSV} 
                    disabled={exporting === 'demographics'}
                    className="w-full"
                    size="sm"
                  >
                    {exporting === 'demographics' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Download CSV'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="text-center space-y-3">
                  <FileText className="h-8 w-8 mx-auto text-orange-500" />
                  <h3 className="font-medium">Voter Retention</h3>
                  <Badge variant="secondary" className="text-xs">Funnel Analysis</Badge>
                  <p className="text-xs text-muted-foreground">
                    First-time vs returning vs loyal voters
                  </p>
                  <Button 
                    onClick={exportRetentionCSV} 
                    disabled={exporting === 'retention'}
                    className="w-full"
                    size="sm"
                  >
                    {exporting === 'retention' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Download CSV'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="text-center space-y-3">
                  <FileText className="h-8 w-8 mx-auto text-cyan-500" />
                  <h3 className="font-medium">Response Times</h3>
                  <Badge variant="secondary" className="text-xs">Timing Analytics</Badge>
                  <p className="text-xs text-muted-foreground">
                    How quickly users vote after poll creation
                  </p>
                  <Button 
                    onClick={exportResponseTimeCSV} 
                    disabled={exporting === 'timing'}
                    className="w-full"
                    size="sm"
                  >
                    {exporting === 'timing' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Download CSV'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-dashed border-primary/30 bg-primary/5">
              <CardContent className="pt-6">
                <div className="text-center space-y-3">
                  <FileText className="h-8 w-8 mx-auto text-primary" />
                  <h3 className="font-medium">Full Summary Report</h3>
                  <Badge className="text-xs">Recommended</Badge>
                  <p className="text-xs text-muted-foreground">
                    Complete platform metrics & breakdowns
                  </p>
                  <Button 
                    onClick={exportSummaryCSV} 
                    disabled={exporting === 'summary'}
                    className="w-full"
                    size="sm"
                  >
                    {exporting === 'summary' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Download CSV'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
