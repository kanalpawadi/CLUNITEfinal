// Generated-style Supabase types for supabase/schema.sql.
// Regenerate after schema changes (see supabase/README.md):
//   npx supabase gen types typescript --project-id <ref> --schema public > types/database.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12.2.3"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          checked_in_at: string
          checked_in_by: string | null
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          checked_in_at?: string
          checked_in_by?: string | null
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          checked_in_at?: string
          checked_in_by?: string | null
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          { foreignKeyName: "attendance_checked_in_by_fkey"; columns: ["checked_in_by"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
          { foreignKeyName: "attendance_event_id_fkey"; columns: ["event_id"]; isOneToOne: false; referencedRelation: "events"; referencedColumns: ["id"] },
          { foreignKeyName: "attendance_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
        ]
      }
      club_access_otps: {
        Row: {
          club_id: string
          code: string
          created_at: string
          expires_at: string
          id: string
          sent_to_email: string
          status: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          club_id: string
          code: string
          created_at?: string
          expires_at: string
          id?: string
          sent_to_email: string
          status?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          club_id?: string
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          sent_to_email?: string
          status?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          { foreignKeyName: "club_access_otps_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "club_access_otps_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
        ]
      }
      club_memberships: {
        Row: {
          club_id: string
          expires_at: string | null
          id: string
          invited_at: string | null
          invited_by: string | null
          is_owner: boolean | null
          joined_at: string
          member_code: string | null
          plan_id: string | null
          role: Database["public"]["Enums"]["club_role"]
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string
          verified_via_pin: boolean
        }
        Insert: {
          club_id: string
          expires_at?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_owner?: never
          joined_at?: string
          member_code?: string | null
          plan_id?: string | null
          role?: Database["public"]["Enums"]["club_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id: string
          verified_via_pin?: boolean
        }
        Update: {
          club_id?: string
          expires_at?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_owner?: never
          joined_at?: string
          member_code?: string | null
          plan_id?: string | null
          role?: Database["public"]["Enums"]["club_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string
          verified_via_pin?: boolean
        }
        Relationships: [
          { foreignKeyName: "club_memberships_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "club_memberships_invited_by_fkey"; columns: ["invited_by"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
          { foreignKeyName: "club_memberships_plan_id_fkey"; columns: ["plan_id"]; isOneToOne: false; referencedRelation: "membership_plans"; referencedColumns: ["id"] },
          { foreignKeyName: "club_memberships_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
        ]
      }
      clubs: {
        Row: {
          banner_url: string | null
          category: string | null
          college: string | null
          contact_email: string | null
          created_at: string
          created_by: string | null
          credibility_score: number
          description: string | null
          events_hosted_count: number
          faculty_in_charge: string | null
          founding_date: string | null
          hod_name: string | null
          id: string
          is_active: boolean
          is_verified: boolean
          logo_url: string | null
          members_count: number
          name: string
          official_email: string | null
          requires_approval: boolean
          slug: string
          social_links: Json | null
          tagline: string | null
          updated_at: string
          vision: string | null
        }
        Insert: {
          banner_url?: string | null
          category?: string | null
          college?: string | null
          contact_email?: string | null
          created_at?: string
          created_by?: string | null
          credibility_score?: number
          description?: string | null
          events_hosted_count?: number
          faculty_in_charge?: string | null
          founding_date?: string | null
          hod_name?: string | null
          id?: string
          is_active?: boolean
          is_verified?: boolean
          logo_url?: string | null
          members_count?: number
          name: string
          official_email?: string | null
          requires_approval?: boolean
          slug?: string
          social_links?: Json | null
          tagline?: string | null
          updated_at?: string
          vision?: string | null
        }
        Update: {
          banner_url?: string | null
          category?: string | null
          college?: string | null
          contact_email?: string | null
          created_at?: string
          created_by?: string | null
          credibility_score?: number
          description?: string | null
          events_hosted_count?: number
          faculty_in_charge?: string | null
          founding_date?: string | null
          hod_name?: string | null
          id?: string
          is_active?: boolean
          is_verified?: boolean
          logo_url?: string | null
          members_count?: number
          name?: string
          official_email?: string | null
          requires_approval?: boolean
          slug?: string
          social_links?: Json | null
          tagline?: string | null
          updated_at?: string
          vision?: string | null
        }
        Relationships: [
          { foreignKeyName: "clubs_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
        ]
      }
      event_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          incurred_at: string
          notes: string | null
          payment_id: string | null
          payment_method: string | null
          type: "income" | "expense"
          vendor: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          incurred_at?: string
          notes?: string | null
          payment_id?: string | null
          payment_method?: string | null
          type?: "income" | "expense"
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          incurred_at?: string
          notes?: string | null
          payment_id?: string | null
          payment_method?: string | null
          type?: "income" | "expense"
          vendor?: string | null
        }
        Relationships: [
          { foreignKeyName: "event_expenses_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
          { foreignKeyName: "event_expenses_event_id_fkey"; columns: ["event_id"]; isOneToOne: false; referencedRelation: "events"; referencedColumns: ["id"] },
          { foreignKeyName: "event_expenses_payment_id_fkey"; columns: ["payment_id"]; isOneToOne: false; referencedRelation: "payments"; referencedColumns: ["id"] },
        ]
      }
      event_registrations: {
        Row: {
          created_at: string
          event_id: string
          id: string
          invite_code: string | null
          participant_count: number
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          registration_data: Json | null
          status: Database["public"]["Enums"]["registration_status"]
          team_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          invite_code?: string | null
          participant_count?: number
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          registration_data?: Json | null
          status?: Database["public"]["Enums"]["registration_status"]
          team_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          invite_code?: string | null
          participant_count?: number
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          registration_data?: Json | null
          status?: Database["public"]["Enums"]["registration_status"]
          team_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          { foreignKeyName: "event_registrations_event_id_fkey"; columns: ["event_id"]; isOneToOne: false; referencedRelation: "events"; referencedColumns: ["id"] },
          { foreignKeyName: "event_registrations_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
        ]
      }
      events: {
        Row: {
          capacity: number | null
          category: string | null
          club_id: string
          college: string | null
          contact_info: Json | null
          created_at: string
          created_by: string | null
          current_participants: number
          description: string | null
          duration: string | null
          ends_at: string | null
          fee: number
          id: string
          image_url: string | null
          is_published: boolean | null
          level: string | null
          mode: string
          prize_pool: number | null
          registration_deadline: string | null
          requirements: string[] | null
          starts_at: string
          status: string
          tags: string[] | null
          team_size: string | null
          title: string
          type: string | null
          updated_at: string
          venue: string | null
          views: number
        }
        Insert: {
          capacity?: number | null
          category?: string | null
          club_id: string
          college?: string | null
          contact_info?: Json | null
          created_at?: string
          created_by?: string | null
          current_participants?: number
          description?: string | null
          duration?: string | null
          ends_at?: string | null
          fee?: number
          id?: string
          image_url?: string | null
          is_published?: never
          level?: string | null
          mode?: string
          prize_pool?: number | null
          registration_deadline?: string | null
          requirements?: string[] | null
          starts_at: string
          status?: string
          tags?: string[] | null
          team_size?: string | null
          title: string
          type?: string | null
          updated_at?: string
          venue?: string | null
          views?: number
        }
        Update: {
          capacity?: number | null
          category?: string | null
          club_id?: string
          college?: string | null
          contact_info?: Json | null
          created_at?: string
          created_by?: string | null
          current_participants?: number
          description?: string | null
          duration?: string | null
          ends_at?: string | null
          fee?: number
          id?: string
          image_url?: string | null
          is_published?: never
          level?: string | null
          mode?: string
          prize_pool?: number | null
          registration_deadline?: string | null
          requirements?: string[] | null
          starts_at?: string
          status?: string
          tags?: string[] | null
          team_size?: string | null
          title?: string
          type?: string | null
          updated_at?: string
          venue?: string | null
          views?: number
        }
        Relationships: [
          { foreignKeyName: "events_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "events_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
        ]
      }
      id_credentials: {
        Row: {
          club_id: string | null
          credential_type: Database["public"]["Enums"]["credential_type"]
          id: string
          issued_at: string
          revoked_at: string | null
          token_version: number
          user_id: string
        }
        Insert: {
          club_id?: string | null
          credential_type?: Database["public"]["Enums"]["credential_type"]
          id?: string
          issued_at?: string
          revoked_at?: string | null
          token_version?: number
          user_id: string
        }
        Update: {
          club_id?: string | null
          credential_type?: Database["public"]["Enums"]["credential_type"]
          id?: string
          issued_at?: string
          revoked_at?: string | null
          token_version?: number
          user_id?: string
        }
        Relationships: [
          { foreignKeyName: "id_credentials_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "id_credentials_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
        ]
      }
      membership_plans: {
        Row: {
          benefits: Json
          club_id: string
          created_at: string
          currency: string
          duration_days: number | null
          id: string
          is_active: boolean
          name: string
          price: number
          tier: Database["public"]["Enums"]["membership_tier"]
          updated_at: string
        }
        Insert: {
          benefits?: Json
          club_id: string
          created_at?: string
          currency?: string
          duration_days?: number | null
          id?: string
          is_active?: boolean
          name: string
          price?: number
          tier: Database["public"]["Enums"]["membership_tier"]
          updated_at?: string
        }
        Update: {
          benefits?: Json
          club_id?: string
          created_at?: string
          currency?: string
          duration_days?: number | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          tier?: Database["public"]["Enums"]["membership_tier"]
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "membership_plans_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ]
      }
      payments: {
        Row: {
          amount: number
          club_id: string | null
          created_at: string
          currency: string
          event_id: string | null
          failure_reason: string | null
          id: string
          membership_id: string | null
          paid_at: string | null
          plan_id: string | null
          provider: "mock" | "razorpay"
          purpose: "event" | "membership"
          razorpay_order_id: string
          razorpay_payment_id: string | null
          receipt_no: string | null
          registration_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          club_id?: string | null
          created_at?: string
          currency?: string
          event_id?: string | null
          failure_reason?: string | null
          id?: string
          membership_id?: string | null
          paid_at?: string | null
          plan_id?: string | null
          provider?: "mock" | "razorpay"
          purpose: "event" | "membership"
          razorpay_order_id: string
          razorpay_payment_id?: string | null
          receipt_no?: string | null
          registration_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          club_id?: string | null
          created_at?: string
          currency?: string
          event_id?: string | null
          failure_reason?: string | null
          id?: string
          membership_id?: string | null
          paid_at?: string | null
          plan_id?: string | null
          provider?: "mock" | "razorpay"
          purpose?: "event" | "membership"
          razorpay_order_id?: string
          razorpay_payment_id?: string | null
          receipt_no?: string | null
          registration_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          { foreignKeyName: "payments_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "payments_event_id_fkey"; columns: ["event_id"]; isOneToOne: false; referencedRelation: "events"; referencedColumns: ["id"] },
          { foreignKeyName: "payments_membership_id_fkey"; columns: ["membership_id"]; isOneToOne: false; referencedRelation: "club_memberships"; referencedColumns: ["id"] },
          { foreignKeyName: "payments_plan_id_fkey"; columns: ["plan_id"]; isOneToOne: false; referencedRelation: "membership_plans"; referencedColumns: ["id"] },
          { foreignKeyName: "payments_registration_id_fkey"; columns: ["registration_id"]; isOneToOne: false; referencedRelation: "event_registrations"; referencedColumns: ["id"] },
          { foreignKeyName: "payments_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
        ]
      }
      pending_clubs: {
        Row: {
          club_data: Json
          club_id: string | null
          created_at: string
          created_by: string | null
          expires_at: string
          first_used_at: string | null
          first_used_by: string | null
          id: string
          max_uses: number
          official_email: string
          pin: string
          president_email: string | null
          president_name: string | null
          president_phone: string | null
          status: string
          used_count: number
        }
        Insert: {
          club_data: Json
          club_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string
          first_used_at?: string | null
          first_used_by?: string | null
          id?: string
          max_uses?: number
          official_email: string
          pin: string
          president_email?: string | null
          president_name?: string | null
          president_phone?: string | null
          status?: string
          used_count?: number
        }
        Update: {
          club_data?: Json
          club_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string
          first_used_at?: string | null
          first_used_by?: string | null
          id?: string
          max_uses?: number
          official_email?: string
          pin?: string
          president_email?: string | null
          president_name?: string | null
          president_phone?: string | null
          status?: string
          used_count?: number
        }
        Relationships: [
          { foreignKeyName: "pending_clubs_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "pending_clubs_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
          { foreignKeyName: "pending_clubs_first_used_by_fkey"; columns: ["first_used_by"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          bio: string | null
          branch: string | null
          college: string | null
          created_at: string
          email: string
          full_name: string | null
          gender: string | null
          global_role: Database["public"]["Enums"]["global_role"]
          id: string
          interests: string[]
          phone: string | null
          show_on_leaderboard: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          branch?: string | null
          college?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          gender?: string | null
          global_role?: Database["public"]["Enums"]["global_role"]
          id: string
          interests?: string[]
          phone?: string | null
          show_on_leaderboard?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          branch?: string | null
          college?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          gender?: string | null
          global_role?: Database["public"]["Enums"]["global_role"]
          id?: string
          interests?: string[]
          phone?: string | null
          show_on_leaderboard?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      event_rounds: {
        Row: {
          created_at: string
          description: string | null
          ends_at: string
          event_id: string
          id: string
          max_score: number
          results_published: boolean
          round_no: number
          starts_at: string
          submission_type: "none" | "link" | "file" | "text"
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          ends_at: string
          event_id: string
          id?: string
          max_score?: number
          results_published?: boolean
          round_no: number
          starts_at: string
          submission_type?: "none" | "link" | "file" | "text"
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          ends_at?: string
          event_id?: string
          id?: string
          max_score?: number
          results_published?: boolean
          round_no?: number
          starts_at?: string
          submission_type?: "none" | "link" | "file" | "text"
          title?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "event_rounds_event_id_fkey"; columns: ["event_id"]; isOneToOne: false; referencedRelation: "events"; referencedColumns: ["id"] },
        ]
      }
      round_submissions: {
        Row: {
          feedback: string | null
          file_path: string | null
          id: string
          judged_at: string | null
          judged_by: string | null
          link_url: string | null
          registration_id: string
          round_id: string
          score: number | null
          status: "submitted" | "shortlisted" | "eliminated"
          submitted_at: string | null
          submitted_by: string | null
          text_content: string | null
        }
        Insert: {
          feedback?: string | null
          file_path?: string | null
          id?: string
          judged_at?: string | null
          judged_by?: string | null
          link_url?: string | null
          registration_id: string
          round_id: string
          score?: number | null
          status?: "submitted" | "shortlisted" | "eliminated"
          submitted_at?: string | null
          submitted_by?: string | null
          text_content?: string | null
        }
        Update: {
          feedback?: string | null
          file_path?: string | null
          id?: string
          judged_at?: string | null
          judged_by?: string | null
          link_url?: string | null
          registration_id?: string
          round_id?: string
          score?: number | null
          status?: "submitted" | "shortlisted" | "eliminated"
          submitted_at?: string | null
          submitted_by?: string | null
          text_content?: string | null
        }
        Relationships: [
          { foreignKeyName: "round_submissions_round_id_fkey"; columns: ["round_id"]; isOneToOne: false; referencedRelation: "event_rounds"; referencedColumns: ["id"] },
          { foreignKeyName: "round_submissions_registration_id_fkey"; columns: ["registration_id"]; isOneToOne: false; referencedRelation: "event_registrations"; referencedColumns: ["id"] },
          { foreignKeyName: "round_submissions_submitted_by_fkey"; columns: ["submitted_by"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
          { foreignKeyName: "round_submissions_judged_by_fkey"; columns: ["judged_by"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
        ]
      }
      event_results: {
        Row: {
          created_at: string
          event_id: string
          id: string
          position: number
          published: boolean
          registration_id: string
          title: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          position: number
          published?: boolean
          registration_id: string
          title: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          position?: number
          published?: boolean
          registration_id?: string
          title?: string
        }
        Relationships: [
          { foreignKeyName: "event_results_event_id_fkey"; columns: ["event_id"]; isOneToOne: false; referencedRelation: "events"; referencedColumns: ["id"] },
          { foreignKeyName: "event_results_registration_id_fkey"; columns: ["registration_id"]; isOneToOne: false; referencedRelation: "event_registrations"; referencedColumns: ["id"] },
        ]
      }
      event_bookmarks: {
        Row: {
          created_at: string
          event_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          user_id?: string
        }
        Relationships: [
          { foreignKeyName: "event_bookmarks_event_id_fkey"; columns: ["event_id"]; isOneToOne: false; referencedRelation: "events"; referencedColumns: ["id"] },
          { foreignKeyName: "event_bookmarks_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
        ]
      }
      team_members: {
        Row: {
          joined_at: string
          registration_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          registration_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          registration_id?: string
          user_id?: string
        }
        Relationships: [
          { foreignKeyName: "team_members_registration_id_fkey"; columns: ["registration_id"]; isOneToOne: false; referencedRelation: "event_registrations"; referencedColumns: ["id"] },
          { foreignKeyName: "team_members_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
        ]
      }
      team_finder_posts: {
        Row: {
          created_at: string
          event_id: string
          id: string
          kind: "need_team" | "need_members"
          message: string
          show_contact: boolean
          skills: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          kind: "need_team" | "need_members"
          message: string
          show_contact?: boolean
          skills?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          kind?: "need_team" | "need_members"
          message?: string
          show_contact?: boolean
          skills?: string[]
          user_id?: string
        }
        Relationships: [
          { foreignKeyName: "team_finder_posts_event_id_fkey"; columns: ["event_id"]; isOneToOne: false; referencedRelation: "events"; referencedColumns: ["id"] },
          { foreignKeyName: "team_finder_posts_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
        ]
      }
    }
    Views: {
      pending_clubs_public: {
        Row: {
          club_data: Json | null
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string | null
          official_email: string | null
          status: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_club_staff: {
        Args: { p_club_id: string; p_email: string; p_role?: Database["public"]["Enums"]["club_role"] }
        Returns: Json
      }
      can_self_activate: { Args: { club: string; plan: string }; Returns: boolean }
      can_view_user: { Args: { target: string }; Returns: boolean }
      expire_memberships: { Args: Record<PropertyKey, never>; Returns: number }
      finalize_payment: {
        Args: { p_failure_reason?: string; p_order_id: string; p_payment_id: string; p_success: boolean }
        Returns: Database["public"]["Tables"]["payments"]["Row"]
      }
      get_club_leaderboard: {
        Args: { p_days?: number; p_limit?: number }
        Returns: {
          rank: number
          club_id: string
          name: string
          slug: string
          logo_url: string | null
          category: string | null
          members: number
          events: number
          attendance: number
          points: number
        }[]
      }
      get_student_leaderboard: {
        Args: { p_days?: number; p_limit?: number }
        Returns: {
          rank: number
          display_name: string
          avatar_url: string | null
          college: string | null
          points: number
          events_attended: number
          registrations: number
          clubs_joined: number
          is_me: boolean
        }[]
      }
      submit_round_entry: {
        Args: { p_round_id: string; p_link_url?: string; p_text?: string; p_file_path?: string }
        Returns: Database["public"]["Tables"]["round_submissions"]["Row"]
      }
      judge_round_entry: {
        Args: { p_round_id: string; p_registration_id: string; p_score?: number; p_status?: string; p_feedback?: string }
        Returns: Database["public"]["Tables"]["round_submissions"]["Row"]
      }
      get_event_leaderboard: {
        Args: { p_event_id: string }
        Returns: { rank: number; name: string; total_score: number; rounds_cleared: number; result_title: string | null; is_mine: boolean }[]
      }
      is_registration_member: { Args: { reg: string }; Returns: boolean }
      get_team_roster: {
        Args: { p_registration_id: string }
        Returns: { name: string; is_lead: boolean; is_me: boolean; joined_at: string }[]
      }
      join_team: { Args: { p_code: string }; Returns: string }
      rotate_invite_code: { Args: { p_registration_id: string }; Returns: string }
      team_capacity: { Args: { p_team_size: string }; Returns: number }
      preview_team_invite: {
        Args: { p_code: string }
        Returns: { event_id: string; event_title: string; team_name: string | null; lead_first_name: string; members: number; capacity: number }[]
      }
      get_team_finder_posts: {
        Args: { p_event_id: string }
        Returns: { id: string; kind: "need_team" | "need_members"; skills: string[]; message: string; created_at: string; author: string; avatar_url: string | null; college: string | null; contact_email: string | null; is_mine: boolean }[]
      }
      increment_event_views: { Args: { p_event_id: string }; Returns: undefined }
      is_club_role: {
        Args: { club: string; roles: Database["public"]["Enums"]["club_role"][] }
        Returns: boolean
      }
      is_event_staff: {
        Args: { event: string; roles: Database["public"]["Enums"]["club_role"][] }
        Returns: boolean
      }
      is_super_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
      is_trusted_caller: { Args: Record<PropertyKey, never>; Returns: boolean }
      register_for_event: {
        Args: {
          p_event_id: string
          p_participant_count?: number
          p_registration_data?: Json
          p_team_name?: string
        }
        Returns: Database["public"]["Tables"]["event_registrations"]["Row"]
      }
      slugify: { Args: { input: string }; Returns: string }
      verify_and_create_club: {
        Args: { p_banner_url?: string; p_pending_club_id: string; p_pin: string }
        Returns: Database["public"]["Tables"]["clubs"]["Row"]
      }
    }
    Enums: {
      club_role: "owner" | "admin" | "organizer" | "treasurer" | "member" | "guest"
      credential_type: "member_id" | "event_pass" | "staff_pass"
      global_role: "super_admin" | "user"
      membership_status: "pending" | "active" | "suspended" | "expired" | "cancelled"
      membership_tier: "free" | "standard" | "premium" | "lifetime"
      payment_status: "created" | "paid" | "failed" | "refunded"
      registration_status: "registered" | "waitlisted" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]

export const CLUB_ROLES = ["owner", "admin", "organizer", "treasurer", "member", "guest"] as const
export const STAFF_ROLES = ["owner", "admin", "organizer", "treasurer"] as const satisfies readonly Enums<"club_role">[]
export const MANAGER_ROLES = ["owner", "admin", "organizer"] as const satisfies readonly Enums<"club_role">[]
export const FINANCE_ROLES = ["owner", "admin", "treasurer"] as const satisfies readonly Enums<"club_role">[]
