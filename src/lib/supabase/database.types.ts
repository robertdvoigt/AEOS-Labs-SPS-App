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
      action_execution_strategies: {
        Row: {
          action_id: string
          change_rationale: string | null
          configuration: Json
          material_changes: Json
          project_id: string
          strategy_key: string
          strategy_revision: number
          updated_at: string
        }
        Insert: {
          action_id: string
          change_rationale?: string | null
          configuration?: Json
          material_changes?: Json
          project_id: string
          strategy_key?: string
          strategy_revision?: number
          updated_at?: string
        }
        Update: {
          action_id?: string
          change_rationale?: string | null
          configuration?: Json
          material_changes?: Json
          project_id?: string
          strategy_key?: string
          strategy_revision?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_execution_strategies_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: true
            referencedRelation: "action_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_execution_strategies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_adaptation_reviews: {
        Row: {
          action_id: string
          changed_variables: Json
          created_at: string
          disposition: string
          failure_class: string
          failure_phase: string
          failure_signature: string
          id: string
          prior_attempt_ids: Json
          project_id: string
          rationale: string
          repeated_failure_count: number
          required_change: string | null
          resolved_at: string | null
          resolved_strategy_key: string | null
          status: string
          trigger_runtime_execution_id: string
        }
        Insert: {
          action_id: string
          changed_variables?: Json
          created_at?: string
          disposition: string
          failure_class: string
          failure_phase: string
          failure_signature: string
          id?: string
          prior_attempt_ids?: Json
          project_id: string
          rationale: string
          repeated_failure_count: number
          required_change?: string | null
          resolved_at?: string | null
          resolved_strategy_key?: string | null
          status?: string
          trigger_runtime_execution_id: string
        }
        Update: {
          action_id?: string
          changed_variables?: Json
          created_at?: string
          disposition?: string
          failure_class?: string
          failure_phase?: string
          failure_signature?: string
          id?: string
          prior_attempt_ids?: Json
          project_id?: string
          rationale?: string
          repeated_failure_count?: number
          required_change?: string | null
          resolved_at?: string | null
          resolved_strategy_key?: string | null
          status?: string
          trigger_runtime_execution_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "execution_adaptation_reviews_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "action_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_adaptation_reviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_adaptation_reviews_trigger_runtime_execution_id_fkey"
            columns: ["trigger_runtime_execution_id"]
            isOneToOne: false
            referencedRelation: "runtime_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      code_changes: {
        Row: {
          accepted_at: string | null
          action_id: string
          base_commit: string | null
          branch: string
          created_at: string
          head_commit: string | null
          id: string
          project_id: string
          pull_request_ref: string | null
          repository_id: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          action_id: string
          base_commit?: string | null
          branch: string
          created_at?: string
          head_commit?: string | null
          id?: string
          project_id: string
          pull_request_ref?: string | null
          repository_id: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          action_id?: string
          base_commit?: string | null
          branch?: string
          created_at?: string
          head_commit?: string | null
          id?: string
          project_id?: string
          pull_request_ref?: string | null
          repository_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "code_changes_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "action_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "code_changes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "code_changes_repository_id_fkey"
            columns: ["repository_id"]
            isOneToOne: false
            referencedRelation: "repositories"
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
      human_dependencies: {
        Row: {
          action_id: string
          created_at: string
          id: string
          kind: string
          options: Json
          project_id: string
          prompt: string
          resolved_at: string | null
          resolved_value: Json | null
          status: string
          why_human: string
        }
        Insert: {
          action_id: string
          created_at?: string
          id?: string
          kind?: string
          options?: Json
          project_id: string
          prompt: string
          resolved_at?: string | null
          resolved_value?: Json | null
          status?: string
          why_human: string
        }
        Update: {
          action_id?: string
          created_at?: string
          id?: string
          kind?: string
          options?: Json
          project_id?: string
          prompt?: string
          resolved_at?: string | null
          resolved_value?: Json | null
          status?: string
          why_human?: string
        }
        Relationships: [
          {
            foreignKeyName: "human_dependencies_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "action_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "human_dependencies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_connections: {
        Row: {
          created_at: string
          external_account_id: string
          id: string
          installation_id: string | null
          metadata: Json
          project_id: string | null
          provider: string
          scopes: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          external_account_id: string
          id?: string
          installation_id?: string | null
          metadata?: Json
          project_id?: string | null
          provider: string
          scopes?: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          external_account_id?: string
          id?: string
          installation_id?: string | null
          metadata?: Json
          project_id?: string | null
          provider?: string
          scopes?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_connections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      repositories: {
        Row: {
          created_at: string
          default_branch: string
          external_id: string
          id: string
          installation_connection_id: string
          owner: string
          project_id: string
          provider: string
          repo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_branch?: string
          external_id: string
          id?: string
          installation_connection_id: string
          owner: string
          project_id: string
          provider?: string
          repo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_branch?: string
          external_id?: string
          id?: string
          installation_connection_id?: string
          owner?: string
          project_id?: string
          provider?: string
          repo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "repositories_installation_connection_id_fkey"
            columns: ["installation_connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repositories_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      runtime_checkpoints: {
        Row: {
          created_at: string
          id: string
          phase: string
          runtime_execution_id: string
          sequence: number
          state: Json
        }
        Insert: {
          created_at?: string
          id?: string
          phase: string
          runtime_execution_id: string
          sequence: number
          state?: Json
        }
        Update: {
          created_at?: string
          id?: string
          phase?: string
          runtime_execution_id?: string
          sequence?: number
          state?: Json
        }
        Relationships: [
          {
            foreignKeyName: "runtime_checkpoints_runtime_execution_id_fkey"
            columns: ["runtime_execution_id"]
            isOneToOne: false
            referencedRelation: "runtime_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      runtime_executions: {
        Row: {
          action_id: string
          adaptation_review_required: boolean
          attempt: number
          cancel_requested_at: string | null
          completed_at: string | null
          context_revision: number
          created_at: string
          error_code: string | null
          error_message: string | null
          execution_strategy: string
          failure_class: string | null
          failure_phase: string | null
          failure_signature: string | null
          id: string
          limitations: Json
          material_changes: Json
          model: string | null
          model_class: string | null
          project_id: string
          provider: string | null
          provider_response_id: string | null
          result: Json
          strategy_revision: number
          started_at: string | null
          state: string
          usage: Json
          workflow_access_expires_at: string | null
          workflow_access_hash: string | null
          workflow_run_id: string | null
        }
        Insert: {
          action_id: string
          adaptation_review_required?: boolean
          attempt?: number
          cancel_requested_at?: string | null
          completed_at?: string | null
          context_revision: number
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          execution_strategy?: string
          failure_class?: string | null
          failure_phase?: string | null
          failure_signature?: string | null
          id?: string
          limitations?: Json
          material_changes?: Json
          model?: string | null
          model_class?: string | null
          project_id: string
          provider?: string | null
          provider_response_id?: string | null
          result?: Json
          strategy_revision?: number
          started_at?: string | null
          state?: string
          usage?: Json
          workflow_access_expires_at?: string | null
          workflow_access_hash?: string | null
          workflow_run_id?: string | null
        }
        Update: {
          action_id?: string
          adaptation_review_required?: boolean
          attempt?: number
          cancel_requested_at?: string | null
          completed_at?: string | null
          context_revision?: number
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          execution_strategy?: string
          failure_class?: string | null
          failure_phase?: string | null
          failure_signature?: string | null
          id?: string
          limitations?: Json
          material_changes?: Json
          model?: string | null
          model_class?: string | null
          project_id?: string
          provider?: string | null
          provider_response_id?: string | null
          result?: Json
          strategy_revision?: number
          started_at?: string | null
          state?: string
          usage?: Json
          workflow_access_expires_at?: string | null
          workflow_access_hash?: string | null
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
      bind_durable_workflow: {
        Args: { p_runtime_execution_id: string; p_workflow_run_id: string }
        Returns: undefined
      }
      complete_runtime_analysis: {
        Args: {
          p_expected_revision: number
          p_limitations: Json
          p_next_action_acceptance_condition: Json
          p_next_action_expected_result: Json
          p_next_action_objective: string
          p_next_action_title: string
          p_next_action_type: string
          p_next_required_capabilities?: Json
          p_provider_response_id: string
          p_result: Json
          p_runtime_execution_id: string
          p_specialization_state: Json
          p_usage: Json
          p_verification_details: Json
          p_verification_method: string
          p_verification_status: string
          p_verification_summary: string
        }
        Returns: Json
      }
      confirm_mvp_direction: {
        Args: {
          p_expected_revision: number
          p_next_nba_acceptance_condition: Json
          p_next_nba_expected_result: Json
          p_next_nba_objective: string
          p_next_nba_title: string
          p_project_id: string
          p_specialization_state: Json
        }
        Returns: Json
      }
      create_code_execution: {
        Args: {
          p_branch: string
          p_expected_revision: number
          p_project_id: string
          p_repository_id: string
        }
        Returns: Json
      }
      create_durability_probe: {
        Args: { p_expected_revision: number; p_project_id: string }
        Returns: Json
      }
      create_project_with_profile: {
        Args: {
          p_core_state?: Json
          p_name: string
          p_specialization_state?: Json
        }
        Returns: string
      }
      establish_genesis_and_nba: {
        Args: {
          p_core_state: Json
          p_expected_revision: number
          p_human_options?: Json
          p_human_prompt: string
          p_human_why: string
          p_nba_acceptance_condition: Json
          p_nba_expected_result: Json
          p_nba_objective: string
          p_nba_title: string
          p_project_id: string
          p_specialization_state: Json
        }
        Returns: Json
      }
      fail_runtime_execution: {
        Args: {
          p_error_code: string
          p_error_message: string
          p_limitations?: Json
          p_result?: Json
          p_retryable: boolean
          p_runtime_execution_id: string
          p_usage?: Json
        }
        Returns: undefined
      }
      reconcile_project_state: {
        Args: {
          p_action_id?: string
          p_change_summary?: string
          p_core_state: Json
          p_current_nba_action_id?: string
          p_expected_revision: number
          p_project_id: string
          p_specialization_state: Json
        }
        Returns: number
      }
      register_project_repository: {
        Args: {
          p_connection_id: string
          p_default_branch: string
          p_external_id: string
          p_owner: string
          p_project_id: string
          p_repo: string
        }
        Returns: string
      }
      resolve_execution_adaptation_review: {
        Args: {
          p_action_id: string
          p_changed_variables?: Json
          p_disposition: string
          p_rationale: string
          p_strategy_key: string
        }
        Returns: Json
      }
      request_cancel_runtime_execution: {
        Args: { p_runtime_execution_id: string }
        Returns: undefined
      }
      start_runtime_execution: {
        Args: {
          p_action_id: string
          p_expected_revision: number
          p_model: string
          p_model_class: string
          p_provider: string
        }
        Returns: string
      }
      upsert_github_installation: {
        Args: {
          p_external_account_id: string
          p_installation_id: string
          p_metadata?: Json
          p_project_id: string
          p_scopes: Json
        }
        Returns: string
      }
      workflow_cancel_code_execution: {
        Args: {
          p_capability_token: string
          p_code_change_id: string
          p_runtime_execution_id: string
        }
        Returns: undefined
      }
      workflow_cancel_durability_probe: {
        Args: { p_capability_token: string; p_runtime_execution_id: string }
        Returns: undefined
      }
      workflow_complete_code_execution: {
        Args: {
          p_base_commit: string
          p_branch: string
          p_capability_token: string
          p_code_change_id: string
          p_head_commit: string
          p_result: Json
          p_runtime_execution_id: string
          p_verification_details: Json
        }
        Returns: undefined
      }
      workflow_complete_durability_probe: {
        Args: {
          p_capability_token: string
          p_result: Json
          p_runtime_execution_id: string
        }
        Returns: undefined
      }
      workflow_fail_code_execution: {
        Args: {
          p_capability_token: string
          p_code_change_id: string
          p_error_message: string
          p_runtime_execution_id: string
        }
        Returns: undefined
      }
      workflow_fail_durability_probe: {
        Args: {
          p_capability_token: string
          p_error_message: string
          p_runtime_execution_id: string
        }
        Returns: undefined
      }
      workflow_runtime_checkpoint: {
        Args: {
          p_capability_token: string
          p_phase: string
          p_runtime_execution_id: string
          p_sequence: number
          p_state?: Json
        }
        Returns: Json
      }
      workflow_runtime_control: {
        Args: { p_capability_token: string; p_runtime_execution_id: string }
        Returns: Json
      }
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
