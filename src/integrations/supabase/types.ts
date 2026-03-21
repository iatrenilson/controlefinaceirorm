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
      bank_balances: {
        Row: {
          banco: string
          created_at: string
          id: string
          saldo: number
          updated_at: string
          user_id: string
        }
        Insert: {
          banco: string
          created_at?: string
          id?: string
          saldo?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          banco?: string
          created_at?: string
          id?: string
          saldo?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          created_at: string
          data_emprestimo: string
          data_pagamento: string
          id: string
          juros: number
          nome: string
          telefone: string
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          data_emprestimo: string
          data_pagamento: string
          id?: string
          juros: number
          nome: string
          telefone: string
          user_id: string
          valor: number
        }
        Update: {
          created_at?: string
          data_emprestimo?: string
          data_pagamento?: string
          id?: string
          juros?: number
          nome?: string
          telefone?: string
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      clientes_historico: {
        Row: {
          archived_at: string
          cliente_id: string | null
          created_at: string
          data_emprestimo: string
          data_pagamento: string
          id: string
          juros: number
          nome: string
          telefone: string | null
          tipo: string
          user_id: string
          valor: number
        }
        Insert: {
          archived_at?: string
          cliente_id?: string | null
          created_at?: string
          data_emprestimo: string
          data_pagamento: string
          id?: string
          juros: number
          nome: string
          telefone?: string | null
          tipo?: string
          user_id: string
          valor: number
        }
        Update: {
          archived_at?: string
          cliente_id?: string | null
          created_at?: string
          data_emprestimo?: string
          data_pagamento?: string
          id?: string
          juros?: number
          nome?: string
          telefone?: string | null
          tipo?: string
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      delay_clientes: {
        Row: {
          banco_deposito: string | null
          casa: string
          created_at: string
          created_by_token: string | null
          custos: number
          data_deposito: string | null
          deposito_pendente: number
          depositos: number
          fornecedor: string | null
          id: string
          informacoes_adicionais: string | null
          login: string | null
          lucro: number
          nome: string
          operacao: string
          saques: number
          senha: string | null
          sort_order: number | null
          status: string
          tipo: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          banco_deposito?: string | null
          casa?: string
          created_at?: string
          created_by_token?: string | null
          custos?: number
          data_deposito?: string | null
          deposito_pendente?: number
          depositos?: number
          fornecedor?: string | null
          id?: string
          informacoes_adicionais?: string | null
          login?: string | null
          lucro?: number
          nome: string
          operacao?: string
          saques?: number
          senha?: string | null
          sort_order?: number | null
          status?: string
          tipo?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          banco_deposito?: string | null
          casa?: string
          created_at?: string
          created_by_token?: string | null
          custos?: number
          data_deposito?: string | null
          deposito_pendente?: number
          depositos?: number
          fornecedor?: string | null
          id?: string
          informacoes_adicionais?: string | null
          login?: string | null
          lucro?: number
          nome?: string
          operacao?: string
          saques?: number
          senha?: string | null
          sort_order?: number | null
          status?: string
          tipo?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delay_clientes_created_by_token_fkey"
            columns: ["created_by_token"]
            isOneToOne: false
            referencedRelation: "delay_share_links"
            referencedColumns: ["id"]
          },
        ]
      }
      delay_share_links: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nick: string | null
          tipo: string
          token: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nick?: string | null
          tipo?: string
          token?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nick?: string | null
          tipo?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      delay_transacoes: {
        Row: {
          banco_destino: string | null
          casa: string
          cliente_id: string
          created_at: string
          custo: number
          data_transacao: string
          dividir_lucro: boolean
          id: string
          lucro: number
          tipo: string
          user_id: string
          valor: number
        }
        Insert: {
          banco_destino?: string | null
          casa?: string
          cliente_id: string
          created_at?: string
          custo?: number
          data_transacao?: string
          dividir_lucro?: boolean
          id?: string
          lucro?: number
          tipo?: string
          user_id: string
          valor?: number
        }
        Update: {
          banco_destino?: string | null
          casa?: string
          cliente_id?: string
          created_at?: string
          custo?: number
          data_transacao?: string
          dividir_lucro?: boolean
          id?: string
          lucro?: number
          tipo?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "delay_transacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "delay_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      financeiro: {
        Row: {
          created_at: string
          data_compra: string | null
          data_vencimento: string
          descricao: string
          id: string
          parcela_atual: number | null
          parcelas: number | null
          status: string
          tipo: string
          ultimo_pagamento: string | null
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          data_compra?: string | null
          data_vencimento: string
          descricao: string
          id?: string
          parcela_atual?: number | null
          parcelas?: number | null
          status?: string
          tipo: string
          ultimo_pagamento?: string | null
          user_id: string
          valor: number
        }
        Update: {
          created_at?: string
          data_compra?: string | null
          data_vencimento?: string
          descricao?: string
          id?: string
          parcela_atual?: number | null
          parcelas?: number | null
          status?: string
          tipo?: string
          ultimo_pagamento?: string | null
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          alta_atividade: boolean
          created_at: string
          email_enabled: boolean
          enabled: boolean
          id: string
          meta_100: boolean
          meta_50: boolean
          meta_75: boolean
          meta_mensal: number
          meta_superada: boolean
          novos_clientes: boolean
          push_enabled: boolean
          relatorio_email: boolean
          relatorio_frequencia: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alta_atividade?: boolean
          created_at?: string
          email_enabled?: boolean
          enabled?: boolean
          id?: string
          meta_100?: boolean
          meta_50?: boolean
          meta_75?: boolean
          meta_mensal?: number
          meta_superada?: boolean
          novos_clientes?: boolean
          push_enabled?: boolean
          relatorio_email?: boolean
          relatorio_frequencia?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alta_atividade?: boolean
          created_at?: string
          email_enabled?: boolean
          enabled?: boolean
          id?: string
          meta_100?: boolean
          meta_50?: boolean
          meta_75?: boolean
          meta_mensal?: number
          meta_superada?: boolean
          novos_clientes?: boolean
          push_enabled?: boolean
          relatorio_email?: boolean
          relatorio_frequencia?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          created_by: string
          id: string
          mensagem: string
          target_user_id: string | null
          titulo: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          mensagem: string
          target_user_id?: string | null
          titulo: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          mensagem?: string
          target_user_id?: string | null
          titulo?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          complemento: string | null
          created_at: string
          email: string | null
          endereco: string | null
          id: string
          nome: string | null
          ponto_referencia: string | null
          telefone: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          complemento?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string | null
          ponto_referencia?: string | null
          telefone?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          complemento?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string | null
          ponto_referencia?: string | null
          telefone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          created_at: string
          id: string
          lida: boolean
          notification_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean
          notification_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean
          notification_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notifications_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          origem: string
          saldo_anterior: number
          saldo_posterior: number
          tipo: string
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          origem?: string
          saldo_anterior: number
          saldo_posterior: number
          tipo: string
          user_id: string
          valor: number
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          origem?: string
          saldo_anterior?: number
          saldo_posterior?: number
          tipo?: string
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      wallets: {
        Row: {
          created_at: string
          id: string
          saldo: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          saldo?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          saldo?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_clear_all_notifications: { Args: never; Returns: undefined }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "restrito"
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
      app_role: ["admin", "moderator", "user", "restrito"],
    },
  },
} as const
