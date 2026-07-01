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
      contact_info: {
        Row: {
          address_line1: string
          address_line2: string
          city: string
          email: string
          facebook_url: string
          hours_public_visible: boolean
          id: number
          instagram_url: string
          maps_embed_url: string
          notification_email: string
          phone: string
          postal_code: string
          restaurant_name: string
          updated_at: string
        }
        Insert: {
          address_line1?: string
          address_line2?: string
          city?: string
          email?: string
          facebook_url?: string
          hours_public_visible?: boolean
          id?: number
          instagram_url?: string
          maps_embed_url?: string
          notification_email?: string
          phone?: string
          postal_code?: string
          restaurant_name?: string
          updated_at?: string
        }
        Update: {
          address_line1?: string
          address_line2?: string
          city?: string
          email?: string
          facebook_url?: string
          hours_public_visible?: boolean
          id?: number
          instagram_url?: string
          maps_embed_url?: string
          notification_email?: string
          phone?: string
          postal_code?: string
          restaurant_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      occasion_capacities: {
        Row: {
          max_reservations: number
          occasion: string
          updated_at: string
        }
        Insert: {
          max_reservations?: number
          occasion: string
          updated_at?: string
        }
        Update: {
          max_reservations?: number
          occasion?: string
          updated_at?: string
        }
        Relationships: []
      }
      opening_hours: {
        Row: {
          close_time: string
          is_closed: boolean
          label: string
          note: string
          open_time: string
          updated_at: string
          weekday: number
        }
        Insert: {
          close_time?: string
          is_closed?: boolean
          label: string
          note?: string
          open_time?: string
          updated_at?: string
          weekday: number
        }
        Update: {
          close_time?: string
          is_closed?: boolean
          label?: string
          note?: string
          open_time?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: []
      }
      page_views: {
        Row: {
          country: string
          created_at: string
          device: string
          id: number
          path: string
          referrer: string
          session_id: string
        }
        Insert: {
          country?: string
          created_at?: string
          device?: string
          id?: number
          path: string
          referrer?: string
          session_id?: string
        }
        Update: {
          country?: string
          created_at?: string
          device?: string
          id?: number
          path?: string
          referrer?: string
          session_id?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          admin_note: string
          cancellation_fee_amount: number
          cancellation_fee_charge_status: string | null
          cancellation_fee_charged_at: string | null
          cancellation_fee_currency: string
          cancellation_fee_payment_intent_id: string | null
          cancellation_reason: string | null
          cancellation_terms_accepted: boolean
          cancellation_terms_accepted_at: string | null
          cancelled_at: string | null
          country_code: string
          created_at: string
          event_date_label: string
          guest_email: string
          guest_name: string
          guest_phone: string
          id: string
          is_paid_occasion: boolean
          notes: string
          occasion: string
          party_size: number
          reservation_date: string
          reservation_time: string
          status: Database["public"]["Enums"]["reservation_status"]
          stripe_customer_id: string | null
          stripe_payment_method_id: string | null
          stripe_setup_intent_id: string | null
          updated_at: string
        }
        Insert: {
          admin_note?: string
          cancellation_fee_amount?: number
          cancellation_fee_charge_status?: string | null
          cancellation_fee_charged_at?: string | null
          cancellation_fee_currency?: string
          cancellation_fee_payment_intent_id?: string | null
          cancellation_reason?: string | null
          cancellation_terms_accepted?: boolean
          cancellation_terms_accepted_at?: string | null
          cancelled_at?: string | null
          country_code?: string
          created_at?: string
          event_date_label?: string
          guest_email: string
          guest_name: string
          guest_phone?: string
          id?: string
          is_paid_occasion?: boolean
          notes?: string
          occasion?: string
          party_size: number
          reservation_date: string
          reservation_time: string
          status?: Database["public"]["Enums"]["reservation_status"]
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          stripe_setup_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          admin_note?: string
          cancellation_fee_amount?: number
          cancellation_fee_charge_status?: string | null
          cancellation_fee_charged_at?: string | null
          cancellation_fee_currency?: string
          cancellation_fee_payment_intent_id?: string | null
          cancellation_reason?: string | null
          cancellation_terms_accepted?: boolean
          cancellation_terms_accepted_at?: string | null
          cancelled_at?: string | null
          country_code?: string
          created_at?: string
          event_date_label?: string
          guest_email?: string
          guest_name?: string
          guest_phone?: string
          id?: string
          is_paid_occasion?: boolean
          notes?: string
          occasion?: string
          party_size?: number
          reservation_date?: string
          reservation_time?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          stripe_setup_intent_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      seo_settings: {
        Row: {
          description: string
          label: string
          og_image: string
          path: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          description?: string
          label?: string
          og_image?: string
          path: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Update: {
          description?: string
          label?: string
          og_image?: string
          path?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_content: {
        Row: {
          key: string
          kind: string
          label: string
          sort_order: number
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          kind?: string
          label?: string
          sort_order?: number
          updated_at?: string
          value?: string
        }
        Update: {
          key?: string
          kind?: string
          label?: string
          sort_order?: number
          updated_at?: string
          value?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin"
      reservation_status: "pending" | "confirmed" | "declined" | "cancelled"
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
      app_role: ["admin"],
      reservation_status: ["pending", "confirmed", "declined", "cancelled"],
    },
  },
} as const
