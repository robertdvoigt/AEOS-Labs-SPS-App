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
      action_contracts: {
        Row: {
          acceptance_condition: Json
          action_type: string
          authority_requirements: Json
          created_at: string
          created_by: string | null
          expected_result: Json
          id: string
          input: Json
          objective: string
          owner: string
          parent_action_id: string | null
          profile_revision: number
          project_id: string
          required_capabilities: Json
          status: string
          title: string
          updated_at: string
          verification_requirements: Json
        }
        Insert: {
          acceptance_condition?: Json
          action_type?: string
          authority_requirements?: Json
          created_at?: string
          created_by?: string | null
          expected_result?: Json
          id?: string
          input?: Json
          objective: string
          owner: string
          parent_action_id?: string | null
          profile_revision: number
          project_id: string
          required_capabilities?: Json
          status?: string
          title: string
          updated_at?: string
          verification_requirements?: Json
        }
        Update: {
          acceptance_condition?: Json
          action_type?: string
          authority_requirements?: Json
          created_at?: string
          created_by?: string | null
          expected_result?: Json
          id?: string
          input?: Json
          objective?: string
          owner?: string
          parent_action_id?: string | null
          profile_revision?: number
          project_id?: string
          required_capabilities?: Json
          status?: string
          title?: string
          updated_at?: string
          verification_requirements?: Json
        }
        Relationships: [
          {
            foreignKeyName: "action_contracts_parent_action_id_fkey"
            columns: ["parent_action_id"]
            isOneToOne: false
            referencedRelation: "action_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_records: {
        Row: {
          action_id: string
          actual_result: Json
          created_at: string
          expected_contribution: string | null
          id: string
          limitations: Json
          outcome: string
          profile_revision_after: number | null
          profile_revision_before: number
          project_id: string
          runtime_execution_id: string
          verification_result_id: string | null
        }
        Insert: {
          action_id: string
          actual_result?: Json
          created_at?: string
          expected_contribution?: string | null
          id?: string
          limitations?: Json
          outcome: string
          profile_revision_after?: number | null
          profile_revision_before: number
          project_id: string
          runtime_execution_id: string
          verification_result_id?: string | null
        }
        Update: {
          action_id?: string
          actual_result?: Json
          created_at?: string
          expected_contribution?: string | null
          id?: string
          limitations?: Json
          outcome?: string
          profile_revision_after?: number | null
          profile_revision_before?: number
          project_id?: string
          runtime_execution_id?: string
          verification_result_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "execution_records_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "action_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_records_runtime_execution_id_fkey"
            columns: ["runtime_execution_id"]
            isOneToOne: false
            referencedRelation: "runtime_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_records_verification_result_id_fkey"
            columns: ["verification_result_id"]
            isOneToOne: false
            referencedRelation: "verification_results"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_profile_revisions: {
        Row: {
          action_id: string | null
          change_summary: string | null
          core_state: Json
          created_at: string
          id: number
          project_id: string
          revision: number
          specialization_state: Json
        }
        Insert: {
          action_id?: string | null
          change_summary?: string | null
          core_state: Json
          created_at?: string
          id?: number
          project_id: string
          revision: number
          specialization_state: Json
        }
        Update: {
          action_id?: string | null
          change_summary?: string | null
          core_state?: Json
          created_at?: string
          id?: number
          project_id?: string
          revision?: number
          specialization_state?: Json
        }
        Relationships: [
          {
            foreignKeyName: "project_profile_revisions_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "action_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_profile_revisions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_profiles: {
        Row: {
          core_state: Json
          current_nba_action_id: string | null
          project_id: string
          revision: number
          source_revision_parent: number | null
          specialization_state: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          core_state?: Json
          current_nba_action_id?: string | null
          project_id: string
          revision?: number
          source_revision_parent?: number | null
          specialization_state?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          core_state?: Json
          current_nba_action_id?: string | null
          project_id?: string
          revision?: number
          source_revision_parent?: number | null
          specialization_state?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_profiles_current_nba_action_id_fkey"
            columns: ["current_nba_action_id"]
            isOneToOne: false
            referencedRelation: "action_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_profiles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          archived_at: string | null
          core_version: string
          created_at: string
          id: string
          name: string
          owner_user_id: string
          runtime_version: string
          software_product_version: string
          status: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          core_version?: string
          created_at?: string
          id?: string
          name: string
          owner_user_id: string
          runtime_version?: string
          software_product_version?: string
          status?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          core_version?: string
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string
          runtime_version?: string
          software_product_version?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      runtime_executions: {
        Row: {
          action_id: string
          attempt: number
          cancel_requested_at: string | null
          completed_at: string | null
          context_revision: number
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          limitations: Json
          model: string | null
          model_class: string | null
          project_id: string
          provider: string | null
          provider_response_id: string | null
          result: Json
          started_at: string | null
          state: string
          usage: Json
          workflow_run_id: string | null
        }
        Insert: {
          action_id: string
          attempt?: number
          cancel_requested_at?: string | null
          completed_at?: string | null
          context_revision: number
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          limitations?: Json
          model?: string | null
          model_class?: string | null
          project_id: string
          provider?: string | null
          provider_response_id?: string | null
          result?: Json
          started_at?: string | null
          state?: string
          usage?: Json
          workflow_run_id?: string | null
        }
        Update: {
          action_id?: string
          attempt?: number
          cancel_requested_at?: string | null
          completed_at?: string | null
          context_revision?: number
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          limitations?: Json
          model?: string | null
          model_class?: string | null
          project_id?: string
          provider?: string | null
          provider_response_id?: string | null
          result?: Json
          started_at?: string | null
          state?: string
          usage?: Json
          workflow_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "runtime_executions_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "action_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runtime_executions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      runtime_steps: {
        Row: {
          attempt: number
          completed_at: string | null
          created_at: string
          error_code: string | null
          error_message: string | null
          external_effect_state: string
          id: string
          input: Json
          kind: string
          output: Json
          runtime_execution_id: string
          sequence: number
          started_at: string | null
          state: string
          step_key: string
        }
        Insert: {
          attempt?: number
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          external_effect_state?: string
          id?: string
          input?: Json
          kind: string
          output?: Json
          runtime_execution_id: string
          sequence?: number
          started_at?: string | null
          state?: string
          step_key: string
        }
        Update: {
          attempt?: number
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          external_effect_state?: string
          id?: string
          input?: Json
          kind?: string
          output?: Json
          runtime_execution_id?: string
          sequence?: number
          started_at?: string | null
          state?: string
          step_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "runtime_steps_runtime_execution_id_fkey"
            columns: ["runtime_execution_id"]
            isOneToOne: false
            referencedRelation: "runtime_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_results: {
        Row: {
          action_id: string
          created_at: string
          details: Json
          id: string
          method: string
          project_id: string
          runtime_execution_id: string
          status: string
          summary: string
          verifier_kind: string
        }
        Insert: {
          action_id: string
          created_at?: string
          details?: Json
          id?: string
          method: string
          project_id: string
          runtime_execution_id: string
          status: string
          summary: string
          verifier_kind: string
        }
        Update: {
          action_id?: string
          created_at?: string
          details?: Json
          id?: string
          method?: string
          project_id?: string
          runtime_execution_id?: string
          status?: string
          summary?: string
          verifier_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_results_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "action_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_results_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_results_runtime_execution_id_fkey"
            columns: ["runtime_execution_id"]
            isOneToOne: false
            referencedRelation: "runtime_executions"
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
    Enums: {},
  },
} as const
