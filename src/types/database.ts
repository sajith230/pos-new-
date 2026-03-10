export type AppRole = 'admin' | 'manager' | 'cashier' | 'waiter' | 'kitchen';
export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled';
export type OrderType = 'dine_in' | 'takeaway' | 'delivery';
export type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning';
export type PaymentMethod = 'cash' | 'card' | 'upi' | 'wallet' | 'split';
export type POStatus = 'draft' | 'sent' | 'partial' | 'received' | 'cancelled';
export type TransactionStatus = 'completed' | 'refunded' | 'partially_refunded' | 'voided';

export interface Business {
  id: string;
  name: string;
  legal_name?: string | null;
  tax_id?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  currency: string;
  tax_rate: number | null;
  logo_url?: string | null;
  settings: unknown;
  created_at: string;
  updated_at: string;
}

export interface Branch {
  id: string;
  business_id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  is_active: boolean | null;
  settings: unknown;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  business_id?: string | null;
  branch_id?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface Permission {
  id: string;
  role: AppRole;
  module: string;
  can_view: boolean | null;
  can_create: boolean | null;
  can_edit: boolean | null;
  can_delete: boolean | null;
  can_export: boolean | null;
}

export interface Category {
  id: string;
  business_id: string;
  name: string;
  description?: string | null;
  parent_id?: string | null;
  sort_order: number | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  business_id: string;
  category_id?: string | null;
  name: string;
  description?: string | null;
  sku?: string | null;
  barcode?: string | null;
  price: number;
  cost_price: number | null;
  tax_rate: number | null;
  unit: string | null;
  image_url?: string | null;
  is_active: boolean | null;
  track_inventory: boolean | null;
  min_stock: number | null;
  is_ingredient: boolean | null;
  modifiers: unknown;
  prep_time: number | null;
  created_at: string;
  updated_at: string;
  category?: Category;
}

export interface Inventory {
  id: string;
  product_id: string;
  branch_id: string;
  quantity: number;
  reserved_quantity: number | null;
  batch_number?: string | null;
  expiry_date?: string | null;
  last_counted_at?: string | null;
  created_at: string;
  updated_at: string;
  product?: Product;
}

export interface Supplier {
  id: string;
  business_id: string;
  name: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  tax_id?: string | null;
  payment_terms: number | null;
  notes?: string | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  loyalty_points: number | null;
  total_spent: number | null;
  visit_count: number | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Shift {
  id: string;
  branch_id: string;
  user_id: string;
  opening_cash: number;
  closing_cash?: number | null;
  expected_cash?: number | null;
  cash_difference?: number | null;
  total_sales: number | null;
  total_transactions: number | null;
  notes?: string | null;
  started_at: string;
  ended_at?: string | null;
  status: string | null;
}

export interface Transaction {
  id: string;
  business_id: string;
  branch_id: string;
  shift_id?: string | null;
  customer_id?: string | null;
  transaction_number: string;
  subtotal: number;
  discount_amount: number | null;
  discount_percent: number | null;
  tax_amount: number | null;
  total_amount: number;
  status: TransactionStatus | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  items?: TransactionItem[];
  payments?: Payment[];
  customer?: Customer;
}

export interface TransactionItem {
  id: string;
  transaction_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  discount_amount: number | null;
  tax_amount: number | null;
  total_price: number;
  notes?: string | null;
  created_at: string;
  product?: Product;
}

export interface Payment {
  id: string;
  transaction_id: string;
  payment_method: PaymentMethod;
  amount: number;
  reference_number?: string | null;
  created_at: string;
}

export interface Table {
  id: string;
  branch_id: string;
  name: string;
  capacity: number | null;
  status: TableStatus | null;
  position_x: number | null;
  position_y: number | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
  current_order?: Order;
}

export interface Order {
  id: string;
  business_id: string;
  branch_id: string;
  table_id?: string | null;
  transaction_id?: string | null;
  customer_id?: string | null;
  order_number: string;
  order_type: OrderType;
  status: OrderStatus | null;
  guest_count: number | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  table?: Table;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  modifiers: unknown;
  notes?: string | null;
  status: OrderStatus | null;
  sent_to_kitchen_at?: string | null;
  prepared_at?: string | null;
  served_at?: string | null;
  created_at: string;
  product?: Product;
}

export interface KOTTicket {
  id: string;
  order_id: string;
  ticket_number: string;
  items: unknown;
  printed_at: string | null;
  created_at: string;
}

export interface Recipe {
  id: string;
  product_id: string;
  ingredient_id: string;
  quantity: number;
  unit: string | null;
  created_at: string;
  ingredient?: Product;
}

// Cart types for POS
export interface CartItem {
  product: Product;
  quantity: number;
  notes?: string;
  modifiers?: unknown[];
  discount_amount?: number;
}