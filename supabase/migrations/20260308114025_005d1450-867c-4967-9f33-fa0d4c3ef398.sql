-- =============================================
-- ERP + POS MVP Database Schema
-- =============================================

-- 1. ENUMS
-- =============================================
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'cashier', 'waiter', 'kitchen');
CREATE TYPE public.order_status AS ENUM ('pending', 'preparing', 'ready', 'served', 'completed', 'cancelled');
CREATE TYPE public.order_type AS ENUM ('dine_in', 'takeaway', 'delivery');
CREATE TYPE public.table_status AS ENUM ('available', 'occupied', 'reserved', 'cleaning');
CREATE TYPE public.payment_method AS ENUM ('cash', 'card', 'upi', 'wallet', 'split');
CREATE TYPE public.po_status AS ENUM ('draft', 'sent', 'partial', 'received', 'cancelled');
CREATE TYPE public.transaction_status AS ENUM ('completed', 'refunded', 'partially_refunded', 'voided');

-- 2. UTILITY FUNCTIONS
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3. CORE TABLES
-- =============================================

-- Businesses
CREATE TABLE public.businesses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  legal_name TEXT,
  tax_id TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  currency TEXT NOT NULL DEFAULT 'INR',
  tax_rate DECIMAL(5,2) DEFAULT 0,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Branches
CREATE TABLE public.branches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Profiles (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User Roles (RBAC)
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Permissions
CREATE TABLE public.permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role app_role NOT NULL,
  module TEXT NOT NULL,
  can_view BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  can_export BOOLEAN DEFAULT false,
  UNIQUE (role, module)
);

-- 4. PRODUCT & INVENTORY TABLES
-- =============================================

-- Categories
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Products
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT,
  barcode TEXT,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  cost_price DECIMAL(12,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  unit TEXT DEFAULT 'pcs',
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  track_inventory BOOLEAN DEFAULT true,
  min_stock INT DEFAULT 0,
  is_ingredient BOOLEAN DEFAULT false,
  modifiers JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Inventory
CREATE TABLE public.inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
  reserved_quantity DECIMAL(12,3) DEFAULT 0,
  batch_number TEXT,
  expiry_date DATE,
  last_counted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (product_id, branch_id, batch_number)
);

-- Suppliers
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  tax_id TEXT,
  payment_terms INT DEFAULT 30,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Purchase Orders
CREATE TABLE public.purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  order_number TEXT NOT NULL,
  status po_status DEFAULT 'draft',
  subtotal DECIMAL(12,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  expected_date DATE,
  received_date DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Purchase Order Items
CREATE TABLE public.purchase_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity DECIMAL(12,3) NOT NULL,
  received_quantity DECIMAL(12,3) DEFAULT 0,
  unit_price DECIMAL(12,2) NOT NULL,
  total_price DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Stock Movements
CREATE TABLE public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  quantity DECIMAL(12,3) NOT NULL,
  movement_type TEXT NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Recipes (for ingredient-based products)
CREATE TABLE public.recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity DECIMAL(12,3) NOT NULL,
  unit TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. SALES & POS TABLES
-- =============================================

-- Customers
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  loyalty_points INT DEFAULT 0,
  total_spent DECIMAL(12,2) DEFAULT 0,
  visit_count INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Shifts
CREATE TABLE public.shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opening_cash DECIMAL(12,2) NOT NULL DEFAULT 0,
  closing_cash DECIMAL(12,2),
  expected_cash DECIMAL(12,2),
  cash_difference DECIMAL(12,2),
  total_sales DECIMAL(12,2) DEFAULT 0,
  total_transactions INT DEFAULT 0,
  notes TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'open'
);

-- Transactions (Sales)
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  transaction_number TEXT NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  status transaction_status DEFAULT 'completed',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Transaction Items
CREATE TABLE public.transaction_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity DECIMAL(12,3) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total_price DECIMAL(12,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Payments
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  payment_method payment_method NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  reference_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. RESTAURANT TABLES
-- =============================================

-- Tables
CREATE TABLE public.tables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  capacity INT DEFAULT 4,
  status table_status DEFAULT 'available',
  position_x INT DEFAULT 0,
  position_y INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Orders (Kitchen Orders)
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  table_id UUID REFERENCES public.tables(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  order_number TEXT NOT NULL,
  order_type order_type NOT NULL DEFAULT 'dine_in',
  status order_status DEFAULT 'pending',
  guest_count INT DEFAULT 1,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Order Items
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity DECIMAL(12,3) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  modifiers JSONB DEFAULT '[]',
  notes TEXT,
  status order_status DEFAULT 'pending',
  sent_to_kitchen_at TIMESTAMP WITH TIME ZONE,
  prepared_at TIMESTAMP WITH TIME ZONE,
  served_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- KOT Tickets
CREATE TABLE public.kot_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  ticket_number TEXT NOT NULL,
  items JSONB NOT NULL,
  printed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. SYSTEM TABLES
-- =============================================

-- Audit Logs
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Settings
CREATE TABLE public.settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (business_id, key)
);

-- 8. ENABLE RLS ON ALL TABLES
-- =============================================
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kot_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- 9. SECURITY DEFINER FUNCTIONS
-- =============================================

-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Get user's business_id
CREATE OR REPLACE FUNCTION public.get_user_business_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT business_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- Get user's branch_id
CREATE OR REPLACE FUNCTION public.get_user_branch_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT branch_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- Check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

-- 10. RLS POLICIES
-- =============================================

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin(auth.uid()));

-- User Roles policies
CREATE POLICY "Admins can manage user roles" ON public.user_roles
  FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Permissions policies (read-only for all authenticated)
CREATE POLICY "Authenticated users can view permissions" ON public.permissions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage permissions" ON public.permissions
  FOR ALL USING (public.is_admin(auth.uid()));

-- Business-scoped table policies
CREATE POLICY "Users can view their business" ON public.businesses
  FOR SELECT USING (id = public.get_user_business_id(auth.uid()));
CREATE POLICY "Admins can manage business" ON public.businesses
  FOR ALL USING (public.is_admin(auth.uid()) AND id = public.get_user_business_id(auth.uid()));

CREATE POLICY "Users can view their branches" ON public.branches
  FOR SELECT USING (business_id = public.get_user_business_id(auth.uid()));
CREATE POLICY "Admins can manage branches" ON public.branches
  FOR ALL USING (public.is_admin(auth.uid()) AND business_id = public.get_user_business_id(auth.uid()));

CREATE POLICY "Users can view categories" ON public.categories
  FOR SELECT USING (business_id = public.get_user_business_id(auth.uid()));
CREATE POLICY "Admins/Managers can manage categories" ON public.categories
  FOR ALL USING (business_id = public.get_user_business_id(auth.uid()) AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'manager')));

CREATE POLICY "Users can view products" ON public.products
  FOR SELECT USING (business_id = public.get_user_business_id(auth.uid()));
CREATE POLICY "Admins/Managers can manage products" ON public.products
  FOR ALL USING (business_id = public.get_user_business_id(auth.uid()) AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'manager')));

CREATE POLICY "Users can view inventory" ON public.inventory
  FOR SELECT USING (branch_id IN (SELECT id FROM public.branches WHERE business_id = public.get_user_business_id(auth.uid())));
CREATE POLICY "Staff can manage inventory" ON public.inventory
  FOR ALL USING (branch_id IN (SELECT id FROM public.branches WHERE business_id = public.get_user_business_id(auth.uid())));

CREATE POLICY "Users can view suppliers" ON public.suppliers
  FOR SELECT USING (business_id = public.get_user_business_id(auth.uid()));
CREATE POLICY "Admins/Managers can manage suppliers" ON public.suppliers
  FOR ALL USING (business_id = public.get_user_business_id(auth.uid()) AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'manager')));

CREATE POLICY "Users can view purchase orders" ON public.purchase_orders
  FOR SELECT USING (business_id = public.get_user_business_id(auth.uid()));
CREATE POLICY "Admins/Managers can manage purchase orders" ON public.purchase_orders
  FOR ALL USING (business_id = public.get_user_business_id(auth.uid()) AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'manager')));

CREATE POLICY "Users can view PO items" ON public.purchase_order_items
  FOR SELECT USING (purchase_order_id IN (SELECT id FROM public.purchase_orders WHERE business_id = public.get_user_business_id(auth.uid())));
CREATE POLICY "Staff can manage PO items" ON public.purchase_order_items
  FOR ALL USING (purchase_order_id IN (SELECT id FROM public.purchase_orders WHERE business_id = public.get_user_business_id(auth.uid())));

CREATE POLICY "Users can view stock movements" ON public.stock_movements
  FOR SELECT USING (branch_id IN (SELECT id FROM public.branches WHERE business_id = public.get_user_business_id(auth.uid())));
CREATE POLICY "Staff can create stock movements" ON public.stock_movements
  FOR INSERT WITH CHECK (branch_id IN (SELECT id FROM public.branches WHERE business_id = public.get_user_business_id(auth.uid())));

CREATE POLICY "Users can view recipes" ON public.recipes
  FOR SELECT USING (product_id IN (SELECT id FROM public.products WHERE business_id = public.get_user_business_id(auth.uid())));
CREATE POLICY "Admins/Managers can manage recipes" ON public.recipes
  FOR ALL USING (product_id IN (SELECT id FROM public.products WHERE business_id = public.get_user_business_id(auth.uid())));

CREATE POLICY "Users can view customers" ON public.customers
  FOR SELECT USING (business_id = public.get_user_business_id(auth.uid()));
CREATE POLICY "Staff can manage customers" ON public.customers
  FOR ALL USING (business_id = public.get_user_business_id(auth.uid()));

CREATE POLICY "Users can view shifts" ON public.shifts
  FOR SELECT USING (branch_id IN (SELECT id FROM public.branches WHERE business_id = public.get_user_business_id(auth.uid())));
CREATE POLICY "Users can manage own shifts" ON public.shifts
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view transactions" ON public.transactions
  FOR SELECT USING (business_id = public.get_user_business_id(auth.uid()));
CREATE POLICY "Staff can create transactions" ON public.transactions
  FOR INSERT WITH CHECK (business_id = public.get_user_business_id(auth.uid()));
CREATE POLICY "Admins can manage transactions" ON public.transactions
  FOR ALL USING (public.is_admin(auth.uid()) AND business_id = public.get_user_business_id(auth.uid()));

CREATE POLICY "Users can view transaction items" ON public.transaction_items
  FOR SELECT USING (transaction_id IN (SELECT id FROM public.transactions WHERE business_id = public.get_user_business_id(auth.uid())));
CREATE POLICY "Staff can create transaction items" ON public.transaction_items
  FOR INSERT WITH CHECK (transaction_id IN (SELECT id FROM public.transactions WHERE business_id = public.get_user_business_id(auth.uid())));

CREATE POLICY "Users can view payments" ON public.payments
  FOR SELECT USING (transaction_id IN (SELECT id FROM public.transactions WHERE business_id = public.get_user_business_id(auth.uid())));
CREATE POLICY "Staff can create payments" ON public.payments
  FOR INSERT WITH CHECK (transaction_id IN (SELECT id FROM public.transactions WHERE business_id = public.get_user_business_id(auth.uid())));

CREATE POLICY "Users can view tables" ON public.tables
  FOR SELECT USING (branch_id IN (SELECT id FROM public.branches WHERE business_id = public.get_user_business_id(auth.uid())));
CREATE POLICY "Staff can manage tables" ON public.tables
  FOR ALL USING (branch_id IN (SELECT id FROM public.branches WHERE business_id = public.get_user_business_id(auth.uid())));

CREATE POLICY "Users can view orders" ON public.orders
  FOR SELECT USING (business_id = public.get_user_business_id(auth.uid()));
CREATE POLICY "Staff can manage orders" ON public.orders
  FOR ALL USING (business_id = public.get_user_business_id(auth.uid()));

CREATE POLICY "Users can view order items" ON public.order_items
  FOR SELECT USING (order_id IN (SELECT id FROM public.orders WHERE business_id = public.get_user_business_id(auth.uid())));
CREATE POLICY "Staff can manage order items" ON public.order_items
  FOR ALL USING (order_id IN (SELECT id FROM public.orders WHERE business_id = public.get_user_business_id(auth.uid())));

CREATE POLICY "Users can view KOT tickets" ON public.kot_tickets
  FOR SELECT USING (order_id IN (SELECT id FROM public.orders WHERE business_id = public.get_user_business_id(auth.uid())));
CREATE POLICY "Staff can create KOT tickets" ON public.kot_tickets
  FOR INSERT WITH CHECK (order_id IN (SELECT id FROM public.orders WHERE business_id = public.get_user_business_id(auth.uid())));

CREATE POLICY "Admins can view audit logs" ON public.audit_logs
  FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "System can create audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view settings" ON public.settings
  FOR SELECT USING (business_id = public.get_user_business_id(auth.uid()));
CREATE POLICY "Admins can manage settings" ON public.settings
  FOR ALL USING (public.is_admin(auth.uid()) AND business_id = public.get_user_business_id(auth.uid()));

-- 11. TRIGGERS
-- =============================================
CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tables_updated_at BEFORE UPDATE ON public.tables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 12. AUTO-CREATE PROFILE ON SIGNUP
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 13. INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX idx_profiles_business_id ON public.profiles(business_id);
CREATE INDEX idx_profiles_branch_id ON public.profiles(branch_id);
CREATE INDEX idx_branches_business_id ON public.branches(business_id);
CREATE INDEX idx_categories_business_id ON public.categories(business_id);
CREATE INDEX idx_products_business_id ON public.products(business_id);
CREATE INDEX idx_products_category_id ON public.products(category_id);
CREATE INDEX idx_products_barcode ON public.products(barcode);
CREATE INDEX idx_products_sku ON public.products(sku);
CREATE INDEX idx_inventory_product_id ON public.inventory(product_id);
CREATE INDEX idx_inventory_branch_id ON public.inventory(branch_id);
CREATE INDEX idx_transactions_business_id ON public.transactions(business_id);
CREATE INDEX idx_transactions_branch_id ON public.transactions(branch_id);
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at);
CREATE INDEX idx_orders_business_id ON public.orders(business_id);
CREATE INDEX idx_orders_table_id ON public.orders(table_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_tables_branch_id ON public.tables(branch_id);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at);

-- 14. INSERT DEFAULT PERMISSIONS
-- =============================================
INSERT INTO public.permissions (role, module, can_view, can_create, can_edit, can_delete, can_export) VALUES
('admin', 'dashboard', true, true, true, true, true),
('admin', 'pos', true, true, true, true, true),
('admin', 'inventory', true, true, true, true, true),
('admin', 'customers', true, true, true, true, true),
('admin', 'reports', true, true, true, true, true),
('admin', 'settings', true, true, true, true, true),
('admin', 'users', true, true, true, true, true),
('manager', 'dashboard', true, true, true, false, true),
('manager', 'pos', true, true, true, true, true),
('manager', 'inventory', true, true, true, true, true),
('manager', 'customers', true, true, true, false, true),
('manager', 'reports', true, false, false, false, true),
('manager', 'settings', true, false, false, false, false),
('manager', 'users', true, false, false, false, false),
('cashier', 'dashboard', true, false, false, false, false),
('cashier', 'pos', true, true, false, false, false),
('cashier', 'inventory', true, false, false, false, false),
('cashier', 'customers', true, true, false, false, false),
('cashier', 'reports', false, false, false, false, false),
('cashier', 'settings', false, false, false, false, false),
('cashier', 'users', false, false, false, false, false),
('waiter', 'dashboard', false, false, false, false, false),
('waiter', 'pos', true, true, true, false, false),
('waiter', 'inventory', false, false, false, false, false),
('waiter', 'customers', true, true, false, false, false),
('waiter', 'reports', false, false, false, false, false),
('waiter', 'settings', false, false, false, false, false),
('waiter', 'users', false, false, false, false, false),
('kitchen', 'dashboard', false, false, false, false, false),
('kitchen', 'pos', true, false, true, false, false),
('kitchen', 'inventory', true, false, false, false, false),
('kitchen', 'customers', false, false, false, false, false),
('kitchen', 'reports', false, false, false, false, false),
('kitchen', 'settings', false, false, false, false, false),
('kitchen', 'users', false, false, false, false, false);