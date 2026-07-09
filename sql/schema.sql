-- Moow.Hub E-Commerce Database Schema (PostgreSQL)
-- Version: 1.0
-- Date: July 2026
-- For: Supabase PostgreSQL

-- --------------------------------------------------------
-- Products Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    short_description VARCHAR(500),
    price_usd DECIMAL(10,2) NOT NULL,
    image_url VARCHAR(500),
    gallery_images JSONB,
    stock INTEGER DEFAULT 0,
    category VARCHAR(20) NOT NULL CHECK (category IN ('apparel', 'kits', 'print')),
    badge VARCHAR(50),
    sizes JSONB,
    weight_grams INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_slug ON products(slug);

-- --------------------------------------------------------
-- User Addresses Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_addresses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    label VARCHAR(50),
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    postal_code VARCHAR(20) NOT NULL,
    country VARCHAR(2) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------
-- Cart Items Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS cart_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    size VARCHAR(10),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, product_id, size)
);

-- --------------------------------------------------------
-- Orders Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    shipping_cost DECIMAL(10,2) DEFAULT 0,
    tax DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    exchange_rate DECIMAL(10,4),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('upi', 'card', 'netbanking', 'wallet', 'emi', 'cod', 'stripe')),
    payment_gateway VARCHAR(20) NOT NULL CHECK (payment_gateway IN ('razorpay', 'stripe', 'cod')),
    payment_id VARCHAR(255),
    razorpay_order_id VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255),
    shipping_address JSONB NOT NULL,
    billing_address JSONB,
    tracking_number VARCHAR(255),
    carrier VARCHAR(100),
    estimated_delivery DATE,
    notes TEXT,
    cancel_reason TEXT,
    cancel_details TEXT,
    cancelled_at TIMESTAMPTZ,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_number ON orders(order_number);

-- --------------------------------------------------------
-- Order Items Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    product_name VARCHAR(255) NOT NULL,
    product_image VARCHAR(500),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    size VARCHAR(10)
);

-- --------------------------------------------------------
-- Wishlist Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS wishlist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

-- --------------------------------------------------------
-- Email Log Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    email_type VARCHAR(30) NOT NULL CHECK (email_type IN ('welcome', 'order_confirmation', 'shipping_update', 'delivery_confirmation', 'cancellation', 'password_reset')),
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    status VARCHAR(10) DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
    resend_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------
-- Currency Rates Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS currency_rates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    base_currency VARCHAR(3) DEFAULT 'USD',
    rates JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------
-- Rate Limits Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    attempts INTEGER DEFAULT 1,
    first_attempt TIMESTAMPTZ DEFAULT NOW(),
    last_attempt TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rate_limits_ip_endpoint ON rate_limits(ip_address, endpoint);
CREATE INDEX idx_rate_limits_first_attempt ON rate_limits(first_attempt);

-- --------------------------------------------------------
-- User Profiles Table (extends auth.users)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(255),
    phone VARCHAR(20),
    default_currency VARCHAR(3) DEFAULT 'USD',
    is_admin BOOLEAN DEFAULT FALSE,
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------
-- Insert Default Products
-- --------------------------------------------------------
INSERT INTO products (name, slug, description, short_description, price_usd, image_url, stock, category, badge, sizes, weight_grams) VALUES
('Moow Wellness Tee', 'moow-wellness-tee', '100% premium cotton with beautifully illustrated yoga pose and QR code. Available in S-XXL.', 'Premium cotton yoga pose t-shirt with QR code', 29.99, 'images/wellness-tshirt.png', 100, 'apparel', 'Best Seller', '["S","M","L","XL","XXL"]', 200),
('Educator''s Edition', 'educators-edition', 'Designed for teachers and educators. Premium fit with inspirational wellness quotes.', 'Teacher wellness t-shirt with quotes', 34.99, 'images/educator-edition.jpg', 75, 'apparel', NULL, '["S","M","L","XL","XXL"]', 200),
('Moow Wellness Cap', 'moow-wellness-cap', 'Adjustable cap with embroidered logo. UV protection and breathable mesh back.', 'Embroidered logo cap with UV protection', 19.99, 'images/TShirt with QR - Front side view.png', 50, 'apparel', 'Limited', '["One Size"]', 100),
('Community Wellness Kit', 'community-wellness-kit', 'Includes branded materials, educational guides, QR-code posters, and wellness merchandise.', 'Complete wellness community kit', 89.99, 'images/wellness-kit.jpg', 30, 'kits', 'Popular', NULL, 1500),
('School Starter Kit', 'school-starter-kit', 'Everything schools need to launch a wellness programme — printed materials and student kits.', 'Complete school wellness launch kit', 149.99, 'images/school-kit.jpg', 20, 'kits', NULL, NULL, 2500),
('Corporate Wellness Bundle', 'corporate-wellness-bundle', 'Premium bundle with branded merchandise, wellness guides, and impact reports.', 'Premium corporate wellness package', 299.99, 'images/corporate-bundle.jpg', 15, 'kits', 'Premium', NULL, 3000),
('Wellness Education Pack', 'wellness-education-pack', 'Comprehensive printed guides covering yoga, nutrition, mental health, and preventive healthcare.', 'Printed wellness education guides', 49.99, 'images/education-materials.jpg', 60, 'print', NULL, NULL, 500),
('QR-Code Poster Set', 'qr-code-poster-set', 'Set of 10 wellness posters with QR codes linking to digital content and resources.', '10 wellness posters with QR codes', 39.99, 'images/TShirt with QR - Set of images.png', 40, 'print', NULL, NULL, 300),
('Community Health Handbook', 'community-health-handbook', 'Illustrated handbook for community health workers and wellness programme coordinators.', 'Community health worker handbook', 24.99, 'images/handbook.jpg', 80, 'print', 'New', NULL, 250);

-- --------------------------------------------------------
-- Row Level Security Policies
-- --------------------------------------------------------

-- Products: Anyone can read
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products are viewable by everyone" ON products FOR SELECT USING (true);

-- Cart: Users can only access their own cart
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own cart" ON cart_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cart items" ON cart_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cart items" ON cart_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cart items" ON cart_items FOR DELETE USING (auth.uid() = user_id);

-- Orders: Users can only access their own orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own orders" ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own orders" ON orders FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Order Items: Users can view items from their own orders
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own order items" ON order_items FOR SELECT 
  USING (order_id IN (SELECT id FROM orders WHERE user_id = auth.uid()));

-- Wishlist: Users can only access their own wishlist
ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own wishlist" ON wishlist FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add to own wishlist" ON wishlist FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete from own wishlist" ON wishlist FOR DELETE USING (auth.uid() = user_id);

-- Addresses: Users can only access their own addresses
ALTER TABLE user_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own addresses" ON user_addresses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own addresses" ON user_addresses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own addresses" ON user_addresses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own addresses" ON user_addresses FOR DELETE USING (auth.uid() = user_id);

-- Profiles: Users can only access their own profile
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Currency rates: Anyone can read
ALTER TABLE currency_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Currency rates are viewable by everyone" ON currency_rates FOR SELECT USING (true);
