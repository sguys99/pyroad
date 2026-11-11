export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      analytics_events: {
        Row: {
          actor: string;
          anon_id: string;
          dedupe_key: string | null;
          device: string;
          id: string;
          name: string;
          occurred_at: string;
          path: string | null;
          props: Json;
          source: string;
        };
        Insert: {
          actor: string;
          anon_id: string;
          dedupe_key?: string | null;
          device?: string;
          id?: string;
          name: string;
          occurred_at?: string;
          path?: string | null;
          props?: Json;
          source: string;
        };
        Update: {
          actor?: string;
          anon_id?: string;
          dedupe_key?: string | null;
          device?: string;
          id?: string;
          name?: string;
          occurred_at?: string;
          path?: string | null;
          props?: Json;
          source?: string;
        };
        Relationships: [];
      };
      api_global_rate_limits: {
        Row: {
          bucket: string;
          day: string;
          day_count: number;
          day_denied: number;
          minute_count: number;
          minute_denied: number;
          minute_start: string;
          updated_at: string;
        };
        Insert: {
          bucket: string;
          day: string;
          day_count?: number;
          day_denied?: number;
          minute_count?: number;
          minute_denied?: number;
          minute_start: string;
          updated_at?: string;
        };
        Update: {
          bucket?: string;
          day?: string;
          day_count?: number;
          day_denied?: number;
          minute_count?: number;
          minute_denied?: number;
          minute_start?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      api_rate_limits: {
        Row: {
          bucket: string;
          day: string;
          day_count: number;
          day_denied: number;
          minute_count: number;
          minute_denied: number;
          minute_start: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          bucket: string;
          day: string;
          day_count?: number;
          day_denied?: number;
          minute_count?: number;
          minute_denied?: number;
          minute_start: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          bucket?: string;
          day?: string;
          day_count?: number;
          day_denied?: number;
          minute_count?: number;
          minute_denied?: number;
          minute_start?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'api_rate_limits_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      board_comments: {
        Row: {
          content: string;
          created_at: string;
          hidden_at: string | null;
          id: string;
          is_hidden: boolean;
          post_id: string;
          user_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          hidden_at?: string | null;
          id?: string;
          is_hidden?: boolean;
          post_id: string;
          user_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          hidden_at?: string | null;
          id?: string;
          is_hidden?: boolean;
          post_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'board_comments_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: false;
            referencedRelation: 'board_posts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'board_comments_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user_profiles_public';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'board_comments_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user_public_profiles';
            referencedColumns: ['user_id'];
          },
        ];
      };
      board_posts: {
        Row: {
          content: string;
          created_at: string;
          hidden_at: string | null;
          id: string;
          is_hidden: boolean;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          hidden_at?: string | null;
          id?: string;
          is_hidden?: boolean;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          hidden_at?: string | null;
          id?: string;
          is_hidden?: boolean;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'board_posts_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user_profiles_public';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'board_posts_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user_public_profiles';
            referencedColumns: ['user_id'];
          },
        ];
      };
      board_reports: {
        Row: {
          created_at: string;
          id: string;
          reason: string;
          reporter_id: string;
          target_id: string;
          target_type: string;
          target_user_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          reason: string;
          reporter_id: string;
          target_id: string;
          target_type: string;
          target_user_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          reason?: string;
          reporter_id?: string;
          target_id?: string;
          target_type?: string;
          target_user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'board_reports_reporter_id_fkey';
            columns: ['reporter_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'board_reports_target_user_id_fkey';
            columns: ['target_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      coin_ledger: {
        Row: {
          balance_after: number;
          created_at: string;
          delta: number;
          id: number;
          ref: string;
          source: string;
          user_id: string;
        };
        Insert: {
          balance_after: number;
          created_at?: string;
          delta: number;
          id?: never;
          ref: string;
          source: string;
          user_id: string;
        };
        Update: {
          balance_after?: number;
          created_at?: string;
          delta?: number;
          id?: never;
          ref?: string;
          source?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'coin_ledger_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      daily_missions: {
        Row: {
          active: boolean;
          difficulty: number;
          grp: string;
          id: string;
          kind: string;
          target: number;
          title: string;
        };
        Insert: {
          active?: boolean;
          difficulty: number;
          grp: string;
          id: string;
          kind: string;
          target: number;
          title: string;
        };
        Update: {
          active?: boolean;
          difficulty?: number;
          grp?: string;
          id?: string;
          kind?: string;
          target?: number;
          title?: string;
        };
        Relationships: [];
      };
      level_curve_adjustments: {
        Row: {
          created_at: string;
          level_before: number;
          user_id: string;
          xp_after: number;
          xp_before: number;
        };
        Insert: {
          created_at?: string;
          level_before: number;
          user_id: string;
          xp_after: number;
          xp_before: number;
        };
        Update: {
          created_at?: string;
          level_before?: number;
          user_id?: string;
          xp_after?: number;
          xp_before?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'level_curve_adjustments_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      notices: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          id?: string;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notices_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      quest_answer_keys: {
        Row: {
          expected_output: string;
          hints: Json;
          quest_id: string;
          quiz_answer: Json | null;
          solution_code: string | null;
          steps: Json;
          updated_at: string;
        };
        Insert: {
          expected_output?: string;
          hints?: Json;
          quest_id: string;
          quiz_answer?: Json | null;
          solution_code?: string | null;
          steps?: Json;
          updated_at?: string;
        };
        Update: {
          expected_output?: string;
          hints?: Json;
          quest_id?: string;
          quiz_answer?: Json | null;
          solution_code?: string | null;
          steps?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'quest_answer_keys_quest_id_fkey';
            columns: ['quest_id'];
            isOneToOne: true;
            referencedRelation: 'quests';
            referencedColumns: ['id'];
          },
        ];
      };
      quests: {
        Row: {
          concept: string;
          created_at: string;
          expected_output: string;
          id: string;
          is_mobile_friendly: boolean;
          order: number;
          prompt_skeleton: Json;
          quest_type: string;
          quiz_kind: string | null;
          stage_id: string;
          title: string;
          validation_type: string;
          xp_reward: number;
        };
        Insert: {
          concept: string;
          created_at?: string;
          expected_output?: string;
          id?: string;
          is_mobile_friendly?: boolean;
          order: number;
          prompt_skeleton?: Json;
          quest_type?: string;
          quiz_kind?: string | null;
          stage_id: string;
          title: string;
          validation_type: string;
          xp_reward?: number;
        };
        Update: {
          concept?: string;
          created_at?: string;
          expected_output?: string;
          id?: string;
          is_mobile_friendly?: boolean;
          order?: number;
          prompt_skeleton?: Json;
          quest_type?: string;
          quiz_kind?: string | null;
          stage_id?: string;
          title?: string;
          validation_type?: string;
          xp_reward?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'quests_stage_id_fkey';
            columns: ['stage_id'];
            isOneToOne: false;
            referencedRelation: 'stages';
            referencedColumns: ['id'];
          },
        ];
      };
      quiz_attempts: {
        Row: {
          answer: Json;
          attempt_no: number;
          created_at: string;
          id: string;
          is_correct: boolean;
          mode: string;
          quest_id: string;
          user_id: string;
        };
        Insert: {
          answer: Json;
          attempt_no: number;
          created_at?: string;
          id?: string;
          is_correct: boolean;
          mode: string;
          quest_id: string;
          user_id: string;
        };
        Update: {
          answer?: Json;
          attempt_no?: number;
          created_at?: string;
          id?: string;
          is_correct?: boolean;
          mode?: string;
          quest_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'quiz_attempts_quest_id_fkey';
            columns: ['quest_id'];
            isOneToOne: false;
            referencedRelation: 'quests';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'quiz_attempts_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      stages: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          is_final: boolean;
          order: number;
          theme_name: string;
          title: string;
          world_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string;
          id?: string;
          is_final?: boolean;
          order: number;
          theme_name: string;
          title: string;
          world_id?: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          is_final?: boolean;
          order?: number;
          theme_name?: string;
          title?: string;
          world_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'stages_world_id_fkey';
            columns: ['world_id'];
            isOneToOne: false;
            referencedRelation: 'worlds';
            referencedColumns: ['id'];
          },
        ];
      };
      streak_shield_days: {
        Row: {
          created_at: string;
          day: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          day: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          day?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'streak_shield_days_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      user_agreements: {
        Row: {
          agreed_at: string;
          item: string;
          method: string;
          relation: string | null;
          user_id: string;
          version: string;
        };
        Insert: {
          agreed_at?: string;
          item: string;
          method: string;
          relation?: string | null;
          user_id: string;
          version: string;
        };
        Update: {
          agreed_at?: string;
          item?: string;
          method?: string;
          relation?: string | null;
          user_id?: string;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_agreements_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      user_api_keys: {
        Row: {
          auth_tag: string;
          ciphertext: string;
          created_at: string;
          iv: string;
          key_version: number;
          provider: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          auth_tag: string;
          ciphertext: string;
          created_at?: string;
          iv: string;
          key_version: number;
          provider: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          auth_tag?: string;
          ciphertext?: string;
          created_at?: string;
          iv?: string;
          key_version?: number;
          provider?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_api_keys_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      user_badges: {
        Row: {
          badge_type: string;
          earned_at: string;
          id: string;
          user_id: string;
        };
        Insert: {
          badge_type: string;
          earned_at?: string;
          id?: string;
          user_id: string;
        };
        Update: {
          badge_type?: string;
          earned_at?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_badges_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      user_daily_missions: {
        Row: {
          created_at: string;
          day: string;
          mission_ids: string[];
          quiz_ids: string[];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          day: string;
          mission_ids: string[];
          quiz_ids?: string[];
          user_id: string;
        };
        Update: {
          created_at?: string;
          day?: string;
          mission_ids?: string[];
          quiz_ids?: string[];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_daily_missions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      user_progress: {
        Row: {
          attempts: number;
          best_stars: number;
          code_submitted: string | null;
          completed_at: string | null;
          created_at: string;
          current_step: number | null;
          earned_xp: number;
          hints_used: number;
          id: string;
          quest_id: string;
          solved_directly_at: string | null;
          stars: number;
          stars_judged_on: string | null;
          status: string;
          step_submissions: Json | null;
          used_golden_key: boolean;
          user_id: string;
        };
        Insert: {
          attempts?: number;
          best_stars?: number;
          code_submitted?: string | null;
          completed_at?: string | null;
          created_at?: string;
          current_step?: number | null;
          earned_xp?: number;
          hints_used?: number;
          id?: string;
          quest_id: string;
          solved_directly_at?: string | null;
          stars?: number;
          stars_judged_on?: string | null;
          status?: string;
          step_submissions?: Json | null;
          used_golden_key?: boolean;
          user_id: string;
        };
        Update: {
          attempts?: number;
          best_stars?: number;
          code_submitted?: string | null;
          completed_at?: string | null;
          created_at?: string;
          current_step?: number | null;
          earned_xp?: number;
          hints_used?: number;
          id?: string;
          quest_id?: string;
          solved_directly_at?: string | null;
          stars?: number;
          stars_judged_on?: string | null;
          status?: string;
          step_submissions?: Json | null;
          used_golden_key?: boolean;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_progress_quest_id_fkey';
            columns: ['quest_id'];
            isOneToOne: false;
            referencedRelation: 'quests';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_progress_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      user_public_profiles: {
        Row: {
          avatar_skin: string | null;
          public_name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          avatar_skin?: string | null;
          public_name: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          avatar_skin?: string | null;
          public_name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_public_profiles_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      user_seen_unlocks: {
        Row: {
          seen_at: string;
          stage_id: string;
          user_id: string;
        };
        Insert: {
          seen_at?: string;
          stage_id: string;
          user_id: string;
        };
        Update: {
          seen_at?: string;
          stage_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_seen_unlocks_stage_id_fkey';
            columns: ['stage_id'];
            isOneToOne: false;
            referencedRelation: 'stages';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_seen_unlocks_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      user_streak_shields: {
        Row: {
          shields: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          shields?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          shields?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_streak_shields_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      users: {
        Row: {
          age_band: string | null;
          age_checked_at: string | null;
          avatar_config: Json;
          avatar_url: string | null;
          coins: number;
          consent_deadline: string | null;
          created_at: string;
          current_level: number;
          display_name: string;
          golden_keys: number;
          grade: number | null;
          guardian_consented_at: string | null;
          id: string;
          last_login_at: string;
          last_login_provider: string | null;
          nickname: string | null;
          onboarded_at: string | null;
          preferred_provider: string | null;
          settings: Json;
          total_xp: number;
        };
        Insert: {
          age_band?: string | null;
          age_checked_at?: string | null;
          avatar_config?: Json;
          avatar_url?: string | null;
          coins?: number;
          consent_deadline?: string | null;
          created_at?: string;
          current_level?: number;
          display_name?: string;
          golden_keys?: number;
          grade?: number | null;
          guardian_consented_at?: string | null;
          id: string;
          last_login_at?: string;
          last_login_provider?: string | null;
          nickname?: string | null;
          onboarded_at?: string | null;
          preferred_provider?: string | null;
          settings?: Json;
          total_xp?: number;
        };
        Update: {
          age_band?: string | null;
          age_checked_at?: string | null;
          avatar_config?: Json;
          avatar_url?: string | null;
          coins?: number;
          consent_deadline?: string | null;
          created_at?: string;
          current_level?: number;
          display_name?: string;
          golden_keys?: number;
          grade?: number | null;
          guardian_consented_at?: string | null;
          id?: string;
          last_login_at?: string;
          last_login_provider?: string | null;
          nickname?: string | null;
          onboarded_at?: string | null;
          preferred_provider?: string | null;
          settings?: Json;
          total_xp?: number;
        };
        Relationships: [];
      };
      worlds: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          order: number;
          slug: string;
          theme: string;
          title: string;
          unlock_rule: Json;
        };
        Insert: {
          created_at?: string;
          description?: string;
          id?: string;
          order: number;
          slug: string;
          theme: string;
          title: string;
          unlock_rule?: Json;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          order?: number;
          slug?: string;
          theme?: string;
          title?: string;
          unlock_rule?: Json;
        };
        Relationships: [];
      };
    };
    Views: {
      user_profiles_public: {
        Row: {
          avatar_skin: string | null;
          avatar_url: string | null;
          display_name: string | null;
          id: string | null;
        };
        Insert: {
          avatar_skin?: string | null;
          avatar_url?: never;
          display_name?: string | null;
          id?: string | null;
        };
        Update: {
          avatar_skin?: string | null;
          avatar_url?: never;
          display_name?: string | null;
          id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'user_public_profiles_user_id_fkey';
            columns: ['id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Functions: {
      claim_daily_mission: {
        Args: { p_day: string; p_mission_id: string; p_user_id: string };
        Returns: Json;
      };
      code_quest_stars: {
        Args: { p_hints_used: number; p_used_golden_key: boolean };
        Returns: number;
      };
      coin_apply: {
        Args: {
          p_delta: number;
          p_ref: string;
          p_source: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      coin_balance_mismatches: {
        Args: never;
        Returns: {
          coins: number;
          ledger_sum: number;
          user_id: string;
        }[];
      };
      coin_reward: { Args: { p_kind: string; p_n?: number }; Returns: number };
      complete_onboarding: {
        Args: {
          p_age_band: string;
          p_agreements: Json;
          p_grade: number;
          p_guardian_agreements: Json;
          p_guardian_relation: string;
          p_method: string;
          p_nickname: string;
          p_skin: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      complete_quest: {
        Args: { p_quest_id: string; p_submission: Json; p_user_id: string };
        Returns: Json;
      };
      consume_global_rate_limit: {
        Args: { p_bucket: string; p_per_day: number; p_per_minute: number };
        Returns: Json;
      };
      consume_rate_limit: {
        Args: {
          p_bucket: string;
          p_per_day: number;
          p_per_minute: number;
          p_user_id: string;
        };
        Returns: Json;
      };
      current_streak: {
        Args: { p_days: string[]; p_today: string };
        Returns: number;
      };
      daily_mission_list: {
        Args: {
          p_day: string;
          p_mission_ids: string[];
          p_quiz_ids: string[];
          p_user_id: string;
        };
        Returns: Json;
      };
      daily_mission_possible: {
        Args: {
          p_day: string;
          p_kind: string;
          p_quiz_ids: string[];
          p_target: number;
          p_user_id: string;
        };
        Returns: boolean;
      };
      daily_mission_progress: {
        Args: {
          p_day: string;
          p_kind: string;
          p_quiz_ids: string[];
          p_user_id: string;
        };
        Returns: number;
      };
      daily_mission_target: {
        Args: { p_kind: string; p_quiz_ids: string[]; p_target: number };
        Returns: number;
      };
      daily_missions_today: {
        Args: { p_quiz_ids?: string[]; p_user_id: string };
        Returns: Json;
      };
      decide_new_badges: {
        Args: {
          p_completed_count: number;
          p_earned: string[];
          p_hints_used: number;
          p_is_final_stage: boolean;
          p_stage_cleared: boolean;
          p_streak_3: boolean;
          p_used_golden_key: boolean;
        };
        Returns: string[];
      };
      grant_coins: {
        Args: {
          p_amount: number;
          p_ref: string;
          p_source: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      grant_level_up_coins: {
        Args: { p_from_level: number; p_to_level: number; p_user_id: string };
        Returns: Json;
      };
      grant_star_coins: {
        Args: { p_quest_id: string; p_stars: number; p_user_id: string };
        Returns: number;
      };
      has_three_day_streak: {
        Args: { p_completed_at: string[] };
        Returns: boolean;
      };
      is_nickname_taken: {
        Args: { p_nickname: string; p_user_id: string };
        Returns: boolean;
      };
      is_solution_copy: {
        Args: { p_code: string; p_quest_id: string };
        Returns: boolean;
      };
      is_stage_unlocked: {
        Args: { p_stage_id: string; p_user_id: string };
        Returns: boolean;
      };
      kst_date: { Args: { p_at: string }; Returns: string };
      kst_today: { Args: never; Returns: string };
      level_for_xp: { Args: { p_total_xp: number }; Returns: number };
      list_expired_unconsented: {
        Args: { p_limit: number };
        Returns: string[];
      };
      open_stage_chest: {
        Args: { p_stage_id: string; p_user_id: string };
        Returns: Json;
      };
      patch_user_settings: {
        Args: { p_patch: Json; p_user_id: string };
        Returns: boolean;
      };
      placeholder_display_name: {
        Args: { p_user_id: string };
        Returns: string;
      };
      prune_analytics_events: {
        Args: { p_limit?: number; p_retention?: string };
        Returns: number;
      };
      public_avatar_skin: { Args: { p_avatar_config: Json }; Returns: string };
      quest_xp: {
        Args: {
          p_base: number;
          p_hints_used: number;
          p_used_golden_key: boolean;
        };
        Returns: number;
      };
      record_guardian_consent: {
        Args: {
          p_agreements: Json;
          p_method: string;
          p_relation: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      record_hint: {
        Args: { p_level: number; p_quest_id: string; p_user_id: string };
        Returns: Json;
      };
      record_seen_unlocks: {
        Args: { p_stage_ids: string[]; p_user_id: string };
        Returns: number;
      };
      report_board_content: {
        Args: {
          p_reason: string;
          p_reporter_id: string;
          p_target_id: string;
          p_target_type: string;
        };
        Returns: Json;
      };
      reset_progress: {
        Args: { p_scope: string; p_stage_id?: string; p_user_id: string };
        Returns: Json;
      };
      settle_streak_shields: { Args: { p_user_id: string }; Returns: string[] };
      social_login_provider: {
        Args: { p_iss: string; p_provider: string };
        Returns: string;
      };
      spend_coins: {
        Args: { p_amount: number; p_ref: string; p_user_id: string };
        Returns: Json;
      };
      stage_chest_goal: { Args: { p_code_quests: number }; Returns: number };
      stamp_attendance: { Args: { p_user_id: string }; Returns: Json };
      streak_learning_days: { Args: { p_user_id: string }; Returns: string[] };
      submit_quiz_answer: {
        Args: { p_answer: Json; p_quest_id: string; p_user_id: string };
        Returns: Json;
      };
      use_golden_key: {
        Args: { p_quest_id: string; p_step?: number; p_user_id: string };
        Returns: Json;
      };
      world_daily_status: { Args: { p_user_id: string }; Returns: Json };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
