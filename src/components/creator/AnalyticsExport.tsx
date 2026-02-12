import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function AnalyticsExport() {
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);

  const exportCSV = async (type: 'polls' | 'votes' | 'summary') => {
    if (!user) return;
    
    setExporting(true);
    try {
      let csvContent = "";
      
      if (type === 'polls') {
        const { data: polls } = await supabase
          .from('polls')
          .select('*')
          .eq('created_by', user.id)
          .order('created_at', { ascending: false });
        
        if (polls && polls.length > 0) {
          csvContent = "ID,Question,Option A,Option B,Category,Created At,Is Active\n";
          polls.forEach(poll => {
            csvContent += `"${poll.id}","${poll.question}","${poll.option_a}","${poll.option_b}","${poll.category || ''}","${poll.created_at}","${poll.is_active}"\n`;
          });
        }
      } else if (type === 'votes') {
        const { data: polls } = await supabase
          .from('polls')
          .select('id')
          .eq('created_by', user.id);
        
        if (polls) {
          const pollIds = polls.map(p => p.id);
          const { data: votes } = await supabase
            .from('votes')
            .select('*, users!inner(username, age_range, gender, country)')
            .in('poll_id', pollIds)
            .order('created_at', { ascending: false });
          
          if (votes && votes.length > 0) {
            csvContent = "Vote ID,Poll ID,Choice,Username,Age Range,Gender,Country,Voted At\n";
            votes.forEach((vote) => {
              const userData = vote.users as { username?: string; age_range?: string; gender?: string; country?: string } | null;
              csvContent += `"${vote.id}","${vote.poll_id}","${vote.choice}","${userData?.username || 'Anonymous'}","${userData?.age_range || ''}","${userData?.gender || ''}","${userData?.country || ''}","${vote.created_at}"\n`;
            });
          }
        }
      } else if (type === 'summary') {
        const { data: polls } = await supabase
          .from('polls')
          .select('id, question')
          .eq('created_by', user.id);
        
        if (polls) {
          const pollIds = polls.map(p => p.id);
          const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: pollIds });
          
          csvContent = "Poll ID,Question,Total Votes,Votes A,Votes B,Percent A,Percent B\n";
          polls.forEach(poll => {
            const result = results?.find((r) => r.poll_id === poll.id);
            csvContent += `"${poll.id}","${poll.question}","${result?.total_votes || 0}","${result?.votes_a || 0}","${result?.votes_b || 0}","${result?.percent_a?.toFixed(1) || 0}%","${result?.percent_b?.toFixed(1) || 0}%"\n`;
          });
        }
      }
      
      if (csvContent) {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `versa-${type}-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        toast.success(`${type} data exported successfully`);
      } else {
        toast.error('No data to export');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Analytics Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Download your analytics data in CSV format for further analysis in spreadsheet applications.
          </p>
          
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="text-center space-y-3">
                  <FileText className="h-8 w-8 mx-auto text-primary" />
                  <h3 className="font-medium">Polls Data</h3>
                  <p className="text-xs text-muted-foreground">
                    Export all your polls with questions, options, and settings
                  </p>
                  <Button 
                    onClick={() => exportCSV('polls')} 
                    disabled={exporting}
                    className="w-full"
                  >
                    {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Download CSV'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="text-center space-y-3">
                  <FileText className="h-8 w-8 mx-auto text-primary" />
                  <h3 className="font-medium">Votes Data</h3>
                  <p className="text-xs text-muted-foreground">
                    Export all votes with voter demographics and timestamps
                  </p>
                  <Button 
                    onClick={() => exportCSV('votes')} 
                    disabled={exporting}
                    className="w-full"
                  >
                    {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Download CSV'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="text-center space-y-3">
                  <FileText className="h-8 w-8 mx-auto text-primary" />
                  <h3 className="font-medium">Summary Report</h3>
                  <p className="text-xs text-muted-foreground">
                    Export poll results with vote counts and percentages
                  </p>
                  <Button 
                    onClick={() => exportCSV('summary')} 
                    disabled={exporting}
                    className="w-full"
                  >
                    {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Download CSV'}
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
