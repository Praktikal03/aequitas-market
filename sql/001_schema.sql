-- ============================================================
-- AEQUITAS MARKET — Supabase Database Schema
-- Run this in Supabase SQL Editor after creating your project
-- ============================================================

-- --------------------------------------------------------
-- 1. PROFILES (extends Supabase auth.users)
-- --------------------------------------------------------
-- We use a separate profiles table linked to auth.users
-- so we can store marketplace-specific data without
-- touching Supabase's built-in auth system.

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer', 'seller', 'admin')),
  instagram TEXT,
  category TEXT,
  is_founding BOOLEAN DEFAULT FALSE,
  fee_rate NUMERIC(4,2) DEFAULT 10.00,
  stripe_account_id TEXT,
  stripe_onboarded BOOLEAN DEFAULT FALSE,
  bio TEXT,
  avatar_url TEXT,
  shop_name TEXT,
  approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'buyer')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- --------------------------------------------------------
-- 2. LISTINGS
-- --------------------------------------------------------

CREATE TABLE public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL CHECK (price > 0),
  category TEXT NOT NULL CHECK (category IN (
    'clothing', 'electronics', 'vintage', 'art', 'collectibles', 'general'
  )),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'active', 'sold', 'removed', 'draft'
  )),
  images JSONB DEFAULT '[]'::jsonb,
  shipping_cost NUMERIC(10,2) DEFAULT 0.00,
  condition TEXT CHECK (condition IN (
    'new', 'like_new', 'good', 'fair', 'poor'
  )),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for browsing/search
CREATE INDEX idx_listings_status_category ON public.listings(status, category);
CREATE INDEX idx_listings_seller ON public.listings(seller_id);
CREATE INDEX idx_listings_created ON public.listings(created_at DESC);

-- --------------------------------------------------------
-- 3. ORDERS
-- --------------------------------------------------------

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES public.profiles(id),
  seller_id UUID NOT NULL REFERENCES public.profiles(id),
  subtotal NUMERIC(10,2) NOT NULL,
  shipping_cost NUMERIC(10,2) DEFAULT 0.00,
  platform_fee NUMERIC(10,2) NOT NULL,
  stripe_fee NUMERIC(10,2) NOT NULL,
  seller_payout NUMERIC(10,2) NOT NULL,
  stripe_payment_id TEXT,
  stripe_transfer_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'paid', 'shipped', 'delivered', 'completed', 'disputed', 'refunded', 'cancelled'
  )),
  tracking_number TEXT,
  shipping_carrier TEXT,
  buyer_confirmed_delivery BOOLEAN DEFAULT FALSE,
  admin_released_funds BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_orders_buyer ON public.orders(buyer_id);
CREATE INDEX idx_orders_seller ON public.orders(seller_id);
CREATE INDEX idx_orders_status ON public.orders(status);

-- --------------------------------------------------------
-- 4. ORDER ITEMS
-- --------------------------------------------------------

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id),
  price_at_purchase NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0)
);

CREATE INDEX idx_order_items_order ON public.order_items(order_id);

-- --------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS)
-- --------------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- PROFILES policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- LISTINGS policies
CREATE POLICY "Active listings are viewable by everyone"
  ON public.listings FOR SELECT
  USING (status = 'active' OR seller_id = auth.uid());

CREATE POLICY "Sellers can insert own listings"
  ON public.listings FOR INSERT
  WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Sellers can update own listings"
  ON public.listings FOR UPDATE
  USING (seller_id = auth.uid());

-- Admin can update any listing (for approval/removal)
CREATE POLICY "Admin can update any listing"
  ON public.listings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ORDERS policies
CREATE POLICY "Users can view own orders"
  ON public.orders FOR SELECT
  USING (buyer_id = auth.uid() OR seller_id = auth.uid());

CREATE POLICY "Buyers can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "Order participants can update"
  ON public.orders FOR UPDATE
  USING (buyer_id = auth.uid() OR seller_id = auth.uid());

-- Admin can view and update all orders
CREATE POLICY "Admin can view all orders"
  ON public.orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can update all orders"
  ON public.orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ORDER ITEMS policies
CREATE POLICY "Order items viewable by order participants"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND (orders.buyer_id = auth.uid() OR orders.seller_id = auth.uid())
    )
  );

CREATE POLICY "Buyers can insert order items"
  ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND orders.buyer_id = auth.uid()
    )
  );

-- Admin can view all order items
CREATE POLICY "Admin can view all order items"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- --------------------------------------------------------
-- 6. UPDATED_AT TRIGGER
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_listings_updated_at
  BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- --------------------------------------------------------
-- 7. STORAGE BUCKET FOR LISTING IMAGES
-- --------------------------------------------------------
-- Run this separately in Supabase Dashboard > Storage
-- or via the API. Creates a public bucket for product images.
--
-- In Supabase Dashboard:
-- 1. Go to Storage
-- 2. Create bucket: "listing-images" (public)
-- 3. Add policy: authenticated users can upload
-- 4. Add policy: anyone can read (public)
--
-- SQL alternative (may need to run via Supabase API):
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('listing-images', 'listing-images', true);

-- --------------------------------------------------------
-- 8. HELPFUL VIEWS
-- --------------------------------------------------------

-- Active listings with seller info (for browse page)
CREATE VIEW public.listings_with_seller AS
SELECT
  l.*,
  p.name AS seller_name,
  p.shop_name AS seller_shop_name,
  p.avatar_url AS seller_avatar,
  p.is_founding AS seller_is_founding,
  p.fee_rate AS seller_fee_rate
FROM public.listings l
JOIN public.profiles p ON l.seller_id = p.id;

-- Order details with buyer/seller info (for admin dashboard)
CREATE VIEW public.orders_detail AS
SELECT
  o.*,
  bp.name AS buyer_name,
  bp.email AS buyer_email,
  sp.name AS seller_name,
  sp.email AS seller_email,
  sp.fee_rate AS seller_fee_rate,
  sp.stripe_account_id AS seller_stripe_id
FROM public.orders o
JOIN public.profiles bp ON o.buyer_id = bp.id
JOIN public.profiles sp ON o.seller_id = sp.id;
