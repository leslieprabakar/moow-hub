# Moow.Hub — E-Commerce Implementation Plan
## Complete Blueprint for Amazon-Style Cart & Checkout

**Version**: 1.0  
**Date**: July 2026  
**Status**: Ready for Implementation  
**Hosting**: Hostinger Business Web Hosting (PHP/MySQL)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Technology Stack](#3-technology-stack)
4. [Database Schema (CRUD)](#4-database-schema)
5. [Security Implementation](#5-security-implementation)
6. [Payment Gateway Integration](#6-payment-gateway)
7. [Multi-Currency Support](#7-multi-currency)
8. [User Authentication Flow](#8-authentication)
9. [Cart & Checkout Flow](#9-cart-checkout)
10. [Order Management](#10-order-management)
11. [Email Notifications](#11-email-notifications)
12. [Admin Dashboard](#12-admin-dashboard)
13. [File Structure](#13-file-structure)
14. [API Endpoints](#14-api-endpoints)
15. [Implementation Phases](#15-implementation-phases)
16. [Cost Breakdown](#16-cost-breakdown)
17. [Testing Checklist](#17-testing-checklist)

---

## 1. Executive Summary

Transform Moow.Hub from a static marketing site into a fully functional e-commerce platform with Amazon-style cart functionality. The solution adds persistent data storage, user authentication, multi-currency payments, order tracking, and email notifications — all while preserving the existing design.

### Key Features
- **Persistent Shopping Cart** — Items saved across sessions
- **Multi-Currency** — USD, INR, EUR, GBP, AED, SGD with live conversion
- **Multiple Payment Methods** — UPI, Cards, Net Banking, Wallets, EMI, COD
- **Order Management** — Track, cancel (24hr grace), edit before processing
- **Email Notifications** — Order confirmations, shipping updates, delivery alerts
- **Admin Dashboard** — Manage products, orders, inventory, users
- **Security** — 6-domain vulnerability protection

---

## 2. Architecture Overview

### Current State
- 100% static HTML/CSS/JS site
- 9 products displayed with cosmetic "Add to Cart" buttons
- No backend, no database, no authentication
- Deployed on Vercel (static hosting)

### Target State
- PHP backend API on Hostinger
- MySQL database for persistent storage
- Razorpay (India) + Stripe (International) for payments
- Resend.com for transactional emails

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    HOSTINGER BUSINESS HOSTING                    │
│                                                                  │
│  ┌─────────────────────┐    ┌──────────────────────────────┐    │
│  │   Public_html/       │    │   api/                       │    │
│  │   (Static Files)     │    │   (PHP Backend)              │    │
│  │                      │    │                              │    │
│  │   index.html         │    │   auth/login.php             │    │
│  │   pages/*.html       │    │   auth/register.php          │    │
│  │   css/styles.css     │    │   products/list.php          │    │
│  │   js/*.js            │    │   cart/*.php                 │    │
│  │   images/*           │    │   checkout/process.php       │    │
│  └─────────────────────┘    │   orders/*.php                │    │
│                              │   webhooks/razorpay.php       │    │
│                              │   webhooks/stripe.php         │    │
│                              └──────────────┬───────────────┘    │
│                                             │                     │
└─────────────────────────────────────────────┼─────────────────────┘
                                              │
              ┌───────────────────────────────┼──────────────────┐
              │                               │                   │
        ┌─────▼─────┐                 ┌──────▼──────┐    ┌──────▼──────┐
        │  MySQL     │                 │  Razorpay   │    │   Resend    │
        │  Database  │                 │  (India)    │    │   (Email)   │
        │  (Hostinger│                 │  UPI/Cards  │    │   Transactional│
        │   or Supa- │                 │  Net Banking│    │   Emails    │
        │   base)    │                 │  Wallets    │    │             │
        └────────────┘                 │  COD        │    └─────────────┘
                                       │             │
                                       │  + Stripe   │
                                       │  (Intl)     │
                                       │  Cards      │
                                       │  Apple Pay  │
                                       │  Google Pay │
                                       └─────────────┘
```

---

## 3. Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | HTML5, CSS3, Vanilla JS | Existing design preserved |
| **Backend** | PHP 8.x | API endpoints, business logic |
| **Database** | MySQL 8.0 (Hostinger) | Persistent data storage |
| **Auth** | PHP Sessions + bcrypt | User authentication |
| **Payments (India)** | Razorpay | UPI, Cards, Net Banking, Wallets, EMI, COD |
| **Payments (Intl)** | Stripe | Credit/Debit Cards, Apple Pay, Google Pay |
| **Email** | Resend.com (PHP SDK) | Transactional emails |
| **Currency** | Open Exchange Rates API | Live currency conversion |
| **Hosting** | Hostinger Business | PHP/MySQL shared hosting |
| **SSL** | Hostinger Free SSL | HTTPS encryption |

---

## 4. Database Schema

### Products Table
```sql
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    short_description VARCHAR(500),
    price_usd DECIMAL(10,2) NOT NULL,
    price_inr DECIMAL(10,2) GENERATED ALWAYS AS (price_usd * 83.50) STORED,
    image_url VARCHAR(500),
    gallery_images JSON,
    stock INT DEFAULT 0,
    category ENUM('apparel', 'kits', 'print') NOT NULL,
    badge VARCHAR(50),
    sizes JSON,
    weight_grams INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_active (is_active)
);
```

### Users Table
```sql
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    phone VARCHAR(20),
    default_currency VARCHAR(3) DEFAULT 'USD',
    is_admin BOOLEAN DEFAULT FALSE,
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    reset_token VARCHAR(255),
    reset_token_expires DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email)
);
```

### User Addresses Table
```sql
CREATE TABLE user_addresses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Cart Items Table
```sql
CREATE TABLE cart_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT DEFAULT 1,
    size VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY unique_cart_item (user_id, product_id, size)
);
```

### Orders Table
```sql
CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    shipping_cost DECIMAL(10,2) DEFAULT 0,
    tax DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    exchange_rate DECIMAL(10,4),
    status ENUM('pending','confirmed','processing','shipped','delivered','cancelled') DEFAULT 'pending',
    payment_method ENUM('upi','card','netbanking','wallet','emi','cod','stripe') NOT NULL,
    payment_gateway ENUM('razorpay','stripe') NOT NULL,
    payment_id VARCHAR(255),
    razorpay_order_id VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255),
    shipping_address JSON NOT NULL,
    billing_address JSON,
    tracking_number VARCHAR(255),
    carrier VARCHAR(100),
    estimated_delivery DATE,
    notes TEXT,
    cancel_reason TEXT,
    cancel_details TEXT,
    cancelled_at DATETIME,
    shipped_at DATETIME,
    delivered_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_user_orders (user_id),
    INDEX idx_order_status (status),
    INDEX idx_order_number (order_number)
);
```

### Order Items Table
```sql
CREATE TABLE order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    product_image VARCHAR(500),
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    size VARCHAR(10),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);
```

### Wishlist Table
```sql
CREATE TABLE wishlist (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY unique_wishlist (user_id, product_id)
);
```

### Email Log Table
```sql
CREATE TABLE email_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT,
    email_type ENUM('welcome','order_confirmation','shipping_update','delivery_confirmation','cancellation','password_reset') NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    status ENUM('sent','failed','pending') DEFAULT 'sent',
    resend_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);
```

### Currency Rates Table
```sql
CREATE TABLE currency_rates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    base_currency VARCHAR(3) DEFAULT 'USD',
    rates JSON NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

## 5. Security Implementation

### 5.1 Web & Application Security

| Vulnerability | Mitigation |
|---------------|------------|
| **SQL Injection** | Prepared statements with PDO (never concatenate user input) |
| **XSS (Cross-Site Scripting)** | `htmlspecialchars()` on all output, Content-Security-Policy headers |
| **CSRF (Cross-Site Request Forgery)** | CSRF tokens on all forms, SameSite cookies |
| **Session Hijacking** | HttpOnly, Secure, SameSite=Lax cookies, session regeneration on login |
| **Brute Force** | Rate limiting: 5 login attempts per 15 minutes per IP |
| **Password Cracking** | bcrypt hashing with `password_hash()` (cost factor 12) |
| **Insecure Direct Object References** | Verify user ownership on all data access |

### 5.2 Infrastructure & Operating System

| Vulnerability | Mitigation |
|---------------|------------|
| **Server Misconfiguration** | Disable directory listing, error logging to file only |
| **File Upload Vulnerabilities** | Validate file types, scan uploads, store outside webroot |
| **Outdated Software** | Keep PHP updated via Hostinger panel |
| **Exposed Configuration** | `.env` file outside public_html, never expose to web |

### 5.3 Network & Wireless

| Vulnerability | Mitigation |
|---------------|------------|
| **Man-in-the-Middle** | HTTPS enforced via Hostinger SSL, HSTS headers |
| **Insecure Transmission** | All API calls over HTTPS only |
| **CORS Misconfiguration** | Restrict CORS to your domain only |

### 5.4 Human & Process

| Vulnerability | Mitigation |
|---------------|------------|
| **Weak Passwords** | Enforce minimum 8 chars, uppercase, lowercase, number, special char |
| **Social Engineering** | Email verification on registration, OTP for COD |
| **Privilege Escalation** | Admin routes check `is_admin` flag, not just authentication |
| **Data Leakage** | Never log sensitive data, mask card numbers in logs |

### 5.5 Hardware & Supply Chain

| Vulnerability | Mitigation |
|---------------|------------|
| **Third-Party Dependencies** | Audit PHP packages, use Composer lock file |
| **Compromised Libraries** | Pin dependency versions, regular `composer update` |
| **Supply Chain Attack** | Verify package checksums, use official repositories |

### 5.6 Payment Security

| Vulnerability | Mitigation |
|---------------|------------|
| **PCI DSS Compliance** | Razorpay/Stripe handle all card data (never touches your server) |
| **Card Data Storage** | NEVER store card numbers, CVV, or expiry |
| **Payment Tampering** | Verify webhook signatures on all payment callbacks |
| **Duplicate Charges** | Idempotency keys with order_number |
| **Amount Tampering** | Server-side price verification (never trust client-side prices) |

### Security Headers (PHP)

```php
<?php
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
header("Content-Security-Policy: default-src 'self'; script-src 'self' https://js.stripe.com https://checkout.razorpay.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.razorpay.com https://api.stripe.com;");
```

---

## 6. Payment Gateway Integration

### 6.1 Razorpay (Primary — India)

**Payment Methods Supported:**
| Method | Fee | Notes |
|--------|-----|-------|
| UPI | 0% (under Rs 2,000) | Google Pay, PhonePe, BHIM, all UPI apps |
| Credit Card | 2% + GST | Visa, Mastercard, RuPay, AMEX |
| Debit Card | 2% + GST | All Indian debit cards |
| Net Banking | 2% | 58+ banks |
| Wallets | 2% | Paytm, PhonePe, Amazon Pay |
| EMI | 2-3% | Credit card EMI (3/6/9/12 months) |
| Pay Later | 2% | LazyPay, Simpl |
| COD | Flat Rs 30 | Cash on Delivery with OTP verification |

**Checkout Flow:**
```php
// api/checkout/create-order.php
require_once '../includes/config.php';
require_once '../includes/auth.php';
require_once '../includes/security.php';

$user = requireAuth();
$cartItems = getCartItems($user['id']);
$total = calculateTotal($cartItems, $_POST['currency']);

$razorpay = new Razorpay\Razorpay([
    'key_id' => RAZORPAY_KEY_ID,
    'key_secret' => RAZORPAY_KEY_SECRET
]);

$order = $razorpay->order->create([
    'amount' => intval($total['total'] * 100),
    'currency' => $total['currency'],
    'receipt' => generateOrderNumber(),
]);

$orderId = createOrder($user['id'], $order, $total, $_POST);

echo json_encode([
    'orderId' => $orderId,
    'razorpayOrderId' => $order['id'],
    'amount' => $order['amount'],
    'currency' => $order['currency'],
    'key' => RAZORPAY_KEY_ID,
    'userName' => $user['full_name'],
    'userEmail' => $user['email'],
    'userPhone' => $user['phone']
]);
```

### 6.2 Stripe (Secondary — International)

**Payment Methods Supported:**
| Method | Fee | Notes |
|--------|-----|-------|
| Credit/Debit Cards | 2.9% + $0.30 | Visa, Mastercard, AMEX, Discover |
| Apple Pay | 2.9% + $0.30 | Safari, iOS devices |
| Google Pay | 2.9% + $0.30 | Chrome, Android devices |
| iDEAL | 2.9% + €0.25 | Netherlands |
| Bancontact | 2.9% + €0.25 | Belgium |
| SEPA | 2.9% + €0.25 | Europe |

### 6.3 COD (Cash on Delivery)

**Flow:**
1. User selects "Cash on Delivery" at checkout
2. System sends OTP to user's phone
3. User enters OTP to confirm
4. Order placed with status "pending"
5. On delivery, delivery person collects cash
6. Status updated to "delivered"

```php
// api/checkout/cod-verify.php
function verifyCODOTP($userId, $otp) {
    $storedOTP = $_SESSION['cod_otp'][$userId];
    
    if (!$storedOTP || $storedOTP !== $otp) {
        return ['success' => false, 'error' => 'Invalid OTP'];
    }
    
    unset($_SESSION['cod_otp'][$userId]);
    updateOrderStatus($orderId, 'confirmed');
    
    return ['success' => true];
}
```

---

## 7. Multi-Currency Support

### Supported Currencies

| Currency | Code | Symbol | Payment Gateway |
|----------|------|--------|-----------------|
| US Dollar | USD | $ | Stripe |
| Indian Rupee | INR | ₹ | Razorpay |
| Euro | EUR | € | Stripe |
| British Pound | GBP | £ | Stripe |
| UAE Dirham | AED | د.إ | Stripe |
| Singapore Dollar | SGD | S$ | Stripe |

### Currency Conversion

```php
function getExchangeRates() {
    $cached = getCurrencyCache();
    if ($cached && strtotime($cached['updated_at']) > strtotime('-1 day')) {
        return $cached['rates'];
    }
    
    $response = file_get_contents(
        'https://openexchangerates.org/api/latest.json?app_id=' . OER_APP_ID
    );
    $data = json_decode($response, true);
    updateCurrencyRates($data['rates']);
    return $data['rates'];
}

function convertPrice($amountUSD, $targetCurrency, $rates) {
    if ($targetCurrency === 'USD') return $amountUSD;
    $rate = $rates[$targetCurrency] ?? null;
    if (!$rate) return $amountUSD;
    return round($amountUSD * $rate, 2);
}
```

### Frontend Currency Selector

```html
<div class="currency-selector">
    <label>Currency</label>
    <select id="currency" name="currency">
        <option value="USD">$ USD</option>
        <option value="INR">₹ INR</option>
        <option value="EUR">€ EUR</option>
        <option value="GBP">£ GBP</option>
        <option value="AED">د.إ AED</option>
        <option value="SGD">S$ SGD</option>
    </select>
    <span class="converted-price" id="convertedTotal"></span>
</div>
```

---

## 8. Authentication Flow

### Registration Flow

```
1. User fills registration form (name, email, password, phone)
   └── Client-side validation (HTML5 + JS)

2. Submit to POST /api/auth/register.php
   └── Server-side validation (sanitize, validate email, check duplicates)
   └── Password hashing (bcrypt, cost 12)
   └── Generate verification token
   └── Insert into users table
   └── Send verification email (Resend)

3. User clicks verification link
   └── Verify token in database
   └── Mark email_verified = TRUE
   └── Redirect to login page

4. User logs in
   └── Verify email + password
   └── Create PHP session
   └── Regenerate session ID (prevent fixation)
   └── Redirect to homepage
```

### Login Flow

```
1. User enters email + password
   └── POST /api/auth/login.php

2. Server validates
   └── Check rate limiting (5 attempts per 15 min)
   └── Verify email exists
   └── Verify password with password_verify()
   └── Check email_verified = TRUE

3. On success
   └── Regenerate session ID
   └── Set session variables: user_id, email, full_name, is_admin
   └── Set HttpOnly, Secure, SameSite=Lax cookie
   └── Return JSON response

4. On failure
   └── Increment failed attempt counter
   └── Return generic error (don't reveal if email exists)
```

### Session Management

```php
// api/includes/auth.php
session_start([
    'cookie_lifetime' => 86400 * 7,
    'cookie_httponly' => true,
    'cookie_secure' => true,
    'cookie_samesite' => 'Lax',
    'use_strict_mode' => true,
    'use_only_cookies' => true
]);

function requireAuth() {
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Authentication required']);
        exit;
    }
    
    $user = getUserById($_SESSION['user_id']);
    if (!$user) {
        session_destroy();
        http_response_code(401);
        echo json_encode(['error' => 'Session expired']);
        exit;
    }
    
    return $user;
}

function requireAdmin() {
    $user = requireAuth();
    if (!$user['is_admin']) {
        http_response_code(403);
        echo json_encode(['error' => 'Admin access required']);
        exit;
    }
    return $user;
}
```

---

## 9. Cart & Checkout Flow

### Cart Operations

```
┌─────────────────────────────────────────────────────────┐
│                    CART FLOW                             │
│                                                         │
│  Product Page                                           │
│  └── Select size (if applicable)                        │
│  └── Click "Add to Cart"                                │
│  └── POST /api/cart/add.php                             │
│      ├── If logged in → Store in MySQL cart_items        │
│      └── If not logged in → Store in localStorage        │
│          └── On login → Merge localStorage into MySQL    │
│                                                         │
│  Cart Page (GET /api/cart/get.php)                       │
│  └── Display all items with images, names, prices       │
│  └── Show quantity selectors (+/-)                       │
│  └── Show "Remove" button                               │
│  └── Show "Save for Later" button                       │
│  └── Show product suggestions ("Frequently bought")     │
│  └── Show order summary (subtotal, shipping, tax)       │
│  └── Currency selector with converted prices            │
│                                                         │
│  Cart Actions                                            │
│  ├── PUT /api/cart/update.php (change quantity)          │
│  ├── DELETE /api/cart/remove.php (remove item)           │
│  └── POST /api/cart/move-to-wishlist.php                 │
└─────────────────────────────────────────────────────────┘
```

### Checkout Flow

```
┌─────────────────────────────────────────────────────────┐
│                  CHECKOUT FLOW                           │
│                                                         │
│  Step 1: Shipping Address                                │
│  ├── Select saved address OR                             │
│  ├── Add new address                                     │
│  └── Validate: name, phone, address, city, postal, country│
│                                                         │
│  Step 2: Payment Method                                  │
│  ├── Select currency (USD/INR/EUR/GBP/AED/SGD)          │
│  ├── If INR → Show Razorpay options:                     │
│  │   ├── UPI (QR code or VPA input)                      │
│  │   ├── Credit/Debit Card                               │
│  │   ├── Net Banking (bank selector)                     │
│  │   ├── Wallets                                         │
│  │   ├── EMI                                             │
│  │   └── COD (+ OTP verification)                        │
│  │                                                       │
│  └── If International → Show Stripe options:             │
│      ├── Credit/Debit Card                               │
│      ├── Apple Pay                                       │
│      └── Google Pay                                      │
│                                                         │
│  Step 3: Order Review                                    │
│  ├── Show all items with prices in selected currency     │
│  ├── Show shipping address                               │
│  ├── Show payment method                                 │
│  ├── Show order summary:                                 │
│  │   ├── Subtotal                                        │
│  │   ├── Shipping (calculated by weight/destination)     │
│  │   ├── Tax (if applicable)                             │
│  │   └── Total                                           │
│  └── "Place Order" button                                │
│                                                         │
│  Step 4: Payment Processing                              │
│  ├── Razorpay: Open modal → User pays → Webhook verify  │
│  ├── Stripe: Confirm PaymentIntent → Webhook verify     │
│  └── COD: Send OTP → Verify → Confirm order             │
│                                                         │
│  Step 5: Confirmation                                    │
│  ├── Order status: pending → confirmed                   │
│  ├── Send confirmation email                             │
│  ├── Clear cart                                          │
│  └── Redirect to order confirmation page                 │
└─────────────────────────────────────────────────────────┘
```

### Shipping Cost Calculation

```php
function calculateShipping($items, $country, $currency) {
    $totalWeight = array_sum(array_map(function($item) {
        return $item['weight_grams'] * $item['quantity'];
    }, $items));
    
    // Free shipping for orders over $100
    if ($totalWeight > 0 && calculateSubtotal($items) >= 100) {
        return ['cost' => 0, 'method' => 'Free Standard Shipping'];
    }
    
    // Weight-based shipping
    $rates = [
        'IN' => ['base' => 2.99, 'per_kg' => 0.50],
        'US' => ['base' => 4.99, 'per_kg' => 1.50],
        'EU' => ['base' => 5.99, 'per_kg' => 1.80],
        'default' => ['base' => 6.99, 'per_kg' => 2.00]
    ];
    
    $rate = $rates[$country] ?? $rates['default'];
    $cost = $rate['base'] + ($rate['per_kg'] * ($totalWeight / 1000));
    
    return [
        'cost' => round($cost, 2),
        'method' => 'Standard Shipping',
        'estimated_days' => getEstimatedDays($country)
    ];
}
```

---

## 10. Order Management

### Order Statuses

```
pending → confirmed → processing → shipped → delivered
    ↓         ↓            ↓           ↓
    └─────────┴────────────┴───────────┴──→ cancelled
```

| Status | Description | Editable by User | Auto-triggered by |
|--------|-------------|------------------|-------------------|
| **pending** | Payment received, awaiting confirmation | Can cancel | — |
| **confirmed** | Order confirmed, preparing for shipment | Can cancel (within 24hrs) | Payment webhook |
| **processing** | Being packed and prepared | Can cancel (within 24hrs) | Admin action |
| **shipped** | Handed to carrier | Cannot cancel | Admin/Tracking update |
| **delivered** | Received by customer | Cannot cancel | Carrier tracking |
| **cancelled** | Cancelled by user or admin | N/A | User/Admin action |

### Order Cancellation

```php
// api/orders/cancel.php
function cancelOrder($orderId, $userId, $reason, $details) {
    $order = getOrderById($orderId, $userId);
    
    if (!$order) {
        return ['success' => false, 'error' => 'Order not found'];
    }
    
    // Check if order can be cancelled
    $orderTime = strtotime($order['created_at']);
    $now = time();
    $hoursSinceOrder = ($now - $orderTime) / 3600;
    
    if ($hoursSinceOrder > 24) {
        return ['success' => false, 'error' => 'Cancellation window expired (24 hours)'];
    }
    
    if (!in_array($order['status'], ['pending', 'confirmed', 'processing'])) {
        return ['success' => false, 'error' => 'Order cannot be cancelled at this stage'];
    }
    
    // Process refund if online payment
    if ($order['payment_method'] !== 'cod') {
        $refund = processRefund($order);
        if (!$refund['success']) {
            return ['success' => false, 'error' => 'Refund processing failed'];
        }
    }
    
    // Update order status
    updateOrderStatus($orderId, 'cancelled', [
        'cancel_reason' => $reason,
        'cancel_details' => $details,
        'cancelled_at' => date('Y-m-d H:i:s')
    ]);
    
    // Restore stock
    restoreStock($orderId);
    
    // Send cancellation email
    sendCancellationEmail($order);
    
    return ['success' => true, 'message' => 'Order cancelled successfully'];
}
```

### Order Tracking Timeline

```php
function getOrderTimeline($orderId) {
    $order = getOrderById($orderId);
    $timeline = [];
    
    $timeline[] = [
        'status' => 'Order Placed',
        'date' => $order['created_at'],
        'icon' => 'shopping-cart',
        'completed' => true
    ];
    
    if (in_array($order['status'], ['confirmed', 'processing', 'shipped', 'delivered'])) {
        $timeline[] = [
            'status' => 'Payment Confirmed',
            'date' => $order['updated_at'],
            'icon' => 'credit-card',
            'completed' => true
        ];
    }
    
    if (in_array($order['status'], ['processing', 'shipped', 'delivered'])) {
        $timeline[] = [
            'status' => 'Processing',
            'date' => $order['updated_at'],
            'icon' => 'package',
            'completed' => true
        ];
    }
    
    if (in_array($order['status'], ['shipped', 'delivered'])) {
        $timeline[] = [
            'status' => 'Shipped',
            'date' => $order['shipped_at'],
            'tracking' => $order['tracking_number'],
            'carrier' => $order['carrier'],
            'icon' => 'truck',
            'completed' => true
        ];
    }
    
    if ($order['status'] === 'delivered') {
        $timeline[] = [
            'status' => 'Delivered',
            'date' => $order['delivered_at'],
            'icon' => 'check-circle',
            'completed' => true
        ];
    }
    
    return $timeline;
}
```

---

## 11. Email Notifications

### Service: Resend.com

**Free Tier:** 100 emails/day, 3,000/month  
**Paid:** $20/month for 50,000 emails

### Email Templates

#### 1. Order Confirmation
```php
function sendOrderConfirmation($order, $user, $items) {
    $html = "
    <h1>Order Confirmed!</h1>
    <p>Hi {$user['full_name']},</p>
    <p>Thank you for your order. Here's your order summary:</p>
    
    <div style='background:#f5f0eb;padding:20px;border-radius:8px;'>
        <h2>Order #{$order['order_number']}</h2>
        <p><strong>Date:</strong> " . date('F j, Y', strtotime($order['created_at'])) . "</p>
        <p><strong>Status:</strong> " . ucfirst($order['status']) . "</p>
    </div>
    
    <h3>Items Ordered</h3>
    <table style='width:100%;border-collapse:collapse;'>
        <tr style='background:#1a2744;color:white;'>
            <th style='padding:10px;text-align:left;'>Item</th>
            <th style='padding:10px;text-align:center;'>Qty</th>
            <th style='padding:10px;text-align:right;'>Price</th>
        </tr>";
    
    foreach ($items as $item) {
        $html .= "
        <tr style='border-bottom:1px solid #eee;'>
            <td style='padding:10px;'>
                <strong>{$item['product_name']}</strong>
                " . ($item['size'] ? "<br>Size: {$item['size']}" : "") . "
            </td>
            <td style='padding:10px;text-align:center;'>{$item['quantity']}</td>
            <td style='padding:10px;text-align:right;'>{$order['currency']} " . number_format($item['total_price'], 2) . "</td>
        </tr>";
    }
    
    $html .= "
        <tr style='background:#f9f9f9;font-weight:bold;'>
            <td colspan='2' style='padding:10px;'>Total</td>
            <td style='padding:10px;text-align:right;'>{$order['currency']} " . number_format($order['total'], 2) . "</td>
        </tr>
    </table>
    
    <h3>Shipping Address</h3>
    <p>" . formatAddress($order['shipping_address']) . "</p>
    
    <p>We'll send you another email when your order ships.</p>
    <p>Best,<br>The Moow.Hub Team</p>";
    
    sendEmail($user['email'], "Order Confirmation #{$order['order_number']}", $html);
}
```

#### 2. Shipping Update
```php
function sendShippingUpdate($order, $user) {
    $html = "
    <h1>Your Order Has Shipped!</h1>
    <p>Hi {$user['full_name']},</p>
    <p>Great news! Your order #{$order['order_number']} has been shipped.</p>
    
    <div style='background:#f5f0eb;padding:20px;border-radius:8px;'>
        <p><strong>Carrier:</strong> {$order['carrier']}</p>
        <p><strong>Tracking Number:</strong> {$order['tracking_number']}</p>
        <p><strong>Estimated Delivery:</strong> " . date('F j, Y', strtotime($order['estimated_delivery'])) . "</p>
    </div>
    
    <a href='https://yourdomain.com/pages/order-detail.html?id={$order['id']}' 
       style='display:inline-block;background:#d4735e;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;'>
       Track Your Order
    </a>
    
    <p>Best,<br>The Moow.Hub Team</p>";
    
    sendEmail($user['email'], "Your Order #{$order['order_number']} Has Shipped", $html);
}
```

#### 3. Delivery Confirmation
#### 4. Cancellation Confirmation
#### 5. Welcome Email
#### 6. Password Reset

---

## 12. Admin Dashboard

### Pages

| Page | URL | Features |
|------|-----|----------|
| **Dashboard** | `/admin/` | Sales overview, recent orders, low stock alerts |
| **Products** | `/admin/products.php` | CRUD, stock management, image upload |
| **Orders** | `/admin/orders.php` | List, filter, status update, tracking |
| **Customers** | `/admin/customers.php` | View users, order history |

### Dashboard Widgets

```php
$stats = [
    'today_orders' => getCount("orders WHERE DATE(created_at) = CURDATE()"),
    'today_revenue' => getSum("orders WHERE DATE(created_at) = CURDATE() AND status != 'cancelled'"),
    'pending_orders' => getCount("orders WHERE status = 'pending'"),
    'processing_orders' => getCount("orders WHERE status = 'processing'"),
    'shipped_orders' => getCount("orders WHERE status = 'shipped'"),
    'total_customers' => getCount("users"),
    'low_stock' => getCount("products WHERE stock < 10"),
    'revenue_this_month' => getSum("orders WHERE MONTH(created_at) = MONTH(NOW()) AND status != 'cancelled'"),
];
```

---

## 13. File Structure

```
public_html/
├── index.html
├── css/styles.css
├── js/
│   ├── main.js (modified)
│   ├── auth.js (NEW)
│   ├── cart.js (NEW)
│   ├── checkout.js (NEW)
│   ├── orders.js (NEW)
│   ├── currency.js (NEW)
│   ├── suggestions.js (NEW)
│   └── admin.js (NEW)
├── images/
├── pages/
│   ├── about.html
│   ├── products.html (modified)
│   ├── services.html
│   ├── partners.html
│   ├── contact.html
│   ├── agreement.html
│   ├── login.html (NEW)
│   ├── register.html (NEW)
│   ├── cart.html (NEW)
│   ├── checkout.html (NEW)
│   ├── orders.html (NEW)
│   ├── order-detail.html (NEW)
│   ├── wishlist.html (NEW)
│   ├── account.html (NEW)
│   └── admin/
│       ├── index.php (NEW)
│       ├── products.php (NEW)
│       ├── orders.php (NEW)
│       └── customers.php (NEW)
├── api/
│   ├── includes/
│   │   ├── config.php
│   │   ├── database.php
│   │   ├── auth.php
│   │   ├── security.php
│   │   ├── helpers.php
│   │   └── email.php
│   ├── auth/
│   │   ├── register.php
│   │   ├── login.php
│   │   ├── logout.php
│   │   ├── user.php
│   │   ├── verify.php
│   │   └── password-reset.php
│   ├── products/
│   │   ├── list.php
│   │   ├── detail.php
│   │   └── suggestions.php
│   ├── cart/
│   │   ├── get.php
│   │   ├── add.php
│   │   ├── update.php
│   │   └── remove.php
│   ├── checkout/
│   │   ├── create-order.php
│   │   ├── verify-payment.php
│   │   └── cod-send-otp.php
│   ├── orders/
│   │   ├── list.php
│   │   ├── detail.php
│   │   ├── cancel.php
│   │   └── track.php
│   ├── wishlist/
│   │   ├── get.php
│   │   ├── add.php
│   │   └── remove.php
│   ├── currency/
│   │   └── rates.php
│   ├── webhooks/
│   │   ├── razorpay.php
│   │   └── stripe.php
│   └── admin/
│       ├── dashboard.php
│       ├── products.php
│       └── orders.php
├── .htaccess
└── .env (outside webroot)
```

---

## 14. API Endpoints

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register.php` | No | Create account |
| POST | `/api/auth/login.php` | No | Sign in |
| POST | `/api/auth/logout.php` | Yes | Sign out |
| GET | `/api/auth/user.php` | Yes | Get current user |
| GET | `/api/auth/verify.php` | No | Verify email |
| POST | `/api/auth/password-reset.php` | No | Request reset |

### Products
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/products/list.php` | No | List products |
| GET | `/api/products/detail.php?id=X` | No | Product detail |
| GET | `/api/products/suggestions.php?id=X` | No | Suggestions |

### Cart
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/cart/get.php` | Yes | Get cart items |
| POST | `/api/cart/add.php` | Yes | Add to cart |
| PUT | `/api/cart/update.php` | Yes | Update quantity |
| DELETE | `/api/cart/remove.php` | Yes | Remove item |

### Checkout
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/checkout/create-order.php` | Yes | Create payment order |
| POST | `/api/checkout/verify-payment.php` | Yes | Verify payment |
| POST | `/api/checkout/cod-send-otp.php` | Yes | Send COD OTP |

### Orders
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/orders/list.php` | Yes | Order history |
| GET | `/api/orders/detail.php?id=X` | Yes | Order detail |
| PUT | `/api/orders/cancel.php` | Yes | Cancel order |
| GET | `/api/orders/track.php?id=X` | Yes | Order timeline |

### Wishlist
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/wishlist/get.php` | Yes | Get wishlist |
| POST | `/api/wishlist/add.php` | Yes | Add to wishlist |
| DELETE | `/api/wishlist/remove.php` | Yes | Remove from wishlist |

### Currency
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/currency/rates.php` | No | Get exchange rates |

### Webhooks
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/webhooks/razorpay.php` | Signature | Razorpay webhook |
| POST | `/api/webhooks/stripe.php` | Signature | Stripe webhook |

---

## 15. Implementation Phases

### Phase 1: Foundation (Days 1-3)
- [ ] Create `package.json` and Composer dependencies
- [ ] Set up MySQL database on Hostinger
- [ ] Create database tables (all schemas above)
- [ ] Configure `api/includes/config.php` with DB credentials
- [ ] Create PDO database connection class
- [ ] Set up security headers and CSRF protection
- [ ] Configure `.htaccess` for clean URLs
- [ ] Test database connectivity

### Phase 2: Authentication (Days 4-6)
- [ ] Build registration system (PHP + MySQL)
- [ ] Build login system with sessions
- [ ] Create login.html and register.html pages
- [ ] Implement email verification (Resend)
- [ ] Implement password reset flow
- [ ] Add rate limiting on auth endpoints
- [ ] Test authentication flow end-to-end

### Phase 3: Products (Days 7-9)
- [ ] Create product listing API
- [ ] Create product detail API
- [ ] Populate database with 9 existing products
- [ ] Add product filtering (category, price, search)
- [ ] Build product suggestions API
- [ ] Modify products.html to fetch from API
- [ ] Test product browsing

### Phase 4: Cart (Days 10-13)
- [ ] Build cart API (CRUD operations)
- [ ] Create cart.html page
- [ ] Implement localStorage fallback for non-logged-in users
- [ ] Add cart merge on login
- [ ] Add quantity management (+/-)
- [ ] Add "Save for Later" functionality
- [ ] Add cart badge in navigation
- [ ] Test cart persistence across sessions

### Phase 5: Checkout + Payments (Days 14-19)
- [ ] Build checkout.html page (3-step flow)
- [ ] Integrate Razorpay PHP SDK
- [ ] Integrate Stripe PHP SDK
- [ ] Implement multi-currency support
- [ ] Implement COD with OTP
- [ ] Build payment webhook handlers
- [ ] Add payment verification logic
- [ ] Test all payment methods

### Phase 6: Orders (Days 20-23)
- [ ] Build order creation logic
- [ ] Create orders.html (order history)
- [ ] Create order-detail.html (single order)
- [ ] Implement order cancellation (24hr window)
- [ ] Build order timeline/tracking
- [ ] Add invoice generation (PDF)
- [ ] Test order lifecycle

### Phase 7: Email (Days 24-25)
- [ ] Set up Resend account and verify domain
- [ ] Build email templates (HTML)
- [ ] Implement order confirmation email
- [ ] Implement shipping notification email
- [ ] Implement delivery confirmation email
- [ ] Implement cancellation email
- [ ] Test email delivery

### Phase 8: Admin (Days 26-28)
- [ ] Build admin dashboard page
- [ ] Build product management (CRUD)
- [ ] Build order management (status updates)
- [ ] Build customer view
- [ ] Add admin authentication check
- [ ] Test admin workflows

### Phase 9: Polish (Days 29-32)
- [ ] Wishlist functionality
- [ ] Loading states and animations
- [ ] Error handling and user feedback
- [ ] Mobile responsiveness testing
- [ ] Cross-browser testing
- [ ] Performance optimization
- [ ] Security audit
- [ ] Final testing

---

## 16. Cost Breakdown

| Service | Free Tier | When Scaling |
|---------|-----------|-------------|
| Hostinger Business | ~$4/mo (already paid) | Same |
| Razorpay | $0 setup, 2% per txn | Same |
| Stripe | $0 setup, 2.9% + $0.30 per txn | Same |
| Resend Email | $0 (100/day) | $20/mo (50K) |
| Open Exchange Rates | $0 (1K/mo) | $12/mo (100K) |
| SSL Certificate | Free (Hostinger) | Same |
| Domain | ~$12/year | Same |
| **Total (Launch)** | **~$4/mo + transaction fees** | — |
| **Total (Scaled)** | — | **~$40/mo + transaction fees** |

---

## 17. Testing Checklist

### Authentication
- [ ] Register with valid data
- [ ] Register with duplicate email (should fail)
- [ ] Login with correct credentials
- [ ] Login with wrong password (should fail)
- [ ] Logout clears session
- [ ] Session persists across page refresh
- [ ] Password reset flow works
- [ ] Rate limiting blocks brute force

### Products
- [ ] Product list loads correctly
- [ ] Product detail shows all info
- [ ] Category filtering works
- [ ] Search works
- [ ] Suggestions load correctly

### Cart
- [ ] Add to cart works (logged in)
- [ ] Cart persists across sessions
- [ ] Quantity update works
- [ ] Remove from cart works
- [ ] Save for later works
- [ ] Cart badge shows correct count
- [ ] Non-logged-in users get redirect to login

### Checkout
- [ ] Address validation works
- [ ] Currency switching works
- [ ] Razorpay payment succeeds
- [ ] Stripe payment succeeds
- [ ] COD OTP verification works
- [ ] Order created after payment
- [ ] Cart cleared after order

### Orders
- [ ] Order history displays correctly
- [ ] Order detail shows all info
- [ ] Cancel order within 24hrs works
- [ ] Cancel order after 24hrs fails
- [ ] Order timeline updates correctly

### Security
- [ ] SQL injection attempts fail
- [ ] XSS attempts are blocked
- [ ] CSRF tokens validate
- [ ] HTTPS enforced
- [ ] Admin routes protected
- [ ] Price tampering detected

### Email
- [ ] Order confirmation email sent
- [ ] Shipping email sent
- [ ] Delivery email sent
- [ ] Cancellation email sent
- [ ] Emails render correctly

---

## Appendix A: Environment Variables

```env
# Database
DB_HOST=localhost
DB_NAME=moowhub
DB_USER=your_db_user
DB_PASS=your_db_password

# Razorpay
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=xxxxx

# Stripe
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Resend (Email)
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=orders@yourdomain.com

# Currency API
OER_APP_ID=your_app_id

# Security
CSRF_SECRET=your_random_secret_key
SESSION_SECRET=your_session_secret

# Site
SITE_URL=https://yourdomain.com
ADMIN_EMAIL=admin@yourdomain.com
```

---

## Appendix B: Cron Jobs

```bash
# Update currency rates daily
0 0 * * * php /home/user/public_html/api/cron/update-rates.php

# Send order reminders for pending orders
0 */6 * * * php /home/user/public_html/api/cron/pending-reminders.php

# Clean expired sessions
0 2 * * * php /home/user/public_html/api/cron/clean-sessions.php

# Update order status based on tracking
0 */4 * * * php /home/user/public_html/api/cron/update-tracking.php
```

---

**Document prepared for Moow.Hub E-Commerce Implementation**  
**Version 1.0 — July 2026**
