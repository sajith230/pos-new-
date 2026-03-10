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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      branches: {
        Row: {
          address: string | null
          business_id: string
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          settings: Json | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          settings?: Json | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          settings?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string | null
          created_at: string
          currency: string
          email: string | null
          id: string
          legal_name: string | null
          logo_url: string | null
          name: string
          phone: string | null
          settings: Json | null
          tax_id: string | null
          tax_rate: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name: string
          phone?: string | null
          settings?: Json | null
          tax_id?: string | null
          tax_rate?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          settings?: Json | null
          tax_id?: string | null
          tax_rate?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          business_id: string
          created_at: string
          email: string | null
          id: string
          loyalty_points: number | null
          name: string
          notes: string | null
          phone: string | null
          total_spent: number | null
          updated_at: string
          visit_count: number | null
        }
        Insert: {
          address?: string | null
          business_id: string
          created_at?: string
          email?: string | null
          id?: string
          loyalty_points?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          total_spent?: number | null
          updated_at?: string
          visit_count?: number | null
        }
        Update: {
          address?: string | null
          business_id?: string
          created_at?: string
          email?: string | null
          id?: string
          loyalty_points?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          total_spent?: number | null
          updated_at?: string
          visit_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          batch_number: string | null
          branch_id: string
          created_at: string
          expiry_date: string | null
          id: string
          last_counted_at: string | null
          product_id: string
          quantity: number
          reserved_quantity: number | null
          updated_at: string
        }
        Insert: {
          batch_number?: string | null
          branch_id: string
          created_at?: string
          expiry_date?: string | null
          id?: string
          last_counted_at?: string | null
          product_id: string
          quantity?: number
          reserved_quantity?: number | null
          updated_at?: string
        }
        Update: {
          batch_number?: string | null
          branch_id?: string
          created_at?: string
          expiry_date?: string | null
          id?: string
          last_counted_at?: string | null
          product_id?: string
          quantity?: number
          reserved_quantity?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      kot_tickets: {
        Row: {
          created_at: string
          id: string
          items: Json
          order_id: string
          printed_at: string | null
          ticket_number: string
        }
        Insert: {
          created_at?: string
          id?: string
          items: Json
          order_id: string
          printed_at?: string | null
          ticket_number: string
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json
          order_id?: string
          printed_at?: string | null
          ticket_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "kot_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          browser_push: boolean
          created_at: string
          id: string
          low_stock: boolean
          new_order: boolean
          order_cancelled: boolean
          order_ready: boolean
          system: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          browser_push?: boolean
          created_at?: string
          id?: string
          low_stock?: boolean
          new_order?: boolean
          order_cancelled?: boolean
          order_ready?: boolean
          system?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          browser_push?: boolean
          created_at?: string
          id?: string
          low_stock?: boolean
          new_order?: boolean
          order_cancelled?: boolean
          order_ready?: boolean
          system?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          business_id: string
          category: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string
          reference_id: string | null
          reference_type: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          business_id: string
          category?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          business_id?: string
          category?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          modifiers: Json | null
          notes: string | null
          order_id: string
          prepared_at: string | null
          product_id: string
          quantity: number
          sent_to_kitchen_at: string | null
          served_at: string | null
          status: Database["public"]["Enums"]["order_status"] | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          modifiers?: Json | null
          notes?: string | null
          order_id: string
          prepared_at?: string | null
          product_id: string
          quantity: number
          sent_to_kitchen_at?: string | null
          served_at?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          modifiers?: Json | null
          notes?: string | null
          order_id?: string
          prepared_at?: string | null
          product_id?: string
          quantity?: number
          sent_to_kitchen_at?: string | null
          served_at?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          branch_id: string
          business_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          guest_count: number | null
          id: string
          notes: string | null
          order_number: string
          order_type: Database["public"]["Enums"]["order_type"]
          status: Database["public"]["Enums"]["order_status"] | null
          table_id: string | null
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          branch_id: string
          business_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          guest_count?: number | null
          id?: string
          notes?: string | null
          order_number: string
          order_type?: Database["public"]["Enums"]["order_type"]
          status?: Database["public"]["Enums"]["order_status"] | null
          table_id?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string
          business_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          guest_count?: number | null
          id?: string
          notes?: string | null
          order_number?: string
          order_type?: Database["public"]["Enums"]["order_type"]
          status?: Database["public"]["Enums"]["order_status"] | null
          table_id?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          reference_number: string | null
          transaction_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          reference_number?: string | null
          transaction_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          reference_number?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          can_create: boolean | null
          can_delete: boolean | null
          can_edit: boolean | null
          can_export: boolean | null
          can_view: boolean | null
          id: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_export?: boolean | null
          can_view?: boolean | null
          id?: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_export?: boolean | null
          can_view?: boolean | null
          id?: string
          module?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      products: {
        Row: {
          barcode: string | null
          business_id: string
          category_id: string | null
          cost_price: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_ingredient: boolean | null
          min_stock: number | null
          modifiers: Json | null
          name: string
          prep_time: number | null
          price: number
          sku: string | null
          tax_rate: number | null
          track_inventory: boolean | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          business_id: string
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_ingredient?: boolean | null
          min_stock?: number | null
          modifiers?: Json | null
          name: string
          prep_time?: number | null
          price?: number
          sku?: string | null
          tax_rate?: number | null
          track_inventory?: boolean | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          business_id?: string
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_ingredient?: boolean | null
          min_stock?: number | null
          modifiers?: Json | null
          name?: string
          prep_time?: number | null
          price?: number
          sku?: string | null
          tax_rate?: number | null
          track_inventory?: boolean | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          branch_id: string | null
          business_id: string | null
          created_at: string
          full_name: string | null
          id: string
          is_active: boolean | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          branch_id?: string | null
          business_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          branch_id?: string | null
          business_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          purchase_order_id: string
          quantity: number
          received_quantity: number | null
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          purchase_order_id: string
          quantity: number
          received_quantity?: number | null
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          purchase_order_id?: string
          quantity?: number
          received_quantity?: number | null
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          branch_id: string
          business_id: string
          created_at: string
          created_by: string | null
          expected_date: string | null
          id: string
          notes: string | null
          order_number: string
          received_date: string | null
          status: Database["public"]["Enums"]["po_status"] | null
          subtotal: number | null
          supplier_id: string
          tax_amount: number | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          branch_id: string
          business_id: string
          created_at?: string
          created_by?: string | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_number: string
          received_date?: string | null
          status?: Database["public"]["Enums"]["po_status"] | null
          subtotal?: number | null
          supplier_id: string
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          branch_id?: string
          business_id?: string
          created_at?: string
          created_by?: string | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          received_date?: string | null
          status?: Database["public"]["Enums"]["po_status"] | null
          subtotal?: number | null
          supplier_id?: string
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          created_at: string
          id: string
          ingredient_id: string
          product_id: string
          quantity: number
          unit: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_id: string
          product_id: string
          quantity: number
          unit?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_id?: string
          product_id?: string
          quantity?: number
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipes_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          business_id: string
          created_at: string
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          branch_id: string
          cash_difference: number | null
          closing_cash: number | null
          ended_at: string | null
          expected_cash: number | null
          id: string
          notes: string | null
          opening_cash: number
          started_at: string
          status: string | null
          total_sales: number | null
          total_transactions: number | null
          user_id: string
        }
        Insert: {
          branch_id: string
          cash_difference?: number | null
          closing_cash?: number | null
          ended_at?: string | null
          expected_cash?: number | null
          id?: string
          notes?: string | null
          opening_cash?: number
          started_at?: string
          status?: string | null
          total_sales?: number | null
          total_transactions?: number | null
          user_id: string
        }
        Update: {
          branch_id?: string
          cash_difference?: number | null
          closing_cash?: number | null
          ended_at?: string | null
          expected_cash?: number | null
          id?: string
          notes?: string | null
          opening_cash?: number
          started_at?: string
          status?: string | null
          total_sales?: number | null
          total_transactions?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          movement_type: string
          notes: string | null
          product_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          business_id: string
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          payment_terms: number | null
          phone: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_id: string
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          payment_terms?: number | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_id?: string
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          payment_terms?: number | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          branch_id: string
          capacity: number | null
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          position_x: number | null
          position_y: number | null
          status: Database["public"]["Enums"]["table_status"] | null
          updated_at: string
        }
        Insert: {
          branch_id: string
          capacity?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          position_x?: number | null
          position_y?: number | null
          status?: Database["public"]["Enums"]["table_status"] | null
          updated_at?: string
        }
        Update: {
          branch_id?: string
          capacity?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          position_x?: number | null
          position_y?: number | null
          status?: Database["public"]["Enums"]["table_status"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tables_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_items: {
        Row: {
          created_at: string
          discount_amount: number | null
          id: string
          notes: string | null
          product_id: string
          quantity: number
          tax_amount: number | null
          total_price: number
          transaction_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          discount_amount?: number | null
          id?: string
          notes?: string | null
          product_id: string
          quantity: number
          tax_amount?: number | null
          total_price: number
          transaction_id: string
          unit_price: number
        }
        Update: {
          created_at?: string
          discount_amount?: number | null
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          tax_amount?: number | null
          total_price?: number
          transaction_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "transaction_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          branch_id: string
          business_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          discount_amount: number | null
          discount_percent: number | null
          id: string
          notes: string | null
          shift_id: string | null
          status: Database["public"]["Enums"]["transaction_status"] | null
          subtotal: number
          tax_amount: number | null
          total_amount: number
          transaction_number: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          business_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          notes?: string | null
          shift_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"] | null
          subtotal?: number
          tax_amount?: number | null
          total_amount?: number
          transaction_number: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          business_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          notes?: string | null
          shift_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"] | null
          subtotal?: number
          tax_amount?: number | null
          total_amount?: number
          transaction_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      check_low_stock: {
        Args: { _branch_id: string }
        Returns: {
          min_stock: number
          product_id: string
          product_name: string
          quantity: number
        }[]
      }
      deduct_stock_for_sale: {
        Args: {
          _branch_id: string
          _product_id: string
          _quantity: number
          _reference_id: string
        }
        Returns: number
      }
      get_user_branch_id: { Args: { _user_id: string }; Returns: string }
      get_user_business_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      setup_new_business: {
        Args: {
          _address?: string
          _currency?: string
          _email?: string
          _legal_name?: string
          _name: string
          _phone?: string
          _tax_id?: string
          _tax_rate?: number
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "cashier" | "waiter" | "kitchen"
      order_status:
        | "pending"
        | "preparing"
        | "ready"
        | "served"
        | "completed"
        | "cancelled"
      order_type: "dine_in" | "takeaway" | "delivery"
      payment_method: "cash" | "card" | "upi" | "wallet" | "split"
      po_status: "draft" | "sent" | "partial" | "received" | "cancelled"
      table_status: "available" | "occupied" | "reserved" | "cleaning"
      transaction_status:
        | "completed"
        | "refunded"
        | "partially_refunded"
        | "voided"
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
      app_role: ["admin", "manager", "cashier", "waiter", "kitchen"],
      order_status: [
        "pending",
        "preparing",
        "ready",
        "served",
        "completed",
        "cancelled",
      ],
      order_type: ["dine_in", "takeaway", "delivery"],
      payment_method: ["cash", "card", "upi", "wallet", "split"],
      po_status: ["draft", "sent", "partial", "received", "cancelled"],
      table_status: ["available", "occupied", "reserved", "cleaning"],
      transaction_status: [
        "completed",
        "refunded",
        "partially_refunded",
        "voided",
      ],
    },
  },
} as const
