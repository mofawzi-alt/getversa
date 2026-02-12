import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Gift, Loader2, Check, Lock, ExternalLink, Copy, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Reward {
  id: string;
  title: string;
  description: string;
  cost_points: number;
  image_url: string | null;
  partner_name: string | null;
  partner_logo_url: string | null;
  redemption_type: string | null;
  external_url: string | null;
  terms_conditions: string | null;
  userReward?: {
    id: string;
    status: string;
    redemption_code: string | null;
    redeemed_at: string | null;
  };
}

export default function Rewards() {
  const { user, profile, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [redemptionCode, setRedemptionCode] = useState<string | null>(null);

  const { data: rewards, isLoading } = useQuery({
    queryKey: ['rewards', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data: activeRewards, error } = await supabase
        .from('rewards')
        .select('*')
        .eq('is_active', true);
      
      if (error) throw error;
      
      const { data: userRewards } = await supabase
        .from('user_rewards')
        .select('*')
        .eq('user_id', user.id);
      
      const rewardMap = new Map(userRewards?.map(r => [r.reward_id, r]) || []);
      
      return activeRewards.map(reward => ({
        ...reward,
        userReward: rewardMap.get(reward.id),
      })) as Reward[];
    },
    enabled: !!user,
  });

  const generateCode = () => {
    return 'VERSA-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  };

  const redeemMutation = useMutation({
    mutationFn: async (reward: Reward) => {
      if (!user || !profile) throw new Error('Not authenticated');
      
      if (profile.points < reward.cost_points) {
        throw new Error('Not enough points');
      }
      
      const existing = reward.userReward;
      
      if (existing?.status === 'redeemed') {
        throw new Error('Already redeemed');
      }
      
      const code = generateCode();
      
      // Use atomic database function to prevent race conditions
      const { data, error } = await supabase.rpc('redeem_reward', {
        p_user_id: user.id,
        p_reward_id: reward.id,
        p_cost_points: reward.cost_points,
        p_redemption_code: code
      });
      
      if (error) throw error;
      
      const result = data as { error?: string; success?: boolean; code?: string } | null;
      if (result?.error) throw new Error(result.error);
      
      // Create notification
      await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          title: 'Perk Unlocked!',
          body: `You've unlocked "${reward.title}"${reward.partner_name ? ` from ${reward.partner_name}` : ''}`,
          type: 'reward',
        });
      
      return code;
    },
    onSuccess: (code) => {
      setRedemptionCode(code);
      queryClient.invalidateQueries({ queryKey: ['rewards'] });
      refreshProfile();
      toast.success('Reward redeemed successfully!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to redeem reward');
    },
  });

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard!');
  };

  const partnerRewards = rewards?.filter(r => r.partner_name) || [];
  const internalRewards = rewards?.filter(r => !r.partner_name) || [];

  return (
    <AppLayout>
      <div className="p-4 space-y-6 animate-slide-up">
        <header>
          <h1 className="text-2xl font-display font-bold">Perks</h1>
          <p className="text-foreground/60 text-sm">Unlock perks with your influence</p>
        </header>

        {/* Insight Score Balance */}
        <div className="glass rounded-2xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center">
            <Gift className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm text-card-foreground/70">Insight Score</p>
            <p className="text-2xl font-display font-bold">{profile?.points || 0}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Partner Rewards Section */}
            {partnerRewards.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">Partner Rewards</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Exclusive offers from our partner brands
                </p>
                
                <div className="space-y-3">
                  {partnerRewards.map((reward) => {
                    const isRedeemed = reward.userReward?.status === 'redeemed';
                    const canAfford = (profile?.points || 0) >= reward.cost_points;
                    
                    return (
                      <div 
                        key={reward.id} 
                        className="glass rounded-2xl overflow-hidden"
                        onClick={() => setSelectedReward(reward)}
                      >
                        <div className="flex">
                          {reward.image_url && (
                            <img 
                              src={reward.image_url} 
                              alt={reward.title}
                              className="w-24 h-24 object-cover"
                            />
                          )}
                          
                          <div className="flex-1 p-3 space-y-1">
                            <div className="flex items-center gap-2">
                              {reward.partner_logo_url && (
                                <img 
                                  src={reward.partner_logo_url} 
                                  alt={reward.partner_name || ''} 
                                  className="w-5 h-5 rounded object-contain"
                                />
                              )}
                              <span className="text-xs text-primary font-medium">
                                {reward.partner_name}
                              </span>
                            </div>
                            
                            <h3 className="font-semibold text-sm line-clamp-1">{reward.title}</h3>
                            <p className="text-xs text-card-foreground/70 line-clamp-1">
                              {reward.description}
                            </p>
                            
                            <div className="flex items-center justify-between pt-1">
                              <span className={`text-sm font-bold ${canAfford ? 'text-primary' : 'text-card-foreground/50'}`}> 
                                {reward.cost_points} pts
                              </span>
                              
                              {isRedeemed ? (
                                <span className="flex items-center gap-1 text-xs text-green-500 bg-green-500/10 px-2 py-1 rounded-full">
                                  <Check className="h-3 w-3" />
                                  Redeemed
                                </span>
                              ) : (
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  canAfford 
                                    ? 'bg-primary/10 text-primary' 
                                    : 'bg-muted text-muted-foreground'
                                }`}>
                                  {canAfford ? 'Unlock now' : 'Keep voting'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Internal Rewards Section */}
            {internalRewards.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold">Versa Rewards</h2>
                
                <div className="grid grid-cols-2 gap-4">
                  {internalRewards.map((reward) => {
                    const isRedeemed = reward.userReward?.status === 'redeemed';
                    const canAfford = (profile?.points || 0) >= reward.cost_points;
                    
                    return (
                      <div 
                        key={reward.id} 
                        className="glass rounded-2xl overflow-hidden cursor-pointer"
                        onClick={() => setSelectedReward(reward)}
                      >
                        {reward.image_url && (
                          <img 
                            src={reward.image_url} 
                            alt={reward.title}
                            className="w-full h-24 object-cover"
                          />
                        )}
                        
                        <div className="p-3 space-y-2">
                          <h3 className="font-semibold text-sm line-clamp-1">{reward.title}</h3>
                          <p className="text-xs text-card-foreground/70 line-clamp-2">
                            {reward.description}
                          </p>
                          
                          <div className="flex items-center justify-between pt-2">
                            <span className={`text-sm font-bold ${canAfford ? 'text-primary' : 'text-card-foreground/50'}`}> 
                              {reward.cost_points} pts
                            </span>
                            
                            {isRedeemed ? (
                              <span className="flex items-center gap-1 text-xs text-green-500">
                                <Check className="h-3 w-3" />
                                Redeemed
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {canAfford ? <Gift className="h-4 w-4 text-primary" /> : <Lock className="h-3 w-3" />}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {rewards?.length === 0 && (
              <div className="text-center py-12">
                <Gift className="h-12 w-12 text-foreground/40 mx-auto mb-4" />
                <h3 className="text-lg font-semibold">No rewards available</h3>
                <p className="text-foreground/60 text-sm">
                  Check back later for new rewards from our partners
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Reward Detail Modal */}
      <Dialog open={!!selectedReward} onOpenChange={() => { setSelectedReward(null); setRedemptionCode(null); }}>
        <DialogContent className="max-w-sm mx-4">
          {selectedReward && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  {selectedReward.partner_logo_url && (
                    <img 
                      src={selectedReward.partner_logo_url} 
                      alt={selectedReward.partner_name || ''} 
                      className="w-6 h-6 rounded object-contain"
                    />
                  )}
                  {selectedReward.partner_name && (
                    <span className="text-sm text-primary font-medium">
                      {selectedReward.partner_name}
                    </span>
                  )}
                </div>
                <DialogTitle>{selectedReward.title}</DialogTitle>
                <DialogDescription>{selectedReward.description}</DialogDescription>
              </DialogHeader>

              {selectedReward.image_url && (
                <img 
                  src={selectedReward.image_url} 
                  alt={selectedReward.title}
                  className="w-full h-40 object-cover rounded-lg"
                />
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">Required Score</span>
                  <span className="font-bold text-primary">{selectedReward.cost_points}</span>
                </div>

                {selectedReward.terms_conditions && (
                  <p className="text-xs text-muted-foreground">
                    {selectedReward.terms_conditions}
                  </p>
                )}

                {/* Redemption Code Display */}
                {(redemptionCode || selectedReward.userReward?.redemption_code) && (
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl space-y-3">
                    <p className="text-sm text-green-600 font-medium text-center">Your Unlock Code</p>
                    <div className="flex items-center justify-center gap-2">
                      <code className="text-lg font-mono font-bold text-foreground bg-background px-4 py-2 rounded-lg">
                        {redemptionCode || selectedReward.userReward?.redemption_code}
                      </code>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => copyCode(redemptionCode || selectedReward.userReward?.redemption_code || '')}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-center text-muted-foreground">
                      Show this code at our partner location or use it online
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                {selectedReward.userReward?.status === 'redeemed' ? (
                  selectedReward.external_url && (
                    <Button 
                      className="w-full gap-2" 
                      onClick={() => window.open(selectedReward.external_url!, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Visit Partner Site
                    </Button>
                  )
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => redeemMutation.mutate(selectedReward)}
                    disabled={
                      (profile?.points || 0) < selectedReward.cost_points || 
                      redeemMutation.isPending
                    }
                  >
                    {redeemMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    {(profile?.points || 0) >= selectedReward.cost_points 
                      ? `Unlock Perk`
                      : `Need ${selectedReward.cost_points - (profile?.points || 0)} more`
                    }
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
