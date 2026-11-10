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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          actor: string | null
          brand_id: string
          content_item_id: string | null
          created_at: string
          details: Json
          id: string
        }
        Insert: {
          action: string
          actor?: string | null
          brand_id: string
          content_item_id?: string | null
          created_at?: string
          details?: Json
          id?: string
        }
        Update: {
          action?: string
          actor?: string | null
          brand_id?: string
          content_item_id?: string | null
          created_at?: string
          details?: Json
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_rules: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          replaces: string | null
          text: string
          type: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          replaces?: string | null
          text: string
          type: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          replaces?: string | null
          text?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_rules_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          brand_story: string
          created_at: string
          default_sliders: Json
          description: string
          emoji_policy: string
          exclamation_channels: Json
          id: string
          industry: string
          is_demo: boolean
          language: string
          name: string
          number_format: string
          sound_like: Json
          spelling_variant: string
          updated_at: string
          voice_adjectives: string[]
          website: string
          workspace_id: string
        }
        Insert: {
          brand_story?: string
          created_at?: string
          default_sliders?: Json
          description?: string
          emoji_policy?: string
          exclamation_channels?: Json
          id?: string
          industry?: string
          is_demo?: boolean
          language?: string
          name?: string
          number_format?: string
          sound_like?: Json
          spelling_variant?: string
          updated_at?: string
          voice_adjectives?: string[]
          website?: string
          workspace_id: string
        }
        Update: {
          brand_story?: string
          created_at?: string
          default_sliders?: Json
          description?: string
          emoji_policy?: string
          exclamation_channels?: Json
          id?: string
          industry?: string
          is_demo?: boolean
          language?: string
          name?: string
          number_format?: string
          sound_like?: Json
          spelling_variant?: string
          updated_at?: string
          voice_adjectives?: string[]
          website?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brands_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          ai_review: Json | null
          approved_at: string | null
          approved_by: string | null
          brand_id: string
          brand_score: number | null
          change_note: string | null
          channel: string
          created_at: string
          created_by: string
          fields: Json
          flags: Json
          id: string
          request_id: string | null
          status: string
          updated_at: string
          variant_of: string | null
          writer_model: string | null
        }
        Insert: {
          ai_review?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          brand_id: string
          brand_score?: number | null
          change_note?: string | null
          channel: string
          created_at?: string
          created_by: string
          fields?: Json
          flags?: Json
          id?: string
          request_id?: string | null
          status?: string
          updated_at?: string
          variant_of?: string | null
          writer_model?: string | null
        }
        Update: {
          ai_review?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          brand_id?: string
          brand_score?: number | null
          change_note?: string | null
          channel?: string
          created_at?: string
          created_by?: string
          fields?: Json
          flags?: Json
          id?: string
          request_id?: string | null
          status?: string
          updated_at?: string
          variant_of?: string | null
          writer_model?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_items_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "content_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_variant_of_fkey"
            columns: ["variant_of"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      content_requests: {
        Row: {
          brand_id: string
          brief: string
          channels: string[]
          created_at: string
          created_by: string
          example_ids: string[]
          goal_id: string | null
          hashtags: Json
          id: string
          key_facts: Json
          link: string | null
          model: string | null
          persona_id: string | null
          sliders: Json
        }
        Insert: {
          brand_id: string
          brief: string
          channels?: string[]
          created_at?: string
          created_by: string
          example_ids?: string[]
          goal_id?: string | null
          hashtags?: Json
          id?: string
          key_facts?: Json
          link?: string | null
          model?: string | null
          persona_id?: string | null
          sliders?: Json
        }
        Update: {
          brand_id?: string
          brief?: string
          channels?: string[]
          created_at?: string
          created_by?: string
          example_ids?: string[]
          goal_id?: string | null
          hashtags?: Json
          id?: string
          key_facts?: Json
          link?: string | null
          model?: string | null
          persona_id?: string | null
          sliders?: Json
        }
        Relationships: [
          {
            foreignKeyName: "content_requests_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_requests_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_requests_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      content_versions: {
        Row: {
          brand_id: string
          content_item_id: string
          created_at: string
          created_by: string | null
          fields: Json
          id: string
          model: string | null
          note: string
        }
        Insert: {
          brand_id: string
          content_item_id: string
          created_at?: string
          created_by?: string | null
          fields: Json
          id?: string
          model?: string | null
          note: string
        }
        Update: {
          brand_id?: string
          content_item_id?: string
          created_at?: string
          created_by?: string | null
          fields?: Json
          id?: string
          model?: string | null
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_versions_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      examples: {
        Row: {
          body: string
          brand_id: string
          channel: string
          created_at: string
          id: string
          label: string
          notes: string
          title: string
        }
        Insert: {
          body: string
          brand_id: string
          channel?: string
          created_at?: string
          id?: string
          label?: string
          notes?: string
          title?: string
        }
        Update: {
          body?: string
          brand_id?: string
          channel?: string
          created_at?: string
          id?: string
          label?: string
          notes?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "examples_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      facts: {
        Row: {
          brand_id: string
          checked_at: string | null
          created_at: string
          fact: string
          id: string
          source: string
          value: string
        }
        Insert: {
          brand_id: string
          checked_at?: string | null
          created_at?: string
          fact: string
          id?: string
          source?: string
          value?: string
        }
        Update: {
          brand_id?: string
          checked_at?: string | null
          created_at?: string
          fact?: string
          id?: string
          source?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "facts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          brand_id: string
          created_at: string
          cta_type: string
          description: string
          id: string
          name: string
          success_measure: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          cta_type?: string
          description?: string
          id?: string
          name: string
          success_measure?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          cta_type?: string
          description?: string
          id?: string
          name?: string
          success_measure?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      guideline_files: {
        Row: {
          brand_id: string
          created_at: string
          extracted_text: string | null
          file_name: string
          id: string
          mime_type: string
          size_bytes: number
          status: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          brand_id: string
          created_at?: string
          extracted_text?: string | null
          file_name: string
          id?: string
          mime_type?: string
          size_bytes?: number
          status?: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          brand_id?: string
          created_at?: string
          extracted_text?: string | null
          file_name?: string
          id?: string
          mime_type?: string
          size_bytes?: number
          status?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guideline_files_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_posters: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      linkedin_posts: {
        Row: {
          brand_id: string
          content_item_id: string
          post_urn: string
          posted_at: string
          posted_by: string
        }
        Insert: {
          brand_id: string
          content_item_id: string
          post_urn: string
          posted_at?: string
          posted_by: string
        }
        Update: {
          brand_id?: string
          content_item_id?: string
          post_urn?: string
          posted_at?: string
          posted_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_posts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_posts_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: true
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      names: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          kind: string
          name: string
          status: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          kind?: string
          name: string
          status?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          kind?: string
          name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "names_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      personas: {
        Row: {
          brand_id: string
          cares_about: string
          company_type: string
          created_at: string
          goals: string
          id: string
          language_level: string
          name: string
          pain_points: string
          preferred_channels: string[]
          role: string
        }
        Insert: {
          brand_id: string
          cares_about?: string
          company_type?: string
          created_at?: string
          goals?: string
          id?: string
          language_level?: string
          name: string
          pain_points?: string
          preferred_channels?: string[]
          role?: string
        }
        Update: {
          brand_id?: string
          cares_about?: string
          company_type?: string
          created_at?: string
          goals?: string
          id?: string
          language_level?: string
          name?: string
          pain_points?: string
          preferred_channels?: string[]
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "personas_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_brand_id: string | null
          created_at: string
          display_name: string
          id: string
          onboarding_done: boolean
        }
        Insert: {
          active_brand_id?: string | null
          created_at?: string
          display_name?: string
          id: string
          onboarding_done?: boolean
        }
        Update: {
          active_brand_id?: string | null
          created_at?: string
          display_name?: string
          id?: string
          onboarding_done?: boolean
        }
        Relationships: []
      }
      workspace_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invited_by: string
          roles: Database["public"]["Enums"]["app_role"][]
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by: string
          roles?: Database["public"]["Enums"]["app_role"][]
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string
          roles?: Database["public"]["Enums"]["app_role"][]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_my_invites: { Args: never; Returns: number }
      can_access_brand: { Args: { _brand: string }; Returns: boolean }
      can_access_brand_text: { Args: { _brand: string }; Returns: boolean }
      can_approve_brand: { Args: { _brand: string }; Returns: boolean }
      demo_fields: {
        Args: {
          _alt: string
          _body: string
          _cta: string
          _hook: string
          _tags: string[]
        }
        Returns: Json
      }
      has_workspace_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"]; _ws: string }
        Returns: boolean
      }
      is_linkedin_poster: { Args: never; Returns: boolean }
      is_workspace_member: { Args: { _ws: string }; Returns: boolean }
      remove_member: {
        Args: { _user: string; _ws: string }
        Returns: undefined
      }
      seed_demo_brand: { Args: { _workspace_id: string }; Returns: string }
      seed_demo_content: {
        Args: { _brand: string; _user: string }
        Returns: undefined
      }
      set_content_status: {
        Args: { _comment?: string; _item: string; _status: string }
        Returns: undefined
      }
      set_member_role: {
        Args: {
          _enabled: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _user: string
          _ws: string
        }
        Returns: undefined
      }
      shares_workspace: { Args: { _other: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "editor" | "approver"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "editor", "approver"],
    },
  },
} as const
