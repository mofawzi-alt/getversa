import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CampaignFeedbackConfig {
  enabled: boolean;
  attributes: string[]; // taste, quality, uniqueness, ease, versatility
  verbatim: boolean;
}

export const ALL_ATTRIBUTES = ['taste', 'quality', 'uniqueness', 'ease', 'versatility'] as const;
export type AttributeKey = typeof ALL_ATTRIBUTES[number];

const ATTR_LABELS: Record<AttributeKey, string> = {
  taste: 'Appeal',
  quality: 'Quality',
  uniqueness: 'Uniqueness',
  ease: 'Easy to use',
  versatility: 'Versatility',
};

export function attributeLabel(key: string): string {
  return (ATTR_LABELS as any)[key] ?? key;
}

/**
 * Fetches the campaign feedback config for a poll.
 * Returns null if poll is not part of a campaign or campaign hasn't enabled feedback.
 */
export function useCampaignFeedbackConfig(pollId?: string | null) {
  return useQuery({
    queryKey: ['campaign-feedback-config', pollId],
    enabled: !!pollId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<{ campaignId: string; config: CampaignFeedbackConfig } | null> => {
      if (!pollId) return null;
      const { data: poll } = await supabase
        .from('polls')
        .select('campaign_id')
        .eq('id', pollId)
        .maybeSingle();
      if (!poll?.campaign_id) return null;

      const { data: campaign } = await supabase
        .from('poll_campaigns')
        .select('id, attribute_config')
        .eq('id', poll.campaign_id)
        .maybeSingle();
      if (!campaign) return null;

      const cfg = (campaign.attribute_config as any) || {};
      const config: CampaignFeedbackConfig = {
        enabled: !!cfg.enabled,
        attributes: Array.isArray(cfg.attributes) ? cfg.attributes : [],
        verbatim: !!cfg.verbatim,
      };
      if (!config.enabled && !config.verbatim) return null;
      return { campaignId: campaign.id, config };
    },
  });
}
