export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ask_versa_queries: {
        Row: {
          answered: boolean
          category_hint: string | null
          created_at: string
          credits_charged: number
          id: string
          low_data: boolean
          matched_poll_count: number | null
          mode: string
          model_used: string | null
          question: string
          route: string
          total_votes_considered: number | null
          user_id: string | null
        }
        Insert: {
          answered?: boolean
          category_hint?: string | null
          created_at?: string
          credits_charged?: number
          id?: string
          low_data?: boolean
          matched_poll_count?: number | null
          mode?: string
          model_used?: string | null
          question: string
          route?: string
          total_votes_considered?: number | null
          user_id?: string | null
        }
        Update: {
          answered?: boolean
          category_hint?: string | null
          created_at?: string
          credits_charged?: number
          id?: string
          low_data?: boolean
          matched_poll_count?: number | null
          mode?: string
          model_used?: string | null
          question?: string
          route?: string
          total_votes_considered?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ask_versa_queries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_settings: {
        Row: {
          created_at: string | null
          daily_poll_reminder: boolean | null
          id: string
          reminder_time: string | null
          sponsored_opt_in: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          daily_poll_reminder?: boolean | null
          id?: string
          reminder_time?: string | null
          sponsored_opt_in?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          daily_poll_reminder?: boolean | null
          id?: string
          reminder_time?: string | null
          sponsored_opt_in?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          badge_type: string
          created_at: string | null
          description: string
          icon_url: string | null
          id: string
          name: string
          points_reward: number | null
          requirement_value: number | null
        }
        Insert: {
          badge_type: string
          created_at?: string | null
          description: string
          icon_url?: string | null
          id?: string
          name: string
          points_reward?: number | null
          requirement_value?: number | null
        }
        Update: {
          badge_type?: string
          created_at?: string | null
          description?: string
          icon_url?: string | null
          id?: string
          name?: string
          points_reward?: number | null
          requirement_value?: number | null
        }
        Relationships: []
      }
      breakdown_findings: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          detail: Json
          finding_type: string
          headline: string
          id: string
          pinned: boolean
          poll_id: string
          scan_at: string
          scan_run_id: string
          status: string
          total_votes: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          detail?: Json
          finding_type: string
          headline: string
          id?: string
          pinned?: boolean
          poll_id: string
          scan_at?: string
          scan_run_id: string
          status?: string
          total_votes?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          detail?: Json
          finding_type?: string
          headline?: string
          id?: string
          pinned?: boolean
          poll_id?: string
          scan_at?: string
          scan_run_id?: string
          status?: string
          total_votes?: number
        }
        Relationships: [
          {
            foreignKeyName: "breakdown_findings_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "poll_effective_counts"
            referencedColumns: ["poll_id"]
          },
          {
            foreignKeyName: "breakdown_findings_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_clients: {
        Row: {
          campaign_id: string
          created_at: string
          created_by: string | null
          id: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_clients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "poll_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_panelists: {
        Row: {
          accepted_at: string | null
          campaign_id: string
          completed_at: string | null
          dropped_at: string | null
          id: string
          invited_at: string
          status: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          campaign_id: string
          completed_at?: string | null
          dropped_at?: string | null
          id?: string
          invited_at?: string
          status?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          campaign_id?: string
          completed_at?: string | null
          dropped_at?: string | null
          id?: string
          invited_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_panelists_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "poll_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_polls: {
        Row: {
          campaign_id: string
          created_at: string
          entity_name: string
          id: string
          poll_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          entity_name: string
          id?: string
          poll_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          entity_name?: string
          id?: string
          poll_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_polls_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "poll_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_polls_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "poll_effective_counts"
            referencedColumns: ["poll_id"]
          },
          {
            foreignKeyName: "campaign_polls_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_verbatim_themes: {
        Row: {
          campaign_id: string
          generated_at: string
          generation_run_id: string
          id: string
          sample_quotes: Json
          supporting_quote_count: number
          theme_label: string
          theme_summary: string
        }
        Insert: {
          campaign_id: string
          generated_at?: string
          generation_run_id: string
          id?: string
          sample_quotes?: Json
          supporting_quote_count?: number
          theme_label: string
          theme_summary: string
        }
        Update: {
          campaign_id?: string
          generated_at?: string
          generation_run_id?: string
          id?: string
          sample_quotes?: Json
          supporting_quote_count?: number
          theme_label?: string
          theme_summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_verbatim_themes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "poll_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_preset: boolean
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_preset?: boolean
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_preset?: boolean
          name?: string
        }
        Relationships: []
      }
      challenges: {
        Row: {
          created_at: string | null
          description: string
          ends_at: string
          goal_type: string
          goal_value: number
          id: string
          is_active: boolean | null
          reward_points: number | null
          starts_at: string
          title: string
        }
        Insert: {
          created_at?: string | null
          description: string
          ends_at: string
          goal_type: string
          goal_value: number
          id?: string
          is_active?: boolean | null
          reward_points?: number | null
          starts_at: string
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string
          ends_at?: string
          goal_type?: string
          goal_value?: number
          id?: string
          is_active?: boolean | null
          reward_points?: number | null
          starts_at?: string
          title?: string
        }
        Relationships: []
      }
      collaboration_requests: {
        Row: {
          brand_name: string
          contact_email: string
          created_at: string | null
          id: string
          message: string
          requester_id: string
          status: string | null
        }
        Insert: {
          brand_name: string
          contact_email: string
          created_at?: string | null
          id?: string
          message: string
          requester_id: string
          status?: string | null
        }
        Update: {
          brand_name?: string
          contact_email?: string
          created_at?: string | null
          id?: string
          message?: string
          requester_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collaboration_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          user1_id: string
          user2_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          user1_id: string
          user2_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          user1_id?: string
          user2_id?: string
        }
        Relationships: []
      }
      daily_poll_queues: {
        Row: {
          created_at: string
          id: string
          poll_id: string
          queue_date: string
          queue_order: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          poll_id: string
          queue_date: string
          queue_order?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          poll_id?: string
          queue_date?: string
          queue_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_poll_queues_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "poll_effective_counts"
            referencedColumns: ["poll_id"]
          },
          {
            foreignKeyName: "daily_poll_queues_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_poll_settings: {
        Row: {
          daily_limit: number
          first_day_limit: number
          id: string
          release_hour_cairo: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          daily_limit?: number
          first_day_limit?: number
          id?: string
          release_hour_cairo?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          daily_limit?: number
          first_day_limit?: number
          id?: string
          release_hour_cairo?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      daily_pulse: {
        Row: {
          by_category: Json | null
          cairo: Json | null
          cards: Json
          egypt_today: Json
          generated_at: string
          id: string
          pinned_poll_id: string | null
          pulse_date: string
          slot: string
        }
        Insert: {
          by_category?: Json | null
          cairo?: Json | null
          cards?: Json
          egypt_today?: Json
          generated_at?: string
          id?: string
          pinned_poll_id?: string | null
          pulse_date: string
          slot: string
        }
        Update: {
          by_category?: Json | null
          cairo?: Json | null
          cards?: Json
          egypt_today?: Json
          generated_at?: string
          id?: string
          pinned_poll_id?: string | null
          pulse_date?: string
          slot?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_pulse_pinned_poll_id_fkey"
            columns: ["pinned_poll_id"]
            isOneToOne: false
            referencedRelation: "poll_effective_counts"
            referencedColumns: ["poll_id"]
          },
          {
            foreignKeyName: "daily_pulse_pinned_poll_id_fkey"
            columns: ["pinned_poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      dimensions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      favorite_polls: {
        Row: {
          created_at: string | null
          id: string
          poll_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          poll_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          poll_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorite_polls_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "poll_effective_counts"
            referencedColumns: ["poll_id"]
          },
          {
            foreignKeyName: "favorite_polls_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_polls: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          poll_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          poll_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          poll_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "featured_polls_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "poll_effective_counts"
            referencedColumns: ["poll_id"]
          },
          {
            foreignKeyName: "featured_polls_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string | null
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string | null
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string | null
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          created_at: string
          id: string
          recipient_id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          recipient_id: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          recipient_id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          message_type: string
          read_at: string | null
          sender_id: string
          shared_poll_id: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          message_type?: string
          read_at?: string | null
          sender_id: string
          shared_poll_id?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          message_type?: string
          read_at?: string | null
          sender_id?: string
          shared_poll_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_shared_poll_id_fkey"
            columns: ["shared_poll_id"]
            isOneToOne: false
            referencedRelation: "poll_effective_counts"
            referencedColumns: ["poll_id"]
          },
          {
            foreignKeyName: "messages_shared_poll_id_fkey"
            columns: ["shared_poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          channel: string
          data: Json | null
          id: string
          notification_type: string
          opened: boolean
          opened_at: string | null
          priority: number
          sent_at: string
          user_id: string
        }
        Insert: {
          channel?: string
          data?: Json | null
          id?: string
          notification_type: string
          opened?: boolean
          opened_at?: string | null
          priority?: number
          sent_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          data?: Json | null
          id?: string
          notification_type?: string
          opened?: boolean
          opened_at?: string | null
          priority?: number
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string | null
          data: Json | null
          id: string
          is_read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_polls: {
        Row: {
          created_at: string
          display_order: number
          id: string
          poll_id: string
        }
        Insert: {
          created_at?: string
          display_order: number
          id?: string
          poll_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          poll_id?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          id: string
          joined_at: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          invite_code: string
          logo_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          invite_code?: string
          logo_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          invite_code?: string
          logo_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      pinned_polls: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pinned_polls_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "poll_effective_counts"
            referencedColumns: ["poll_id"]
          },
          {
            foreignKeyName: "pinned_polls_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_attribute_ratings: {
        Row: {
          choice: string
          created_at: string
          ease: number | null
          id: string
          poll_id: string
          quality: number | null
          taste: number | null
          uniqueness: number | null
          user_id: string | null
          versatility: number | null
          voter_age_range: string | null
          voter_city: string | null
          voter_country: string | null
          voter_gender: string | null
        }
        Insert: {
          choice: string
          created_at?: string
          ease?: number | null
          id?: string
          poll_id: string
          quality?: number | null
          taste?: number | null
          uniqueness?: number | null
          user_id?: string | null
          versatility?: number | null
          voter_age_range?: string | null
          voter_city?: string | null
          voter_country?: string | null
          voter_gender?: string | null
        }
        Update: {
          choice?: string
          created_at?: string
          ease?: number | null
          id?: string
          poll_id?: string
          quality?: number | null
          taste?: number | null
          uniqueness?: number | null
          user_id?: string | null
          versatility?: number | null
          voter_age_range?: string | null
          voter_city?: string | null
          voter_country?: string | null
          voter_gender?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "poll_attribute_ratings_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "poll_effective_counts"
            referencedColumns: ["poll_id"]
          },
          {
            foreignKeyName: "poll_attribute_ratings_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_boosts: {
        Row: {
          boost_type: string
          boost_value: number | null
          created_at: string | null
          ends_at: string
          id: string
          poll_id: string
          sponsor_name: string
          starts_at: string
        }
        Insert: {
          boost_type: string
          boost_value?: number | null
          created_at?: string | null
          ends_at: string
          id?: string
          poll_id: string
          sponsor_name: string
          starts_at: string
        }
        Update: {
          boost_type?: string
          boost_value?: number | null
          created_at?: string | null
          ends_at?: string
          id?: string
          poll_id?: string
          sponsor_name?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_boosts_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "poll_effective_counts"
            referencedColumns: ["poll_id"]
          },
          {
            foreignKeyName: "poll_boosts_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_calendar: {
        Row: {
          ai_image_a_preview: string | null
          ai_image_b_preview: string | null
          approved_at: string | null
          approved_by: string | null
          category: string | null
          created_at: string
          created_by: string
          id: string
          image_a_url: string | null
          image_b_url: string | null
          notes: string | null
          option_a: string
          option_b: string
          published_at: string | null
          published_poll_id: string | null
          question: string
          release_date: string
          source: string | null
          status: string
          target_age_range: string | null
          target_country: string | null
          target_gender: string | null
          updated_at: string
          why_viral: string | null
        }
        Insert: {
          ai_image_a_preview?: string | null
          ai_image_b_preview?: string | null
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          created_at?: string
          created_by: string
          id?: string
          image_a_url?: string | null
          image_b_url?: string | null
          notes?: string | null
          option_a: string
          option_b: string
          published_at?: string | null
          published_poll_id?: string | null
          question: string
          release_date: string
          source?: string | null
          status?: string
          target_age_range?: string | null
          target_country?: string | null
          target_gender?: string | null
          updated_at?: string
          why_viral?: string | null
        }
        Update: {
          ai_image_a_preview?: string | null
          ai_image_b_preview?: string | null
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          created_at?: string
          created_by?: string
          id?: string
          image_a_url?: string | null
          image_b_url?: string | null
          notes?: string | null
          option_a?: string
          option_b?: string
          published_at?: string | null
          published_poll_id?: string | null
          question?: string
          release_date?: string
          source?: string | null
          status?: string
          target_age_range?: string | null
          target_country?: string | null
          target_gender?: string | null
          updated_at?: string
          why_viral?: string | null
        }
        Relationships: []
      }
      poll_campaigns: {
        Row: {
          attribute_config: Json
          brand_logo_url: string | null
          brand_name: string | null
          campaign_type: string
          created_at: string
          created_by: string
          description: string | null
          drip_enabled: boolean
          drip_polls_per_day: number | null
          drip_start_date: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          name: string
          panel_incentive_points: number | null
          panel_size_target: number | null
          release_at: string | null
          target_vote_count: number | null
          updated_at: string
          visibility_mode: string
        }
        Insert: {
          attribute_config?: Json
          brand_logo_url?: string | null
          brand_name?: string | null
          campaign_type?: string
          created_at?: string
          created_by: string
          description?: string | null
          drip_enabled?: boolean
          drip_polls_per_day?: number | null
          drip_start_date?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          panel_incentive_points?: number | null
          panel_size_target?: number | null
          release_at?: string | null
          target_vote_count?: number | null
          updated_at?: string
          visibility_mode?: string
        }
        Update: {
          attribute_config?: Json
          brand_logo_url?: string | null
          brand_name?: string | null
          campaign_type?: string
          created_at?: string
          created_by?: string
          description?: string | null
          drip_enabled?: boolean
          drip_polls_per_day?: number | null
          drip_start_date?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          panel_incentive_points?: number | null
          panel_size_target?: number | null
          release_at?: string | null
          target_vote_count?: number | null
          updated_at?: string
          visibility_mode?: string
        }
        Relationships: []
      }
      poll_challenges: {
        Row: {
          challenged_choice: string | null
          challenged_id: string
          challenged_score: number | null
          challenger_choice: string | null
          challenger_id: string
          challenger_score: number | null
          completed_at: string | null
          created_at: string
          game_type: string
          id: string
          match_rate: number | null
          poll_id: string
          poll_ids: string[] | null
          responded_at: string | null
          status: string
          taunt_message: string | null
        }
        Insert: {
          challenged_choice?: string | null
          challenged_id: string
          challenged_score?: number | null
          challenger_choice?: string | null
          challenger_id: string
          challenger_score?: number | null
          completed_at?: string | null
          created_at?: string
          game_type?: string
          id?: string
          match_rate?: number | null
          poll_id: string
          poll_ids?: string[] | null
          responded_at?: string | null
          status?: string
          taunt_message?: string | null
        }
        Update: {
          challenged_choice?: string | null
          challenged_id?: string
          challenged_score?: number | null
          challenger_choice?: string | null
          challenger_id?: string
          challenger_score?: number | null
          completed_at?: string | null
          created_at?: string
          game_type?: string
          id?: string
          match_rate?: number | null
          poll_id?: string
          poll_ids?: string[] | null
          responded_at?: string | null
          status?: string
          taunt_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "poll_challenges_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "poll_effective_counts"
            referencedColumns: ["poll_id"]
          },
          {
            foreignKeyName: "poll_challenges_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_cycles: {
        Row: {
          created_at: string
          cycle_end: string
          cycle_number: number
          cycle_start: string
          demographic_data: Json | null
          id: string
          percent_a: number
          percent_b: number
          poll_id: string
          total_votes: number
          votes_a: number
          votes_b: number
        }
        Insert: {
          created_at?: string
          cycle_end: string
          cycle_number?: number
          cycle_start: string
          demographic_data?: Json | null
          id?: string
          percent_a?: number
          percent_b?: number
          poll_id: string
          total_votes?: number
          votes_a?: number
          votes_b?: number
        }
        Update: {
          created_at?: string
          cycle_end?: string
          cycle_number?: number
          cycle_start?: string
          demographic_data?: Json | null
          id?: string
          percent_a?: number
          percent_b?: number
          poll_id?: string
          total_votes?: number
          votes_a?: number
          votes_b?: number
        }
        Relationships: [
          {
            foreignKeyName: "poll_cycles_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "poll_effective_counts"
            referencedColumns: ["poll_id"]
          },
          {
            foreignKeyName: "poll_cycles_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_dimensions: {
        Row: {
          created_at: string
          dimension_id: string
          id: string
          poll_id: string
          weight_a: number
          weight_b: number
        }
        Insert: {
          created_at?: string
          dimension_id: string
          id?: string
          poll_id: string
          weight_a?: number
          weight_b?: number
        }
        Update: {
          created_at?: string
          dimension_id?: string
          id?: string
          poll_id?: string
          weight_a?: number
          weight_b?: number
        }
        Relationships: [
          {
            foreignKeyName: "poll_dimensions_dimension_id_fkey"
            columns: ["dimension_id"]
            isOneToOne: false
            referencedRelation: "dimensions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_dimensions_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "poll_effective_counts"
            referencedColumns: ["poll_id"]
          },
          {
            foreignKeyName: "poll_dimensions_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_reactions: {
        Row: {
          created_at: string
          id: string
          poll_id: string
          reaction: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          poll_id: string
          reaction?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          poll_id?: string
          reaction?: string
          user_id?: string
        }
        Relationships: []
      }
      poll_suggestions: {
        Row: {
          admin_notes: string | null
          ask_query_id: string | null
          awarded_credits: number
          category: string | null
          created_at: string
          id: string
          option_a: string | null
          option_b: string | null
          published_at: string | null
          published_poll_id: string | null
          question: string
          source: string
          status: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          ask_query_id?: string | null
          awarded_credits?: number
          category?: string | null
          created_at?: string
          id?: string
          option_a?: string | null
          option_b?: string | null
          published_at?: string | null
          published_poll_id?: string | null
          question: string
          source?: string
          status?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          ask_query_id?: string | null
          awarded_credits?: number
          category?: string | null
          created_at?: string
          id?: string
          option_a?: string | null
          option_b?: string | null
          published_at?: string | null
          published_poll_id?: string | null
          question?: string
          source?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_suggestions_ask_query_id_fkey"
            columns: ["ask_query_id"]
            isOneToOne: false
            referencedRelation: "ask_versa_queries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_suggestions_published_poll_id_fkey"
            columns: ["published_poll_id"]
            isOneToOne: false
            referencedRelation: "poll_effective_counts"
            referencedColumns: ["poll_id"]
          },
          {
            foreignKeyName: "poll_suggestions_published_poll_id_fkey"
            columns: ["published_poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_verbatim_feedback: {
        Row: {
          choice: string
          created_at: string
          feedback: string
          id: string
          poll_id: string
          user_id: string | null
          voter_age_range: string | null
          voter_city: string | null
          voter_country: string | null
          voter_gender: string | null
        }
        Insert: {
          choice: string
          created_at?: string
          feedback: string
          id?: string
          poll_id: string
          user_id?: string | null
          voter_age_range?: string | null
          voter_city?: string | null
          voter_country?: string | null
          voter_gender?: string | null
        }
        Update: {
          choice?: string
          created_at?: string
          feedback?: string
          id?: string
          poll_id?: string
          user_id?: string | null
          voter_age_range?: string | null
          voter_city?: string | null
          voter_country?: string | null
          voter_gender?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "poll_verbatim_feedback_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "poll_effective_counts"
            referencedColumns: ["poll_id"]
          },
          {
            foreignKeyName: "poll_verbatim_feedback_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          baseline_votes_a: number
          baseline_votes_b: number
          batch_slot: string
          campaign_id: string | null
          category: string | null
          created_at: string | null
          created_by: string | null
          ends_at: string | null
          expiry_type: string
          id: string
          image_a_url: string | null
          image_b_url: string | null
          index_category: string | null
          intent_tag: string | null
          internal_dimension_tag: string | null
          is_active: boolean | null
          is_archived: boolean | null
          is_daily_poll: boolean | null
          is_hot_take: boolean
          is_reviewed: boolean
          needs_image_fix: boolean
          option_a: string
          option_a_tag: string | null
          option_b: string
          option_b_tag: string | null
          organization_id: string | null
          poll_type: string
          question: string
          series_id: string | null
          series_order: number | null
          series_title: string | null
          starts_at: string | null
          subtitle: string | null
          tags: string[] | null
          target_age_range: string | null
          target_countries: string[] | null
          target_country: string | null
          target_gender: string | null
          weight_score: number | null
        }
        Insert: {
          baseline_votes_a?: number
          baseline_votes_b?: number
          batch_slot?: string
          campaign_id?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          ends_at?: string | null
          expiry_type?: string
          id?: string
          image_a_url?: string | null
          image_b_url?: string | null
          index_category?: string | null
          intent_tag?: string | null
          internal_dimension_tag?: string | null
          is_active?: boolean | null
          is_archived?: boolean | null
          is_daily_poll?: boolean | null
          is_hot_take?: boolean
          is_reviewed?: boolean
          needs_image_fix?: boolean
          option_a: string
          option_a_tag?: string | null
          option_b: string
          option_b_tag?: string | null
          organization_id?: string | null
          poll_type?: string
          question: string
          series_id?: string | null
          series_order?: number | null
          series_title?: string | null
          starts_at?: string | null
          subtitle?: string | null
          tags?: string[] | null
          target_age_range?: string | null
          target_countries?: string[] | null
          target_country?: string | null
          target_gender?: string | null
          weight_score?: number | null
        }
        Update: {
          baseline_votes_a?: number
          baseline_votes_b?: number
          batch_slot?: string
          campaign_id?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          ends_at?: string | null
          expiry_type?: string
          id?: string
          image_a_url?: string | null
          image_b_url?: string | null
          index_category?: string | null
          intent_tag?: string | null
          internal_dimension_tag?: string | null
          is_active?: boolean | null
          is_archived?: boolean | null
          is_daily_poll?: boolean | null
          is_hot_take?: boolean
          is_reviewed?: boolean
          needs_image_fix?: boolean
          option_a?: string
          option_a_tag?: string | null
          option_b?: string
          option_b_tag?: string | null
          organization_id?: string | null
          poll_type?: string
          question?: string
          series_id?: string | null
          series_order?: number | null
          series_title?: string | null
          starts_at?: string | null
          subtitle?: string | null
          tags?: string[] | null
          target_age_range?: string | null
          target_countries?: string[] | null
          target_country?: string | null
          target_gender?: string | null
          weight_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "polls_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "poll_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions: {
        Row: {
          actual_majority: string | null
          created_at: string
          decision_time_ms: number | null
          id: string
          is_correct: boolean | null
          poll_id: string
          predicted_choice: string
          user_id: string | null
          voter_age_range: string | null
          voter_city: string | null
          voter_country: string | null
          voter_gender: string | null
        }
        Insert: {
          actual_majority?: string | null
          created_at?: string
          decision_time_ms?: number | null
          id?: string
          is_correct?: boolean | null
          poll_id: string
          predicted_choice: string
          user_id?: string | null
          voter_age_range?: string | null
          voter_city?: string | null
          voter_country?: string | null
          voter_gender?: string | null
        }
        Update: {
          actual_majority?: string | null
          created_at?: string
          decision_time_ms?: number | null
          id?: string
          is_correct?: boolean | null
          poll_id?: string
          predicted_choice?: string
          user_id?: string | null
          voter_age_range?: string | null
          voter_city?: string | null
          voter_country?: string | null
          voter_gender?: string | null
        }
        Relationships: []
      }
      profile_customizations: {
        Row: {
          badge_icon_url: string | null
          created_at: string | null
          id: string
          name: string
          theme_primary: string
          theme_secondary: string
        }
        Insert: {
          badge_icon_url?: string | null
          created_at?: string | null
          id?: string
          name: string
          theme_primary: string
          theme_secondary: string
        }
        Update: {
          badge_icon_url?: string | null
          created_at?: string | null
          id?: string
          name?: string
          theme_primary?: string
          theme_secondary?: string
        }
        Relationships: []
      }
      pulse_settings: {
        Row: {
          cairo_enabled: boolean
          egypt_today_enabled: boolean
          evening_verdict_enabled: boolean
          id: string
          morning_pulse_enabled: boolean
          stories_row_enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cairo_enabled?: boolean
          egypt_today_enabled?: boolean
          evening_verdict_enabled?: boolean
          id?: string
          morning_pulse_enabled?: boolean
          stories_row_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cairo_enabled?: boolean
          egypt_today_enabled?: boolean
          evening_verdict_enabled?: boolean
          id?: string
          morning_pulse_enabled?: boolean
          stories_row_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards: {
        Row: {
          cost_points: number
          created_at: string | null
          description: string
          external_url: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          partner_logo_url: string | null
          partner_name: string | null
          redemption_type: string | null
          terms_conditions: string | null
          title: string
        }
        Insert: {
          cost_points: number
          created_at?: string | null
          description: string
          external_url?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          partner_logo_url?: string | null
          partner_name?: string | null
          redemption_type?: string | null
          terms_conditions?: string | null
          title: string
        }
        Update: {
          cost_points?: number
          created_at?: string | null
          description?: string
          external_url?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          partner_logo_url?: string | null
          partner_name?: string | null
          redemption_type?: string | null
          terms_conditions?: string | null
          title?: string
        }
        Relationships: []
      }
      seeding_settings: {
        Row: {
          baseline_sunset_threshold: number
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          baseline_sunset_threshold?: number
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          baseline_sunset_threshold?: number
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      skipped_polls: {
        Row: {
          category: string | null
          created_at: string
          id: string
          poll_id: string
          session_duration_ms: number | null
          user_id: string
          voter_age_range: string | null
          voter_city: string | null
          voter_country: string | null
          voter_gender: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          poll_id: string
          session_duration_ms?: number | null
          user_id: string
          voter_age_range?: string | null
          voter_city?: string | null
          voter_country?: string | null
          voter_gender?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          poll_id?: string
          session_duration_ms?: number | null
          user_id?: string
          voter_age_range?: string | null
          voter_city?: string | null
          voter_country?: string | null
          voter_gender?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "skipped_polls_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "poll_effective_counts"
            referencedColumns: ["poll_id"]
          },
          {
            foreignKeyName: "skipped_polls_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsored_polls: {
        Row: {
          budget: number | null
          campaign_end: string
          campaign_start: string
          created_at: string | null
          id: string
          poll_id: string
          sponsor_logo_url: string | null
          sponsor_name: string
          target_age_range: string | null
          target_country: string | null
          target_gender: string | null
        }
        Insert: {
          budget?: number | null
          campaign_end: string
          campaign_start: string
          created_at?: string | null
          id?: string
          poll_id: string
          sponsor_logo_url?: string | null
          sponsor_name: string
          target_age_range?: string | null
          target_country?: string | null
          target_gender?: string | null
        }
        Update: {
          budget?: number | null
          campaign_end?: string
          campaign_start?: string
          created_at?: string | null
          id?: string
          poll_id?: string
          sponsor_logo_url?: string | null
          sponsor_name?: string
          target_age_range?: string | null
          target_country?: string | null
          target_gender?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsored_polls_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "poll_effective_counts"
            referencedColumns: ["poll_id"]
          },
          {
            foreignKeyName: "sponsored_polls_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      story_views: {
        Row: {
          cards_viewed: number
          completed: boolean
          created_at: string
          id: string
          share_taps: number
          topic: string
          updated_at: string
          user_id: string
          view_date: string
          vote_taps: number
        }
        Insert: {
          cards_viewed?: number
          completed?: boolean
          created_at?: string
          id?: string
          share_taps?: number
          topic: string
          updated_at?: string
          user_id: string
          view_date?: string
          vote_taps?: number
        }
        Update: {
          cards_viewed?: number
          completed?: boolean
          created_at?: string
          id?: string
          share_taps?: number
          topic?: string
          updated_at?: string
          user_id?: string
          view_date?: string
          vote_taps?: number
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          analytics_access: boolean | null
          created_at: string | null
          demographic_targeting: boolean | null
          description: string | null
          export_data: boolean | null
          features: Json | null
          id: string
          is_active: boolean | null
          max_polls_per_month: number | null
          name: string
          price_monthly: number
        }
        Insert: {
          analytics_access?: boolean | null
          created_at?: string | null
          demographic_targeting?: boolean | null
          description?: string | null
          export_data?: boolean | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_polls_per_month?: number | null
          name: string
          price_monthly: number
        }
        Update: {
          analytics_access?: boolean | null
          created_at?: string | null
          demographic_targeting?: boolean | null
          description?: string | null
          export_data?: boolean | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_polls_per_month?: number | null
          name?: string
          price_monthly?: number
        }
        Relationships: []
      }
      taste_snapshots: {
        Row: {
          adventure_score: number | null
          archetype: string | null
          brand_loyalty_score: number | null
          created_at: string
          data: Json | null
          id: string
          majority_pct: number | null
          minority_pct: number | null
          snapshot_date: string
          top_trait: string | null
          total_votes: number
          user_id: string
        }
        Insert: {
          adventure_score?: number | null
          archetype?: string | null
          brand_loyalty_score?: number | null
          created_at?: string
          data?: Json | null
          id?: string
          majority_pct?: number | null
          minority_pct?: number | null
          snapshot_date?: string
          top_trait?: string | null
          total_votes?: number
          user_id: string
        }
        Update: {
          adventure_score?: number | null
          archetype?: string | null
          brand_loyalty_score?: number | null
          created_at?: string
          data?: Json | null
          id?: string
          majority_pct?: number | null
          minority_pct?: number | null
          snapshot_date?: string
          top_trait?: string | null
          total_votes?: number
          user_id?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: string | null
          earned_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          badge_id?: string | null
          earned_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string | null
          earned_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_challenges: {
        Row: {
          challenge_id: string
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          id: string
          progress: number | null
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          progress?: number | null
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          progress?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_challenges_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_challenges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_customizations: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          profile_customization_id: string
          user_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          profile_customization_id: string
          user_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          profile_customization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_customizations_profile_customization_id_fkey"
            columns: ["profile_customization_id"]
            isOneToOne: false
            referencedRelation: "profile_customizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_customizations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_dimension_scores: {
        Row: {
          dimension_id: string
          id: string
          score: number
          updated_at: string
          user_id: string
          vote_count: number
        }
        Insert: {
          dimension_id: string
          id?: string
          score?: number
          updated_at?: string
          user_id: string
          vote_count?: number
        }
        Update: {
          dimension_id?: string
          id?: string
          score?: number
          updated_at?: string
          user_id?: string
          vote_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_dimension_scores_dimension_id_fkey"
            columns: ["dimension_id"]
            isOneToOne: false
            referencedRelation: "dimensions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notification_preferences: {
        Row: {
          challenge_waiting: boolean
          compatibility_change: boolean
          controversial_poll: boolean
          created_at: string
          daily_poll_batch: boolean
          friend_activity: boolean
          last_chance_poll: boolean
          missed_poll: boolean
          new_category: boolean
          predict_reveal: boolean
          streak_reminder: boolean
          updated_at: string
          user_id: string
          weekly_taste_report: boolean
        }
        Insert: {
          challenge_waiting?: boolean
          compatibility_change?: boolean
          controversial_poll?: boolean
          created_at?: string
          daily_poll_batch?: boolean
          friend_activity?: boolean
          last_chance_poll?: boolean
          missed_poll?: boolean
          new_category?: boolean
          predict_reveal?: boolean
          streak_reminder?: boolean
          updated_at?: string
          user_id: string
          weekly_taste_report?: boolean
        }
        Update: {
          challenge_waiting?: boolean
          compatibility_change?: boolean
          controversial_poll?: boolean
          created_at?: string
          daily_poll_batch?: boolean
          friend_activity?: boolean
          last_chance_poll?: boolean
          missed_poll?: boolean
          new_category?: boolean
          predict_reveal?: boolean
          streak_reminder?: boolean
          updated_at?: string
          user_id?: string
          weekly_taste_report?: boolean
        }
        Relationships: []
      }
      user_rewards: {
        Row: {
          created_at: string | null
          id: string
          partner_confirmation: string | null
          redeemed_at: string | null
          redemption_code: string | null
          reward_id: string
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          partner_confirmation?: string | null
          redeemed_at?: string | null
          redemption_code?: string | null
          reward_id: string
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          partner_confirmation?: string | null
          redeemed_at?: string | null
          redemption_code?: string | null
          reward_id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_rewards_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_rewards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_id: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          age_range: string | null
          ask_credits: number
          avatar_url: string | null
          category_interests: string[] | null
          city: string | null
          country: string | null
          created_at: string | null
          current_streak: number | null
          education_level: string | null
          email: string
          employment_status: string | null
          first_vote_date: string | null
          gender: string | null
          id: string
          income_range: string | null
          industry: string | null
          is_private: boolean
          last_daily_credit_date: string | null
          last_vote_date: string | null
          longest_streak: number | null
          points: number | null
          prediction_accuracy: number | null
          prediction_total: number | null
          total_days_active: number | null
          username: string | null
          verified_category: string | null
          verified_public_figure: boolean
        }
        Insert: {
          age_range?: string | null
          ask_credits?: number
          avatar_url?: string | null
          category_interests?: string[] | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          current_streak?: number | null
          education_level?: string | null
          email: string
          employment_status?: string | null
          first_vote_date?: string | null
          gender?: string | null
          id: string
          income_range?: string | null
          industry?: string | null
          is_private?: boolean
          last_daily_credit_date?: string | null
          last_vote_date?: string | null
          longest_streak?: number | null
          points?: number | null
          prediction_accuracy?: number | null
          prediction_total?: number | null
          total_days_active?: number | null
          username?: string | null
          verified_category?: string | null
          verified_public_figure?: boolean
        }
        Update: {
          age_range?: string | null
          ask_credits?: number
          avatar_url?: string | null
          category_interests?: string[] | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          current_streak?: number | null
          education_level?: string | null
          email?: string
          employment_status?: string | null
          first_vote_date?: string | null
          gender?: string | null
          id?: string
          income_range?: string | null
          industry?: string | null
          is_private?: boolean
          last_daily_credit_date?: string | null
          last_vote_date?: string | null
          longest_streak?: number | null
          points?: number | null
          prediction_accuracy?: number | null
          prediction_total?: number | null
          total_days_active?: number | null
          username?: string | null
          verified_category?: string | null
          verified_public_figure?: boolean
        }
        Relationships: []
      }
      votes: {
        Row: {
          category: string | null
          choice: string
          created_at: string | null
          game_context: string
          id: string
          is_public_vote: boolean
          poll_id: string
          session_duration_ms: number | null
          user_id: string | null
          voter_age_range: string | null
          voter_city: string | null
          voter_country: string | null
          voter_gender: string | null
        }
        Insert: {
          category?: string | null
          choice: string
          created_at?: string | null
          game_context?: string
          id?: string
          is_public_vote?: boolean
          poll_id: string
          session_duration_ms?: number | null
          user_id?: string | null
          voter_age_range?: string | null
          voter_city?: string | null
          voter_country?: string | null
          voter_gender?: string | null
        }
        Update: {
          category?: string | null
          choice?: string
          created_at?: string | null
          game_context?: string
          id?: string
          is_public_vote?: boolean
          poll_id?: string
          session_duration_ms?: number | null
          user_id?: string | null
          voter_age_range?: string | null
          voter_city?: string | null
          voter_country?: string | null
          voter_gender?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "poll_effective_counts"
            referencedColumns: ["poll_id"]
          },
          {
            foreignKeyName: "votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_leaderboard: {
        Row: {
          created_at: string
          id: string
          rank: number | null
          user_id: string
          week_start: string
          weekly_points: number
        }
        Insert: {
          created_at?: string
          id?: string
          rank?: number | null
          user_id: string
          week_start: string
          weekly_points?: number
        }
        Update: {
          created_at?: string
          id?: string
          rank?: number | null
          user_id?: string
          week_start?: string
          weekly_points?: number
        }
        Relationships: []
      }
    }
    Views: {
      poll_effective_counts: {
        Row: {
          baseline_active: boolean | null
          baseline_votes_a: number | null
          baseline_votes_b: number | null
          effective_votes_a: number | null
          effective_votes_b: number | null
          poll_id: string | null
          real_total: number | null
          real_votes_a: number | null
          real_votes_b: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_campaign_drip_schedule: {
        Args: { p_campaign_id: string }
        Returns: Json
      }
      assemble_focus_group_panel: {
        Args: {
          p_age_range?: string
          p_campaign_id: string
          p_city?: string
          p_gender?: string
          p_target_size: number
        }
        Returns: number
      }
      can_send_notification: {
        Args: {
          p_notification_type: string
          p_priority: number
          p_user_id: string
        }
        Returns: Json
      }
      count_eligible_panelists: {
        Args: { p_age_range?: string; p_city?: string; p_gender?: string }
        Returns: number
      }
      earn_ask_credits: {
        Args: { p_amount: number; p_user_id: string }
        Returns: number
      }
      generate_daily_queue: {
        Args: { p_user_id: string }
        Returns: {
          poll_id: string
          queue_order: number
        }[]
      }
      generate_redemption_code: { Args: never; Returns: string }
      get_all_polls_for_history: {
        Args: never
        Returns: {
          category: string
          created_at: string
          created_by: string
          ends_at: string
          id: string
          image_a_url: string
          image_b_url: string
          is_active: boolean
          is_daily_poll: boolean
          option_a: string
          option_b: string
          question: string
          starts_at: string
        }[]
      }
      get_ask_versa_analytics: { Args: { p_days?: number }; Returns: Json }
      get_campaign_analytics: {
        Args: { p_campaign_id: string }
        Returns: {
          option_a: string
          option_b: string
          percent_a: number
          percent_b: number
          poll_id: string
          question: string
          total_votes: number
          votes_a: number
          votes_b: number
        }[]
      }
      get_campaign_attribute_scores: {
        Args: { p_campaign_id: string }
        Returns: {
          attribute: string
          mean_score: number
          poll_id: string
          question: string
          t2b_score: number
          total_responses: number
        }[]
      }
      get_campaign_demographics: {
        Args: { p_campaign_id: string }
        Returns: {
          choice: string
          segment_type: string
          segment_value: string
          vote_count: number
        }[]
      }
      get_campaign_drip_preview: {
        Args: { p_campaign_id: string }
        Returns: {
          is_active: boolean
          poll_id: string
          question: string
          release_date: string
          release_day: number
          series_order: number
          starts_at: string
        }[]
      }
      get_campaign_rank_matrix: {
        Args: { p_campaign_id: string }
        Returns: {
          baseline_pct_a: number
          delta: number
          pct_a: number
          poll_id: string
          question: string
          segment_type: string
          segment_value: string
          significant: boolean
          total_in_segment: number
        }[]
      }
      get_campaign_verbatims: {
        Args: { p_campaign_id: string; p_limit_per_poll?: number }
        Returns: {
          choice: string
          created_at: string
          feedback: string
          option_label: string
          poll_id: string
          question: string
          voter_age_range: string
          voter_city: string
          voter_gender: string
        }[]
      }
      get_compatibility_score: {
        Args: { user_a: string; user_b: string }
        Returns: number
      }
      get_compatibility_trend: {
        Args: { user_a: string; user_b: string }
        Returns: {
          older_score: number
          overall_score: number
          recent_score: number
          trend: string
          trend_change: number
        }[]
      }
      get_demographic_poll_result: {
        Args: { p_age_range?: string; p_city?: string; p_poll_id: string }
        Returns: {
          demo_percent_a: number
          demo_percent_b: number
          demo_total: number
          percent_a: number
          percent_b: number
          total_votes: number
        }[]
      }
      get_dimension_compatibility: {
        Args: { user_a: string; user_b: string }
        Returns: {
          alignment: number
          dimension_name: string
          shared_dimensions: number
          user_a_score: number
          user_b_score: number
        }[]
      }
      get_focus_group_stats: {
        Args: { p_campaign_id: string }
        Returns: {
          accepted_count: number
          completed_count: number
          completion_rate: number
          dropped_count: number
          invited_count: number
          total_panelists: number
        }[]
      }
      get_friend_votes: {
        Args: { p_poll_id: string; p_user_id: string }
        Returns: {
          choice: string
          compatibility_score: number
          friend_avatar_url: string
          friend_id: string
          friend_username: string
        }[]
      }
      get_friends_with_scores: {
        Args: { p_user_id: string }
        Returns: {
          compatibility_score: number
          friend_avatar_url: string
          friend_id: string
          friend_points: number
          friend_username: string
          friendship_created_at: string
        }[]
      }
      get_friends_with_trends: {
        Args: { p_user_id: string }
        Returns: {
          compatibility_score: number
          friend_avatar_url: string
          friend_id: string
          friend_points: number
          friend_username: string
          friendship_created_at: string
          recent_score: number
          trend: string
          trend_change: number
        }[]
      }
      get_insight_profile: {
        Args: { p_user_id: string }
        Returns: {
          dimension_name: string
          score: number
          tendency: string
          vote_count: number
        }[]
      }
      get_leaderboard: {
        Args: { limit_count?: number; order_by?: string }
        Returns: {
          avatar_url: string
          current_streak: number
          id: string
          longest_streak: number
          points: number
          username: string
        }[]
      }
      get_my_client_campaigns: {
        Args: never
        Returns: {
          brand_logo_url: string
          brand_name: string
          campaign_id: string
          description: string
          expires_at: string
          is_active: boolean
          name: string
          poll_count: number
          release_at: string
          total_votes: number
        }[]
      }
      get_notification_analytics: {
        Args: { p_days?: number }
        Returns: {
          by_type: Json
          daily_volume: Json
          total_period: number
          total_today: number
          users_disabled_all: number
        }[]
      }
      get_or_create_conversation: {
        Args: { _other_user_id: string }
        Returns: string
      }
      get_perception_gap: {
        Args: { p_poll_id: string }
        Returns: {
          actual_a_pct: number
          actual_b_pct: number
          gap_a: number
          gap_b: number
          predicted_a_pct: number
          predicted_b_pct: number
          total_predictions: number
        }[]
      }
      get_poll_results: {
        Args: { poll_ids: string[] }
        Returns: {
          baseline_active: boolean
          percent_a: number
          percent_b: number
          poll_id: string
          real_total: number
          total_votes: number
          votes_a: number
          votes_b: number
        }[]
      }
      get_public_profiles: {
        Args: { user_ids?: string[] }
        Returns: {
          avatar_url: string
          created_at: string
          current_streak: number
          id: string
          is_private: boolean
          longest_streak: number
          points: number
          username: string
        }[]
      }
      get_shared_vote_history: {
        Args: { user_a: string; user_b: string }
        Returns: {
          is_match: boolean
          option_a: string
          option_b: string
          poll_id: string
          question: string
          user_a_choice: string
          user_b_choice: string
          voted_at: string
        }[]
      }
      get_similar_voters: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          avatar_url: string
          matching_votes: number
          points: number
          shared_polls: number
          similarity_score: number
          user_id: string
          username: string
        }[]
      }
      get_user_badge_count: {
        Args: { target_user_id: string }
        Returns: {
          badge_description: string
          badge_id: string
          badge_name: string
          earned_at: string
        }[]
      }
      get_user_conversations: {
        Args: { p_user_id: string }
        Returns: {
          conversation_id: string
          last_message_at: string
          last_message_preview: string
          last_message_type: string
          last_sender_id: string
          other_avatar_url: string
          other_user_id: string
          other_username: string
          unread_count: number
        }[]
      }
      get_user_voting_traits: {
        Args: { p_user_id: string }
        Returns: {
          tag: string
          vote_count: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_campaign_client: {
        Args: { _campaign_id: string; _user_id: string }
        Returns: boolean
      }
      is_campaign_panelist: {
        Args: { _campaign_id: string; _user_id: string }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { _conv_id: string; _user_id: string }
        Returns: boolean
      }
      is_poll_expired: {
        Args: { p_ends_at: string; p_expiry_type: string }
        Returns: boolean
      }
      log_notification_sent: {
        Args: {
          p_channel?: string
          p_data?: Json
          p_notification_type: string
          p_priority: number
          p_user_id: string
        }
        Returns: string
      }
      redeem_reward: {
        Args: {
          p_cost_points: number
          p_redemption_code: string
          p_reward_id: string
          p_user_id: string
        }
        Returns: Json
      }
      search_users_by_username: {
        Args: { current_user_id: string; search_term: string }
        Returns: {
          avatar_url: string
          friendship_status: string
          id: string
          points: number
          username: string
        }[]
      }
      spend_ask_credits: {
        Args: { p_amount: number; p_user_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user" | "creator" | "brand_client"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "creator", "brand_client"],
    },
  },
} as const
