/**
 * Moow.Hub - Single Serverless Function
 * All API routes handled via rewrites from vercel.json
 */

const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const Stripe = require('stripe');
const { Resend } = require('resend');

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const config = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
  SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET,
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM || 'orders@moow.hub',
  OER_APP_ID: process.env.OER_APP_ID,
  SITE_URL: process.env.SITE_URL || 'https://moow-hub.vercel.app',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@moow.hub',
  ORDER_PREFIX: 'MOOW',
  CANCELLATION_WINDOW_HOURS: 24,
  SUPPORTED_CURRENCIES: ['USD', 'INR', 'EUR', 'GBP', 'AED', 'SGD'],
  RATE_LIMIT_MAX_ATTEMPTS: 5,
  RATE_LIMIT_WINDOW_MINUTES: 15
};

// ─── DATABASE ──────────────────────────────────────────────────────────────────
let supabase = null;
let supabaseAdmin = null;
function getSupabase() {
  if (!supabase) {
    if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) throw new Error('Missing Supabase env vars');
    supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  }
  return supabase;
}
function getAdminDB() {
  if (!supabaseAdmin) {
    if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_KEY) throw new Error('Missing Supabase env vars');
    supabaseAdmin = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY);
  }
  return supabaseAdmin;
}

// ─── SECURITY ──────────────────────────────────────────────────────────────────
function validateEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function validatePassword(password) {
  const e = [];
  if (password.length < 8) e.push('Password must be at least 8 characters');
  if (!/[A-Z]/.test(password)) e.push('Password must contain at least one uppercase letter');
  if (!/[a-z]/.test(password)) e.push('Password must contain at least one lowercase letter');
  if (!/[0-9]/.test(password)) e.push('Password must contain at least one number');
  if (!/[^A-Za-z0-9]/.test(password)) e.push('Password must contain at least one special character');
  return e;
}
function sanitizeString(s) { return typeof s !== 'string' ? s : s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#x27;' })[c]); }
function validateRequired(data, fields) { return fields.filter(f => !data[f] || (typeof data[f] === 'string' && !data[f].trim())); }
function getClientIP(req) { for (const h of ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip']) { const v = req.headers[h]; if (v) return v.split(',')[0].trim(); } return req.socket?.remoteAddress || '0.0.0.0'; }
async function checkRateLimit(ip, endpoint) {
  const db = getAdminDB();
  const windowStart = new Date(Date.now() - config.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
  await db.from('rate_limits').delete().lt('first_attempt', windowStart);
  const { data } = await db.from('rate_limits').select('attempts').eq('ip_address', ip).eq('endpoint', endpoint).gte('first_attempt', windowStart).single();
  if (data && data.attempts >= config.RATE_LIMIT_MAX_ATTEMPTS) return { allowed: false, remaining: 0 };
  if (data) { await db.from('rate_limits').update({ attempts: data.attempts + 1, last_attempt: new Date().toISOString() }).eq('ip_address', ip).eq('endpoint', endpoint); }
  else { await db.from('rate_limits').insert({ ip_address: ip, endpoint, attempts: 1 }); }
  return { allowed: true, remaining: config.RATE_LIMIT_MAX_ATTEMPTS - (data ? data.attempts + 1 : 1) };
}

// ─── HELPERS ───────────────────────────────────────────────────────────────────
function generateOrderNumber() { return `${config.ORDER_PREFIX}-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`; }
function formatAddress(addr) {
  if (typeof addr === 'string') addr = JSON.parse(addr);
  return [addr.full_name, addr.address_line1, addr.address_line2, addr.city, addr.state, addr.postal_code, addr.country, addr.phone ? 'Phone: ' + addr.phone : null].filter(Boolean).join(', ');
}
function calculateShipping(subtotal, country = 'US') {
  if (subtotal >= 100) return { cost: 0, method: 'Free Standard Shipping', days: '5-7' };
  const rates = { IN: { base: 2.99, days: '3-5' }, US: { base: 4.99, days: '5-7' }, GB: { base: 5.99, days: '7-10' }, AE: { base: 5.99, days: '7-10' }, SG: { base: 4.99, days: '5-7' }, default: { base: 6.99, days: '10-14' } };
  const rate = rates[country] || rates.default;
  return { cost: rate.base, method: 'Standard Shipping', days: rate.days };
}
function calculateTax(subtotal, country = 'US') {
  const taxRates = { US: 0.08, IN: 0.18, GB: 0.20, AE: 0.05, SG: 0.09, default: 0 };
  return Math.round(subtotal * (taxRates[country] || taxRates.default) * 100) / 100;
}

// ─── EMAIL ─────────────────────────────────────────────────────────────────────
let resend = null;
function getResend() { if (!resend && config.RESEND_API_KEY) resend = new Resend(config.RESEND_API_KEY); return resend; }
async function sendEmail(to, subject, htmlBody, options = {}) {
  try {
    const r = getResend();
    if (!r) return { success: false, error: 'Email service not configured' };
    const result = await r.emails.send({ from: config.EMAIL_FROM, to: [to], subject, html: htmlBody });
    await dbLogEmail(to, subject, 'sent', result.data?.id, options.orderId, options.emailType);
    return { success: true, id: result.data?.id };
  } catch (error) { console.error('Email send failed:', error); await dbLogEmail(to, subject, 'failed', null, options.orderId, options.emailType); return { success: false, error: error.message }; }
}
async function dbLogEmail(recipient, subject, status, resendId = null, orderId = null, emailType = 'order_confirmation') {
  try { await getAdminDB().from('email_log').insert({ order_id: orderId, email_type: emailType, recipient, subject, status, resend_id: resendId }); } catch {}
}
function emailTemplate(content) {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;padding:0;font-family:Inter,sans-serif;background:#f5f0eb;"><div style="max-width:600px;margin:0 auto;padding:40px 20px;"><div style="text-align:center;margin-bottom:30px;"><h1 style="font-family:Playfair Display,serif;color:#1a2744;margin:0;">Moow<span style="color:#d4735e;">.</span>Hub<sup>&reg;</sup></h1></div><div style="background:white;border-radius:12px;padding:30px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">${content}</div><div style="text-align:center;margin-top:30px;color:#666;font-size:14px;"><p>Wear a pose. Awaken an ecosystem.</p><p>&copy; ${year} Moow.Hub<sup>&reg;</sup>. All rights reserved.</p></div></div></body></html>`;
}
async function sendWelcomeEmail(user, verificationToken) {
  const url = `${config.SITE_URL}/api/auth/verify?token=${verificationToken}`;
  return sendEmail(user.email, 'Welcome to Moow.Hub - Verify Your Email', emailTemplate(`<h1 style="color:#1a2744;margin-bottom:20px;">Welcome to Moow.Hub!</h1><p>Hi ${user.full_name},</p><p>Thank you for creating an account. Please verify your email:</p><a href="${url}" style="display:inline-block;background:#d4735e;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin:20px 0;">Verify Email Address</a><p style="color:#666;font-size:14px;">If the button doesn't work, copy this link: ${url}</p><p>Best,<br>The Moow.Hub Team</p>`), { emailType: 'welcome' });
}
async function sendPasswordReset(user, resetToken) {
  const url = `${config.SITE_URL}/pages/reset-password.html?token=${resetToken}`;
  return sendEmail(user.email, 'Password Reset Request - Moow.Hub', emailTemplate(`<h1 style="color:#1a2744;margin-bottom:20px;">Password Reset Request</h1><p>Hi ${user.full_name},</p><p>Click below to reset your password:</p><a href="${url}" style="display:inline-block;background:#d4735e;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin:20px 0;">Reset Password</a><p style="color:#666;font-size:14px;">If you didn't request this, ignore this email. The link expires in 1 hour.</p><p>Best,<br>The Moow.Hub Team</p>`), { emailType: 'password_reset' });
}

// ─── AUTH HELPERS ──────────────────────────────────────────────────────────────
async function verifyAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const token = authHeader.split(' ')[1];
    const response = await fetch(`${config.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: config.SUPABASE_ANON_KEY }
    });
    if (!response.ok) return null;
    const user = await response.json();
    if (!user?.id) return null;
    const { data: profile } = await getAdminDB().from('profiles').select('*').eq('id', user.id).single();
    return profile || null;
  } catch (e) {
    console.error('verifyAuth error:', e.message);
    return null;
  }
}
async function requireAuth(req, res) {
  const user = await verifyAuth(req);
  if (!user) { res.status(401).json({ error: 'Authentication required' }); return null; }
  return user;
}

// ─── PAYMENT CLIENTS (lazy init) ──────────────────────────────────────────────
let razorpayClient = null;
let stripeClient = null;
function getRazorpay() { if (!razorpayClient && config.RAZORPAY_KEY_ID) razorpayClient = new Razorpay({ key_id: config.RAZORPAY_KEY_ID, key_secret: config.RAZORPAY_KEY_SECRET }); return razorpayClient; }
function getStripe() { if (!stripeClient && config.STRIPE_SECRET_KEY) stripeClient = new Stripe(config.STRIPE_SECRET_KEY); return stripeClient; }

// ─── CORS SETUP ───────────────────────────────────────────────────────────────
function setCORS(res, methods = 'GET, POST, PUT, DELETE, OPTIONS') {
  res.setHeader('Access-Control-Allow-Origin', config.SITE_URL || 'https://moow-hub.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Razorpay-Signature, Stripe-Signature');
  res.setHeader('Access-Control-Max-Age', '86400');
}

// ─── ROUTE HANDLERS ───────────────────────────────────────────────────────────

async function handleAuth(req, res, path) {
  const db = getAdminDB();

  if (req.method === 'POST' && path === 'register') {
    const ip = getClientIP(req);
    const rateLimit = await checkRateLimit(ip, 'register');
    if (!rateLimit.allowed) return res.status(429).json({ error: 'Too many attempts' });
    const { email, password, full_name, phone } = req.body;
    const missing = validateRequired(req.body, ['email', 'password', 'full_name']);
    if (missing.length > 0) return res.status(400).json({ error: 'Missing fields', fields: missing });
    if (!validateEmail(email)) return res.status(400).json({ error: 'Invalid email' });
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) return res.status(400).json({ error: 'Weak password', details: passwordErrors });
    const { data: authUser, error: authError } = await db.auth.admin.createUser({ email: email.toLowerCase(), password, email_confirm: true });
    if (authError) {
      if (authError.message?.includes('already') || authError.message?.includes('exists')) return res.status(409).json({ error: 'Email already registered' });
      return res.status(500).json({ error: 'Failed to create account', details: authError.message });
    }
    const verificationToken = crypto.randomBytes(32).toString('hex');
    await db.from('profiles').insert({ id: authUser.user.id, full_name: sanitizeString(full_name), phone: phone || null, verification_token: verificationToken });
    sendWelcomeEmail({ id: authUser.user.id, email: email.toLowerCase(), full_name: sanitizeString(full_name) }, verificationToken).catch(() => {});
    return res.status(201).json({ success: true, message: 'Account created', user: { id: authUser.user.id, email: email.toLowerCase(), full_name: sanitizeString(full_name) } });
  }

  if (req.method === 'POST' && path === 'login') {
    const ip = getClientIP(req);
    const rateLimit = await checkRateLimit(ip, 'login');
    if (!rateLimit.allowed) return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: 'Invalid credentials' });
    const { data: profile } = await db.from('profiles').select('*').eq('id', data.user.id).single();
    return res.status(200).json({ success: true, session: data.session, user: { ...profile, email: data.user.email } });
  }

  if (req.method === 'POST' && path === 'logout') {
    return res.status(200).json({ success: true });
  }

  if (req.method === 'GET' && path === 'user') {
    const user = await verifyAuth(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    const authHeader = req.headers.authorization;
    const token = authHeader.split(' ')[1];
    const authRes = await fetch(`${config.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: config.SUPABASE_ANON_KEY }
    });
    const authUser = authRes.ok ? await authRes.json() : null;
    const { data: addresses } = await db.from('user_addresses').select('*').eq('user_id', user.id).order('is_default', { ascending: false }).order('created_at', { ascending: false });
    return res.status(200).json({ success: true, data: { ...user, email: authUser?.email || user.email, addresses: addresses || [] } });
  }

  if (req.method === 'PUT' && path === 'user') {
    const user = await requireAuth(req, res);
    if (!user) return true;
    const { full_name, phone, default_currency } = req.body;
    const updates = {};
    if (full_name !== undefined) updates.full_name = sanitizeString(full_name);
    if (phone !== undefined) updates.phone = phone || null;
    if (default_currency !== undefined) updates.default_currency = default_currency;
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No fields to update' });
    updates.updated_at = new Date().toISOString();
    const { error } = await db.from('profiles').update(updates).eq('id', user.id);
    if (error) return res.status(500).json({ error: 'Failed to update profile' });
    const { data: updated } = await db.from('profiles').select('*').eq('id', user.id).single();
    return res.status(200).json({ success: true, data: updated });
  }

  if (req.method === 'POST' && path === 'password-change') {
    const user = await requireAuth(req, res);
    if (!user) return true;
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password required' });
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) return res.status(400).json({ error: 'Weak password', details: passwordErrors });
    const { error: updateError } = await db.auth.admin.updateUserById(user.id, { password });
    if (updateError) return res.status(500).json({ error: 'Failed to update password' });
    return res.status(200).json({ success: true, message: 'Password updated successfully' });
  }

  // ─── ADDRESS MANAGEMENT ───────────────────────────────────────────────────
  if (req.method === 'POST' && path === 'addresses') {
    const user = await requireAuth(req, res);
    if (!user) return true;
    const { label, full_name, phone, address_line1, address_line2, city, state, postal_code, country, is_default } = req.body;
    if (!full_name || !address_line1 || !city || !postal_code || !country) {
      return res.status(400).json({ error: 'Missing required address fields' });
    }
    const addrData = { user_id: user.id, label: label || null, full_name: sanitizeString(full_name), phone: phone || null, address_line1: sanitizeString(address_line1), address_line2: address_line2 ? sanitizeString(address_line2) : null, city: sanitizeString(city), state: state ? sanitizeString(state) : null, postal_code: postal_code, country: country, is_default: is_default || false };
    if (is_default) {
      await db.from('user_addresses').update({ is_default: false }).eq('user_id', user.id);
    }
    const { data: addr, error } = await db.from('user_addresses').insert(addrData).select().single();
    if (error) return res.status(500).json({ error: 'Failed to save address' });
    return res.status(201).json({ success: true, data: addr });
  }

  if (req.method === 'PUT' && path === 'addresses') {
    const user = await requireAuth(req, res);
    if (!user) return true;
    const { id, label, full_name, phone, address_line1, address_line2, city, state, postal_code, country, is_default } = req.body;
    if (!id) return res.status(400).json({ error: 'Address ID required' });
    const updates = {};
    if (label !== undefined) updates.label = label || null;
    if (full_name !== undefined) updates.full_name = sanitizeString(full_name);
    if (phone !== undefined) updates.phone = phone || null;
    if (address_line1 !== undefined) updates.address_line1 = sanitizeString(address_line1);
    if (address_line2 !== undefined) updates.address_line2 = address_line2 ? sanitizeString(address_line2) : null;
    if (city !== undefined) updates.city = sanitizeString(city);
    if (state !== undefined) updates.state = state ? sanitizeString(state) : null;
    if (postal_code !== undefined) updates.postal_code = postal_code;
    if (country !== undefined) updates.country = country;
    if (is_default) {
      await db.from('user_addresses').update({ is_default: false }).eq('user_id', user.id);
      updates.is_default = true;
    }
    const { error } = await db.from('user_addresses').update(updates).eq('id', id).eq('user_id', user.id);
    if (error) return res.status(500).json({ error: 'Failed to update address' });
    const { data: updated } = await db.from('user_addresses').select('*').eq('id', id).single();
    return res.status(200).json({ success: true, data: updated });
  }

  if (req.method === 'DELETE' && path === 'addresses') {
    const user = await requireAuth(req, res);
    if (!user) return true;
    const addrId = req.body?.id || req.query?.id;
    if (!addrId) return res.status(400).json({ error: 'Address ID required' });
    const { error } = await db.from('user_addresses').delete().eq('id', addrId).eq('user_id', user.id);
    if (error) return res.status(500).json({ error: 'Failed to delete address' });
    return res.status(200).json({ success: true, message: 'Address deleted' });
  }

  if (req.method === 'POST' && path === 'password-reset') {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const { data: authUsers } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const authUser = authUsers?.users?.find(u => u.email === email.toLowerCase());
    if (authUser) {
      const { data: profile } = await db.from('profiles').select('id, full_name').eq('id', authUser.id).single();
      if (profile) {
        const resetToken = crypto.randomBytes(32).toString('hex');
        await db.from('profiles').update({ reset_token: resetToken, reset_token_expires: new Date(Date.now() + 3600000).toISOString() }).eq('id', profile.id);
        const emailResult = await sendPasswordReset({ ...profile, email: authUser.email }, resetToken);
        return res.status(200).json({ success: true, message: 'If email exists, reset link sent' });
      }
    }
    return res.status(200).json({ success: true, message: 'If email exists, reset link sent' });
  }

  if (req.method === 'POST' && path === 'password-reset-confirm') {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and password required' });
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) return res.status(400).json({ error: 'Weak password', details: passwordErrors });
    const { data: profile } = await db.from('profiles').select('id, reset_token_expires').eq('reset_token', token).single();
    if (!profile) return res.status(400).json({ error: 'Invalid or expired reset token' });
    if (new Date(profile.reset_token_expires) < new Date()) return res.status(400).json({ error: 'Reset token has expired' });
    const { error: updateError } = await db.auth.admin.updateUserById(profile.id, { password });
    if (updateError) return res.status(500).json({ error: 'Failed to update password' });
    await db.from('profiles').update({ reset_token: null, reset_token_expires: null }).eq('id', profile.id);
    return res.status(200).json({ success: true, message: 'Password updated successfully' });
  }

  return null;
}

async function handleProducts(req, res, path, url) {
  if (req.method !== 'GET') return null;
  const db = getAdminDB();

  if (path === 'list') {
    const { page = 1, limit = 20, category, search, sort = 'newest' } = url.searchParams;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let query = db.from('products').select('*', { count: 'exact' }).eq('is_active', true);
    if (category) query = query.eq('category', category);
    if (search) query = query.ilike('name', `%${search}%`);
    if (sort === 'price-low') query = query.order('price_usd', { ascending: true });
    else if (sort === 'price-high') query = query.order('price_usd', { ascending: false });
    else query = query.order('created_at', { ascending: false });
    const { data: products, count, error } = await query.range(offset, offset + parseInt(limit) - 1);
    if (error) return res.status(500).json({ error: 'Failed to fetch products' });
    return res.status(200).json({ success: true, data: products || [], pagination: { page: parseInt(page), limit: parseInt(limit), total: count || 0 } });
  }

  if (path === 'detail') {
    const id = url.searchParams.get('id');
    if (!id) return res.status(400).json({ error: 'Product ID required' });
    const { data: product, error } = await db.from('products').select('*').eq('id', id).single();
    if (error || !product) return res.status(404).json({ error: 'Product not found' });
    return res.status(200).json({ success: true, data: product });
  }

  if (path === 'suggestions') {
    const id = url.searchParams.get('id');
    const limit = parseInt(url.searchParams.get('limit') || '4');
    if (!id) return res.status(400).json({ error: 'Product ID required' });
    const { data: product } = await db.from('products').select('category').eq('id', id).single();
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const { data: suggestions } = await db.from('products').select('*').eq('category', product.category).eq('is_active', true).neq('id', id).limit(limit);
    return res.status(200).json({ success: true, data: suggestions || [] });
  }

  return null;
}

async function handleCart(req, res, path) {
  const user = await requireAuth(req, res);
  if (!user) return true;
  const db = getAdminDB();

  if (req.method === 'GET' && path === 'get') {
    const { data: items, error } = await db.from('cart_items').select('*, products(*)').eq('user_id', user.id);
    if (error) return res.status(500).json({ error: 'Failed to fetch cart' });
    return res.status(200).json({ success: true, data: items || [] });
  }

  if (req.method === 'POST' && path === 'add') {
    const { product_id, quantity = 1, size } = req.body;
    if (!product_id) return res.status(400).json({ error: 'Product ID required' });
    let query = db.from('cart_items').select('id, quantity').eq('user_id', user.id).eq('product_id', product_id);
    if (size) { query = query.eq('size', size); }
    else { query = query.is('size', null); }
    const { data: existing } = await query.maybeSingle();
    if (existing) { await db.from('cart_items').update({ quantity: existing.quantity + quantity }).eq('id', existing.id); }
    else { await db.from('cart_items').insert({ user_id: user.id, product_id, quantity, size: size || null }); }
    return res.status(200).json({ success: true, message: 'Added to cart' });
  }

  if (req.method === 'PUT' && path === 'update') {
    const { item_id, quantity } = req.body;
    if (!item_id || quantity === undefined) return res.status(400).json({ error: 'Item ID and quantity required' });
    if (quantity <= 0) { await db.from('cart_items').delete().eq('id', item_id).eq('user_id', user.id); }
    else { await db.from('cart_items').update({ quantity }).eq('id', item_id).eq('user_id', user.id); }
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE' && path === 'remove') {
    const { item_id } = req.body;
    if (!item_id) return res.status(400).json({ error: 'Item ID required' });
    await db.from('cart_items').delete().eq('id', item_id).eq('user_id', user.id);
    return res.status(200).json({ success: true });
  }

  return false;
}

async function handleCheckout(req, res, path) {
  const user = await requireAuth(req, res);
  if (!user) return true;
  const db = getAdminDB();

  if (req.method === 'POST' && path === 'create-order') {
    const { shipping_address, currency = 'USD', payment_method, items: clientItems } = req.body;
    if (!shipping_address || !payment_method) return res.status(400).json({ error: 'Missing required fields' });

    let cartItems = null;
    const { data: dbItems } = await db.from('cart_items').select('*, products(*)').eq('user_id', user.id);
    if (dbItems && dbItems.length > 0) cartItems = dbItems;

    if (!cartItems && (!clientItems || clientItems.length === 0)) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    let orderItems, subtotal, total, shipping, tax;
    if (cartItems) {
      subtotal = 0;
      orderItems = cartItems.map(item => {
        const itemTotal = item.products.price_usd * item.quantity;
        subtotal += itemTotal;
        return { product_id: item.product_id, product_name: item.products.name, product_image: item.products.image_url, quantity: item.quantity, unit_price: item.products.price_usd, total_price: itemTotal, size: item.size };
      });
      shipping = calculateShipping(subtotal, shipping_address.country);
      tax = calculateTax(subtotal, shipping_address.country);
      total = subtotal + shipping.cost + tax;
    } else {
      subtotal = clientItems.reduce((s, i) => s + (i.price_usd * i.quantity), 0);
      shipping = calculateShipping(subtotal, shipping_address.country);
      tax = calculateTax(subtotal, shipping_address.country);
      total = subtotal + shipping.cost + tax;
      orderItems = clientItems.map(item => ({ product_id: item.product_id, product_name: item.product_name, product_image: item.product_image, quantity: item.quantity, unit_price: item.price_usd, total_price: item.price_usd * item.quantity, size: item.size || null }));
    }
    const isINR = currency === 'INR';
    const paymentGateway = isINR ? 'razorpay' : 'stripe';
    const orderNumber = generateOrderNumber();
    let paymentOrder = null;
    if (paymentGateway === 'razorpay') {
      const rp = getRazorpay();
      if (rp) paymentOrder = await rp.orders.create({ amount: Math.round(total * 100), currency: 'INR', receipt: orderNumber });
    } else {
      const st = getStripe();
      if (st) paymentOrder = await st.paymentIntents.create({ amount: Math.round(total * 100), currency: currency.toLowerCase(), metadata: { order_number: orderNumber, user_id: user.id } });
    }
    const { data: order, error: orderError } = await db.from('orders').insert({ user_id: user.id, order_number: orderNumber, subtotal, shipping_cost: shipping.cost, tax, total, currency, status: 'pending', payment_method, payment_gateway: paymentGateway, razorpay_order_id: paymentOrder?.id, stripe_payment_intent_id: paymentOrder?.id, shipping_address: JSON.stringify(shipping_address) }).select().single();
    if (orderError || !order) return res.status(500).json({ error: 'Failed to create order', details: orderError?.message });
    const { error: itemsError } = await db.from('order_items').insert(orderItems.map(item => ({ ...item, order_id: order.id, currency })));
    if (itemsError) console.error('order_items insert error:', itemsError.message);
    if (cartItems) {
      for (const item of cartItems) await db.from('products').update({ stock: item.products.stock - item.quantity }).eq('id', item.product_id);
      await db.from('cart_items').delete().eq('user_id', user.id);
    }
    return res.status(200).json({ success: true, data: { order_id: order.id, order_number: orderNumber, total, currency, payment: { gateway: paymentGateway, razorpay_key: isINR ? config.RAZORPAY_KEY_ID : null, razorpay_order_id: isINR ? paymentOrder?.id : null, stripe_client_secret: !isINR ? paymentOrder?.client_secret : null, stripe_publishable_key: !isINR ? config.STRIPE_PUBLISHABLE_KEY : null } } });
  }

  if (req.method === 'POST' && path === 'verify-payment') {
    const { order_id, razorpay_payment_id } = req.body;
    if (!order_id) return res.status(400).json({ error: 'Order ID required' });
    await db.from('orders').update({ status: 'confirmed', payment_id: razorpay_payment_id, payment_status: 'paid' }).eq('id', order_id);
    const { data: order } = await db.from('orders').select('*').eq('id', order_id).single();
    return res.status(200).json({ success: true, data: order });
  }

  if (req.method === 'POST' && path === 'cod-send-otp') {
    const { shipping_address, currency = 'USD', items: clientItems, totals: clientTotals } = req.body;
    if (!shipping_address) return res.status(400).json({ error: 'Shipping address required' });

    let cartItems = null;
    const { data: dbItems } = await db.from('cart_items').select('*, products(*)').eq('user_id', user.id);
    if (dbItems && dbItems.length > 0) cartItems = dbItems;

    if (!cartItems && (!clientItems || clientItems.length === 0)) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    let orderItems, subtotal, total, shipping, tax;
    if (cartItems) {
      subtotal = 0;
      orderItems = cartItems.map(item => { const itemTotal = item.products.price_usd * item.quantity; subtotal += itemTotal; return { product_id: item.product_id, product_name: item.products.name, product_image: item.products.image_url, quantity: item.quantity, unit_price: item.products.price_usd, total_price: itemTotal, size: item.size }; });
      shipping = calculateShipping(subtotal, shipping_address.country);
      tax = calculateTax(subtotal, shipping_address.country);
      total = subtotal + shipping.cost + tax;
    } else {
      subtotal = clientTotals?.subtotal || clientItems.reduce((s, i) => s + (i.price_usd * i.quantity), 0);
      shipping = calculateShipping(subtotal, shipping_address.country);
      tax = calculateTax(subtotal, shipping_address.country);
      total = clientTotals?.total || (subtotal + shipping.cost + tax);
      orderItems = clientItems.map(item => ({ product_id: item.product_id, product_name: item.product_name, product_image: item.product_image, quantity: item.quantity, unit_price: item.price_usd, total_price: item.price_usd * item.quantity, size: item.size || null }));
    }
    const orderNumber = generateOrderNumber();
    const { data: order, error: orderError } = await db.from('orders').insert({ user_id: user.id, order_number: orderNumber, subtotal, shipping_cost: shipping.cost, tax, total, currency, status: 'confirmed', payment_method: 'cod', payment_gateway: 'cod', payment_status: 'pending', shipping_address: JSON.stringify(shipping_address) }).select().single();
    if (orderError || !order) return res.status(500).json({ error: 'Failed to create order', details: orderError?.message });
    const itemsToInsert = orderItems.map(item => ({ ...item, order_id: order.id, currency }));
    const { error: itemsError } = await db.from('order_items').insert(itemsToInsert).select();
    if (itemsError) console.error('order_items insert error:', itemsError.message);
    if (cartItems) {
      for (const item of cartItems) await db.from('products').update({ stock: item.products.stock - item.quantity }).eq('id', item.product_id);
      await db.from('cart_items').delete().eq('user_id', user.id);
    }
    return res.status(200).json({ success: true, data: { order_id: order.id, order_number: orderNumber, total, currency } });
  }

  return false;
}

async function handleOrders(req, res, path, url) {
  const user = await requireAuth(req, res);
  if (!user) return true;
  const db = getAdminDB();

  if (req.method === 'GET' && path === 'list') {
    const { page = 1, limit = 10, status } = url.searchParams;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let query = db.from('orders').select('*, order_items(*)', { count: 'exact' }).eq('user_id', user.id).order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data: orders, count, error } = await query.range(offset, offset + parseInt(limit) - 1);
    if (error) return res.status(500).json({ error: 'Failed to fetch orders' });
    return res.status(200).json({ success: true, data: orders || [], pagination: { page: parseInt(page), limit: parseInt(limit), total: count || 0 } });
  }

  if (req.method === 'GET' && path === 'detail') {
    const id = url.searchParams.get('id');
    if (!id) return res.status(400).json({ error: 'Order ID required' });
    const { data: order, error } = await db.from('orders').select('*, order_items(*)').eq('id', id).eq('user_id', user.id).single();
    if (error || !order) return res.status(404).json({ error: 'Order not found' });
    return res.status(200).json({ success: true, data: order });
  }

  if (req.method === 'GET' && path === 'track') {
    const id = url.searchParams.get('id');
    if (!id) return res.status(400).json({ error: 'Order ID required' });
    const { data: order } = await db.from('orders').select('id, order_number, status, tracking_number, carrier, shipped_at, delivered_at, created_at, shipping_address').eq('id', id).eq('user_id', user.id).single();
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const timeline = [
      { status: 'Order Placed', date: order.created_at, completed: true },
      { status: 'Confirmed', date: order.created_at, completed: ['confirmed', 'processing', 'shipped', 'delivered'].includes(order.status) },
      { status: 'Processing', date: order.status === 'processing' ? order.updated_at : null, completed: ['processing', 'shipped', 'delivered'].includes(order.status) },
      { status: 'Shipped', date: order.shipped_at, completed: ['shipped', 'delivered'].includes(order.status), description: order.tracking_number ? `Tracking: ${order.tracking_number}` : '' },
      { status: 'Delivered', date: order.delivered_at, completed: order.status === 'delivered' }
    ];
    return res.status(200).json({ success: true, data: { order_id: order.id, order_number: order.order_number, status: order.status, timeline } });
  }

  if (req.method === 'POST' && path === 'cancel') {
    const { order_id, reason } = req.body;
    if (!order_id) return res.status(400).json({ error: 'Order ID required' });
    const { data: order } = await db.from('orders').select('*').eq('id', order_id).eq('user_id', user.id).single();
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!['pending', 'confirmed', 'processing'].includes(order.status)) return res.status(400).json({ error: 'Order cannot be cancelled' });
    const hoursSinceOrder = (Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60);
    if (hoursSinceOrder > 24) return res.status(400).json({ error: 'Cancellation window expired (24 hours)' });
    await db.from('orders').update({ status: 'cancelled', cancel_reason: reason || 'Cancelled by customer', cancelled_at: new Date().toISOString() }).eq('id', order_id);
    const { data: orderItems } = await db.from('order_items').select('product_id, quantity').eq('order_id', order_id);
    if (orderItems) for (const item of orderItems) await db.rpc('increment_stock', { p_product_id: item.product_id, p_quantity: item.quantity });
    return res.status(200).json({ success: true, message: 'Order cancelled' });
  }

  return false;
}

async function handleWishlist(req, res, path) {
  const user = await requireAuth(req, res);
  if (!user) return true;
  const db = getAdminDB();

  if (req.method === 'GET' && path === 'get') {
    const { data: wishlist, error } = await db.from('wishlist').select('*, products(*)').eq('user_id', user.id).order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: 'Failed to fetch wishlist' });
    return res.status(200).json({ success: true, data: wishlist || [] });
  }

  if (req.method === 'POST' && path === 'add') {
    const { product_id } = req.body;
    if (!product_id) return res.status(400).json({ error: 'Product ID required' });
    const { data: existing } = await db.from('wishlist').select('id').eq('user_id', user.id).eq('product_id', product_id).single();
    if (existing) return res.status(409).json({ error: 'Already in wishlist' });
    await db.from('wishlist').insert({ user_id: user.id, product_id });
    return res.status(200).json({ success: true, message: 'Added to wishlist' });
  }

  if (req.method === 'DELETE' && path === 'remove') {
    const { product_id } = req.body;
    if (!product_id) return res.status(400).json({ error: 'Product ID required' });
    await db.from('wishlist').delete().eq('user_id', user.id).eq('product_id', product_id);
    return res.status(200).json({ success: true, message: 'Removed from wishlist' });
  }

  return false;
}

// ─── PARTNER HANDLER ─────────────────────────────────────────────────────────
async function handlePartner(req, res, path) {
  const user = await requireAuth(req, res);
  if (!user) return true;
  const db = getAdminDB();

  if (req.method === 'GET' && path === 'status') {
    return res.status(200).json({ success: true, data: { is_partner: user.is_partner === true } });
  }

  if (req.method === 'POST' && path === 'apply') {
    if (user.is_partner) return res.status(200).json({ success: true, message: 'Already a partner' });
    const updates = { is_partner: true, updated_at: new Date().toISOString() };
    const { error } = await db.from('profiles').update(updates).eq('id', user.id);
    if (error) return res.status(500).json({ error: 'Failed to apply as partner' });
    const { data: updated } = await db.from('profiles').select('*').eq('id', user.id).single();
    sendEmail(user.email, 'Welcome to Moow.Hub Partner Network', emailTemplate(`<h1 style="color:#1a2744;margin-bottom:20px;">You're Now a Moow.Hub Partner!</h1><p>Hi ${user.full_name || 'Partner'},</p><p>Congratulations! Your partner application has been approved. You now have full access to partnership schedules, pricing, and resources.</p><p><strong>What's next:</strong></p><ul style="color:#666;"><li>Review the <a href="${config.SITE_URL}/pages/agreement.html">Partnership Agreement</a></li><li>Access exclusive partner pricing</li><li>Download brand assets and marketing materials</li></ul><p>Best,<br>The Moow.Hub Team</p>`), { emailType: 'welcome' }).catch(() => {});
    return res.status(200).json({ success: true, data: { is_partner: true, user: updated } });
  }

  return false;
}

async function handleAdmin(req, res, path, url) {
  const user = await requireAuth(req, res);
  if (!user) return true;
  if (!user.is_admin) { res.status(403).json({ error: 'Admin access required' }); return true; }
  const db = getAdminDB();

  if (req.method === 'GET' && path === 'dashboard') {
    const [ordersResult, productsResult, usersResult] = await Promise.all([
      db.from('orders').select('id', { count: 'exact', head: true }),
      db.from('products').select('id', { count: 'exact', head: true }),
      db.from('profiles').select('id', { count: 'exact', head: true })
    ]);
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: recentOrders } = await db.from('orders').select('total, status, created_at').gte('created_at', thirtyDaysAgo.toISOString()).neq('status', 'cancelled');
    const revenue = (recentOrders || []).reduce((sum, o) => sum + Number(o.total), 0);
    const { data: recentOrdersList } = await db.from('orders').select('id, order_number, total, status, created_at, shipping_address').order('created_at', { ascending: false }).limit(10);
    const { data: lowStock } = await db.from('products').select('id, name, stock').lte('stock', 5).order('stock', { ascending: true });
    return res.status(200).json({ success: true, data: {
      stats: { totalOrders: ordersResult.count || 0, totalProducts: productsResult.count || 0, totalUsers: usersResult.count || 0, revenue30Days: Math.round(revenue * 100) / 100 },
      recentOrders: (recentOrdersList || []).map(o => ({ id: o.id, order_number: o.order_number, total: o.total, status: o.status, created_at: o.created_at, customer: typeof o.shipping_address === 'string' ? JSON.parse(o.shipping_address)?.full_name : o.shipping_address?.full_name })),
      lowStockProducts: lowStock || []
    }});
  }

  if (req.method === 'GET' && path === 'products') {
    const { data: products, count } = await db.from('products').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    return res.status(200).json({ success: true, data: products || [], pagination: { total: count || 0 } });
  }

  if (req.method === 'POST' && path === 'products') {
    const { name, price_usd, category } = req.body;
    if (!name || !price_usd || !category) return res.status(400).json({ error: 'Missing required fields' });
    const { data: product } = await db.from('products').insert({ name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), description: req.body.description || '', price_usd, category, image_url: req.body.image_url || 'images/placeholder.jpg', stock: req.body.stock || 0, featured: req.body.featured || false }).select().single();
    return res.status(200).json({ success: true, data: product });
  }

  if (req.method === 'PUT' && path === 'products') {
    const { id, ...updates } = req.body;
    if (!id) return res.status(400).json({ error: 'Product ID required' });
    const { data: product } = await db.from('products').update(updates).eq('id', id).select().single();
    return res.status(200).json({ success: true, data: product });
  }

  if (req.method === 'DELETE' && path === 'products') {
    const id = url.searchParams.get('id');
    if (!id) return res.status(400).json({ error: 'Product ID required' });
    await db.from('products').delete().eq('id', id);
    return res.status(200).json({ success: true });
  }

  if (req.method === 'GET' && path === 'orders') {
    const { page = 1, limit = 20, status, search } = url.searchParams;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let query = db.from('orders').select('*, order_items(*)', { count: 'exact' }).order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    if (search) query = query.ilike('order_number', `%${search}%`);
    const { data: orders, count } = await query.range(offset, offset + parseInt(limit) - 1);
    return res.status(200).json({ success: true, data: (orders || []).map(o => ({ id: o.id, order_number: o.order_number, customer: typeof o.shipping_address === 'string' ? JSON.parse(o.shipping_address)?.full_name : o.shipping_address?.full_name, total: o.total, currency: o.currency, status: o.status, payment_method: o.payment_method, created_at: o.created_at, items_count: o.order_items?.length || 0 })), pagination: { page: parseInt(page), limit: parseInt(limit), total: count || 0 } });
  }

  if (req.method === 'PUT' && path === 'orders') {
    const { id, status, tracking_number, carrier } = req.body;
    if (!id || !status) return res.status(400).json({ error: 'Order ID and status required' });
    const updates = { status, updated_at: new Date().toISOString() };
    if (status === 'shipped') { updates.shipped_at = new Date().toISOString(); if (tracking_number) updates.tracking_number = tracking_number; if (carrier) updates.carrier = carrier; }
    if (status === 'delivered') updates.delivered_at = new Date().toISOString();
    const { data: order } = await db.from('orders').update(updates).eq('id', id).select().single();
    return res.status(200).json({ success: true, data: order });
  }

  return false;
}

async function handleCurrency(req, res) {
  if (req.method !== 'GET') return null;
  const db = getAdminDB();
  const { data: cached } = await db.from('currency_rates').select('rates, updated_at').order('updated_at', { ascending: false }).limit(1).single();
  if (cached) {
    const cachedTime = new Date(cached.updated_at).getTime();
    if (Date.now() - cachedTime < 3600000) return res.status(200).json({ success: true, rates: cached.rates, cached: true });
  }
  if (config.OER_APP_ID) {
    try {
      const response = await fetch(`https://openexchangerates.org/api/latest.json?app_id=${config.OER_APP_ID}&symbols=INR,EUR,GBP,AED,SGD`);
      if (response.ok) { const data = await response.json(); const rates = data.rates || {}; await db.from('currency_rates').insert({ base_currency: 'USD', rates }); return res.status(200).json({ success: true, rates, cached: false }); }
    } catch {}
  }
  return res.status(200).json({ success: true, rates: { INR: 83.50, EUR: 0.92, GBP: 0.79, AED: 3.67, SGD: 1.34 }, cached: false, fallback: true });
}

async function handleWebhooks(req, res, path) {
  if (req.method !== 'POST') return null;
  const db = getAdminDB();

  if (path === 'razorpay') {
    const body = req.body;
    const signature = req.headers['x-razorpay-signature'];
    if (!config.RAZORPAY_KEY_SECRET) return res.status(500).json({ error: 'Razorpay not configured' });
    const expectedSignature = crypto.createHmac('sha256', config.RAZORPAY_KEY_SECRET).update(JSON.stringify(body)).digest('hex');
    if (signature !== expectedSignature) return res.status(400).json({ error: 'Invalid signature' });
    const event = body.event;
    if (event === 'payment.captured') { const payment = body.payload.payment.entity; await db.from('orders').update({ payment_status: 'paid', payment_id: payment.id, status: 'confirmed' }).eq('razorpay_order_id', payment.order_id); }
    if (event === 'payment.failed') { const payment = body.payload.payment.entity; await db.from('orders').update({ payment_status: 'failed', payment_id: payment.id }).eq('razorpay_order_id', payment.order_id); }
    return res.status(200).json({ received: true });
  }

  if (path === 'stripe') {
    const body = req.body;
    const sig = req.headers['stripe-signature'];
    const st = getStripe();
    if (!st || !config.STRIPE_WEBHOOK_SECRET) return res.status(500).json({ error: 'Stripe not configured' });
    try {
      const event = st.webhooks.constructEvent(JSON.stringify(body), sig, config.STRIPE_WEBHOOK_SECRET);
      if (event.type === 'payment_intent.succeeded') { const pi = event.data.object; await db.from('orders').update({ payment_status: 'paid', payment_id: pi.id, status: 'confirmed' }).eq('stripe_payment_intent_id', pi.id); }
      if (event.type === 'payment_intent.payment_failed') { const pi = event.data.object; await db.from('orders').update({ payment_status: 'failed', payment_id: pi.id }).eq('stripe_payment_intent_id', pi.id); }
    } catch { return res.status(400).json({ error: 'Webhook verification failed' }); }
    return res.status(200).json({ received: true });
  }

  return null;
}

// ─── MAIN HANDLER ──────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `https://${req.headers.host}`);
  const pathParts = url.pathname.replace('/api/', '').split('/');
  const section = pathParts[0];   // auth, products, cart, etc.
  const subPath = pathParts.slice(1).join('/') || '';

  try {
    let handled = false;

    switch (section) {
      case 'auth':
        handled = await handleAuth(req, res, subPath);
        break;
      case 'products':
        handled = await handleProducts(req, res, subPath, url);
        break;
      case 'cart':
        handled = await handleCart(req, res, subPath);
        break;
      case 'checkout':
        handled = await handleCheckout(req, res, subPath);
        break;
      case 'orders':
        handled = await handleOrders(req, res, subPath, url);
        break;
      case 'wishlist':
        handled = await handleWishlist(req, res, subPath);
        break;
      case 'partner':
        handled = await handlePartner(req, res, subPath);
        break;
      case 'admin':
        handled = await handleAdmin(req, res, subPath, url);
        break;
      case 'currency':
        handled = await handleCurrency(req, res);
        break;
      case 'webhooks':
        handled = await handleWebhooks(req, res, subPath);
        break;
      default:
        return res.status(404).json({ error: 'Not found' });
    }

    if (!handled) return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
