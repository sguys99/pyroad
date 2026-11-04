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
      board_comments: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          post_id: string;
          user_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          id?: string;
          post_id: string;
          user_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
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
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      board_posts: {
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
            referencedRelation: 'user_profiles_public';
            referencedColumns: ['id'];
          },
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
          order: number;
          prompt_skeleton: Json;
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
          order: number;
          prompt_skeleton?: Json;
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
          order?: number;
          prompt_skeleton?: Json;
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
      stages: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          is_final: boolean;
          order: number;
          theme_name: string;
          title: string;
        };
        Insert: {
          created_at?: string;
          description?: string;
          id?: string;
          is_final?: boolean;
          order: number;
          theme_name: string;
          title: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          is_final?: boolean;
          order?: number;
          theme_name?: string;
          title?: string;
        };
        Relationships: [];
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
            referencedRelation: 'user_profiles_public';
            referencedColumns: ['id'];
          },
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
            referencedRelation: 'user_profiles_public';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_badges_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      user_progress: {
        Row: {
          code_submitted: string | null;
          completed_at: string | null;
          created_at: string;
          current_step: number | null;
          earned_xp: number;
          hints_used: number;
          id: string;
          quest_id: string;
          status: string;
          step_submissions: Json | null;
          used_golden_key: boolean;
          user_id: string;
        };
        Insert: {
          code_submitted?: string | null;
          completed_at?: string | null;
          created_at?: string;
          current_step?: number | null;
          earned_xp?: number;
          hints_used?: number;
          id?: string;
          quest_id: string;
          status?: string;
          step_submissions?: Json | null;
          used_golden_key?: boolean;
          user_id: string;
        };
        Update: {
          code_submitted?: string | null;
          completed_at?: string | null;
          created_at?: string;
          current_step?: number | null;
          earned_xp?: number;
          hints_used?: number;
          id?: string;
          quest_id?: string;
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
            referencedRelation: 'user_profiles_public';
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
      users: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          current_level: number;
          display_name: string;
          golden_keys: number;
          id: string;
          last_login_at: string;
          preferred_provider: string | null;
          total_xp: number;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          current_level?: number;
          display_name?: string;
          golden_keys?: number;
          id: string;
          last_login_at?: string;
          preferred_provider?: string | null;
          total_xp?: number;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          current_level?: number;
          display_name?: string;
          golden_keys?: number;
          id?: string;
          last_login_at?: string;
          preferred_provider?: string | null;
          total_xp?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      user_profiles_public: {
        Row: {
          avatar_url: string | null;
          display_name: string | null;
          id: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          display_name?: string | null;
          id?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          display_name?: string | null;
          id?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      complete_quest: {
        Args: { p_quest_id: string; p_submission: Json; p_user_id: string };
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
      has_three_day_streak: {
        Args: { p_completed_at: string[] };
        Returns: boolean;
      };
      is_stage_unlocked: {
        Args: { p_stage_id: string; p_user_id: string };
        Returns: boolean;
      };
      level_for_xp: { Args: { p_total_xp: number }; Returns: number };
      quest_xp: {
        Args: {
          p_base: number;
          p_hints_used: number;
          p_used_golden_key: boolean;
        };
        Returns: number;
      };
      reset_progress: {
        Args: { p_scope: string; p_stage_id?: string; p_user_id: string };
        Returns: Json;
      };
      use_golden_key: {
        Args: { p_quest_id: string; p_step?: number; p_user_id: string };
        Returns: Json;
      };
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
