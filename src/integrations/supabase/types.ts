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
      app_announcements: {
        Row: {
          body: string
          created_at: string
          expires_at: string | null
          id: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          expires_at?: string | null
          id?: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      app_changelogs: {
        Row: {
          created_at: string
          data: string
          descricao: string
          id: string
          titulo: string
        }
        Insert: {
          created_at?: string
          data: string
          descricao: string
          id?: string
          titulo: string
        }
        Update: {
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          titulo?: string
        }
        Relationships: []
      }
      app_cliente_logs: {
        Row: {
          cliente_id: string
          cliente_nome: string
          created_at: string
          editor_id: string
          editor_username: string
          field: string
          id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          cliente_id: string
          cliente_nome: string
          created_at?: string
          editor_id: string
          editor_username: string
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          cliente_id?: string
          cliente_nome?: string
          created_at?: string
          editor_id?: string
          editor_username?: string
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: []
      }
      app_clientes: {
        Row: {
          celular: string | null
          cliente_brabo: boolean
          cliente_brabo_expira: string | null
          created_at: string
          criado_por: string
          id: string
          id_passaporte: string
          nome: string
          updated_at: string
        }
        Insert: {
          celular?: string | null
          cliente_brabo?: boolean
          cliente_brabo_expira?: string | null
          created_at?: string
          criado_por: string
          id?: string
          id_passaporte: string
          nome: string
          updated_at?: string
        }
        Update: {
          celular?: string | null
          cliente_brabo?: boolean
          cliente_brabo_expira?: string | null
          created_at?: string
          criado_por?: string
          id?: string
          id_passaporte?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_clientes_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      app_config: {
        Row: {
          data: Json
          id: number
          updated_at: string
        }
        Insert: {
          data: Json
          id?: number
          updated_at?: string
        }
        Update: {
          data?: Json
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      app_sessions: {
        Row: {
          created_at: string
          expires_at: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          token?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      app_sugestoes: {
        Row: {
          created_at: string
          id: string
          mensagem: string
          status: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          mensagem: string
          status?: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          mensagem?: string
          status?: string
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_sugestoes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      app_timeclock: {
        Row: {
          entry_at: string
          exit_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          entry_at?: string
          exit_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          entry_at?: string
          exit_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      app_users: {
        Row: {
          birthday: string | null
          created_at: string
          display_id: string | null
          id: string
          password: string
          quick_tabs: Json | null
          role: string
          status: string
          username: string
        }
        Insert: {
          birthday?: string | null
          created_at?: string
          display_id?: string | null
          id?: string
          password: string
          quick_tabs?: Json | null
          role?: string
          status?: string
          username: string
        }
        Update: {
          birthday?: string | null
          created_at?: string
          display_id?: string | null
          id?: string
          password?: string
          quick_tabs?: Json | null
          role?: string
          status?: string
          username?: string
        }
        Relationships: []
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
