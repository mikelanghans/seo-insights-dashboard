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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      batch_run_scans: {
        Row: {
          batch_run_id: string
          client_id: string | null
          client_website_id: string | null
          created_at: string
          id: string
          scan_id: string
          user_id: string
        }
        Insert: {
          batch_run_id: string
          client_id?: string | null
          client_website_id?: string | null
          created_at?: string
          id?: string
          scan_id: string
          user_id: string
        }
        Update: {
          batch_run_id?: string
          client_id?: string | null
          client_website_id?: string | null
          created_at?: string
          id?: string
          scan_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_run_scans_batch_run_id_fkey"
            columns: ["batch_run_id"]
            isOneToOne: false
            referencedRelation: "batch_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_runs: {
        Row: {
          batch_id: string
          completed_at: string | null
          error_message: string | null
          id: string
          scans_completed: number
          scans_failed: number
          scans_total: number
          started_at: string
          status: string
          trigger: string
          user_id: string
        }
        Insert: {
          batch_id: string
          completed_at?: string | null
          error_message?: string | null
          id?: string
          scans_completed?: number
          scans_failed?: number
          scans_total?: number
          started_at?: string
          status?: string
          trigger?: string
          user_id: string
        }
        Update: {
          batch_id?: string
          completed_at?: string | null
          error_message?: string | null
          id?: string
          scans_completed?: number
          scans_failed?: number
          scans_total?: number
          started_at?: string
          status?: string
          trigger?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_runs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_targets: {
        Row: {
          batch_id: string
          client_id: string
          client_website_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          batch_id: string
          client_id: string
          client_website_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          batch_id?: string
          client_id?: string
          client_website_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_targets_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          audit_type: string
          created_at: string
          id: string
          is_active: boolean
          last_run_at: string | null
          name: string
          next_run_at: string | null
          scan_kind: string
          schedule_day_of_month: number | null
          schedule_day_of_week: number | null
          schedule_hour: number
          schedule_type: string
          scope: string
          updated_at: string
          user_id: string
        }
        Insert: {
          audit_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          scan_kind?: string
          schedule_day_of_month?: number | null
          schedule_day_of_week?: number | null
          schedule_hour?: number
          schedule_type?: string
          scope?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          audit_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          scan_kind?: string
          schedule_day_of_month?: number | null
          schedule_day_of_week?: number | null
          schedule_hour?: number
          schedule_type?: string
          scope?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      client_websites: {
        Row: {
          client_id: string
          created_at: string
          id: string
          is_primary: boolean
          label: string | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_websites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scans: {
        Row: {
          audit_type: string | null
          brand_aura_user_id: string | null
          client_id: string | null
          client_name: string | null
          client_website_id: string | null
          created_at: string
          discovered_url_count: number
          error_message: string | null
          id: string
          is_public: boolean
          kind: string
          pages_scanned: number
          pages_total: number
          phase: string | null
          report: Json
          retry_scan_id: string | null
          root_url: string
          scope: string
          source: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          audit_type?: string | null
          brand_aura_user_id?: string | null
          client_id?: string | null
          client_name?: string | null
          client_website_id?: string | null
          created_at?: string
          discovered_url_count?: number
          error_message?: string | null
          id?: string
          is_public?: boolean
          kind?: string
          pages_scanned?: number
          pages_total?: number
          phase?: string | null
          report: Json
          retry_scan_id?: string | null
          root_url: string
          scope: string
          source?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          audit_type?: string | null
          brand_aura_user_id?: string | null
          client_id?: string | null
          client_name?: string | null
          client_website_id?: string | null
          created_at?: string
          discovered_url_count?: number
          error_message?: string | null
          id?: string
          is_public?: boolean
          kind?: string
          pages_scanned?: number
          pages_total?: number
          phase?: string | null
          report?: Json
          retry_scan_id?: string | null
          root_url?: string
          scope?: string
          source?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scans_client_website_id_fkey"
            columns: ["client_website_id"]
            isOneToOne: false
            referencedRelation: "client_websites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scans_retry_scan_id_fkey"
            columns: ["retry_scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
