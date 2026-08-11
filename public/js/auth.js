/**
 * Moow.Hub - Frontend Auth Module
 * Handles login, register, session management in browser
 */

const Auth = {
  // Supabase config (loaded from environment or defaults)
  supabaseUrl: window.SUPABASE_URL || 'https://xvhlvaqpinfahhullsqh.supabase.co',
  supabaseKey: window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2aGx2YXFwaW5mYWhodWxsc3FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MTgwMTYsImV4cCI6MjA5OTE5NDAxNn0.ETM-zSQDRuERao3qNd0zEfnEBdSJYUhOcYGfTAmPTgc',

  /**
   * Initialize auth - check if user is logged in
   */
  init() {
    const token = localStorage.getItem('moow_token');
    const user = localStorage.getItem('moow_user');
    
    if (token && user) {
      const parsed = JSON.parse(user);
      this.updateUI(parsed);
      if (typeof SessionManager !== 'undefined') SessionManager.init();
      return parsed;
    }
    
    this.updateUI(null);
    return null;
  },

  /**
   * Login with email and password
   */
  async login(email, password) {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    // Store token and user
    localStorage.setItem('moow_token', data.session.access_token);
    localStorage.setItem('moow_refresh_token', data.session.refresh_token);
    localStorage.setItem('moow_user', JSON.stringify(data.user));

    this.updateUI(data.user);
    try { if (typeof SessionManager !== 'undefined') SessionManager.reset(); } catch (e) { console.warn('Session reset failed:', e); }

    try { if (typeof Cart !== 'undefined') await Cart.mergeGuestCart(); } catch (e) { console.warn('Cart merge failed:', e); }

    return data.user;
  },

  /**
   * Register new user
   */
  async register(email, password, fullName, phone, extras = {}) {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email, 
        password, 
        full_name: fullName,
        phone: phone || undefined,
        interest_areas: extras.interest_areas || undefined,
        referral_source: extras.referral_source || undefined,
        source_page: extras.source_page || 'landing'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    return data;
  },

  /**
   * Logout
   */
  async logout() {
    if (typeof SessionManager !== 'undefined') {
      SessionManager.stop();
      await SessionManager.flush();
    }
    const token = this.getToken();
    
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }).catch(() => {});
    }

    localStorage.removeItem('moow_token');
    localStorage.removeItem('moow_refresh_token');
    localStorage.removeItem('moow_user');

    this.updateUI(null);
    window.location.href = '/';
  },

  /**
   * Get current user
   */
  getUser() {
    const user = localStorage.getItem('moow_user');
    return user ? JSON.parse(user) : null;
  },

  /**
   * Get auth token
   */
  getToken() {
    return localStorage.getItem('moow_token');
  },

  /**
   * Check if user is authenticated with a valid (non-expired) session
   */
  isAuthenticated() {
    if (!this.getToken()) return false;
    if (this.isSessionExpired()) {
      this.clearLocalSession();
      return false;
    }
    return true;
  },

  /**
   * Session timeout check based on tracked inactivity (moow_sa timestamp)
   */
  isSessionExpired() {
    try {
      const last = sessionStorage.getItem('moow_sa');
      if (!last) return false;
      const timeout = (window.__SESSION_CONFIG && window.__SESSION_CONFIG.timeout) || 5 * 60 * 1000;
      return (Date.now() - parseInt(last, 10)) > timeout;
    } catch {
      return false;
    }
  },

  /**
   * Remove local credentials without a full logout redirect
   */
  clearLocalSession() {
    localStorage.removeItem('moow_token');
    localStorage.removeItem('moow_refresh_token');
    localStorage.removeItem('moow_user');
    this.updateUI(null);
  },

  /**
   * Check if user is admin
   */
  isAdmin() {
    const user = this.getUser();
    return user?.is_admin === true;
  },

  /**
   * Check if user is a partner
   */
  isPartner() {
    const user = this.getUser();
    return user?.is_partner === true;
  },

  /**
   * Make authenticated API call
   */
  async authenticatedFetch(url, options = {}) {
    const token = this.getToken();
    
    if (!token) {
      if (!window.location.pathname.includes('login.html')) {
        window.location.href = '/pages/login.html';
      }
      return null;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // If 401, try to refresh token
      if (response.status === 401) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          return fetch(url, {
            ...options,
            headers: {
              ...options.headers,
              'Authorization': `Bearer ${this.getToken()}`,
              'Content-Type': 'application/json'
            }
          });
        }
        localStorage.removeItem('moow_token');
        localStorage.removeItem('moow_refresh_token');
        localStorage.removeItem('moow_user');
        this.updateUI(null);
        if (!window.location.pathname.includes('login.html')) {
          window.location.href = '/pages/login.html';
        }
        return null;
      }

      return response;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /**
   * Refresh auth token
   */
  async refreshToken() {
    const refreshToken = localStorage.getItem('moow_refresh_token');
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${this.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.supabaseKey
        },
        body: JSON.stringify({ refresh_token: refreshToken })
      });

      if (!response.ok) return false;

      const data = await response.json();
      localStorage.setItem('moow_token', data.access_token);
      localStorage.setItem('moow_refresh_token', data.refresh_token);
      
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Update UI based on auth state
   */
  updateUI(user) {
    // Update nav cart/login buttons
    const authLinks = document.querySelectorAll('[data-auth]');
    const guestLinks = document.querySelectorAll('[data-guest]');
    const userElements = document.querySelectorAll('[data-user-name]');

    authLinks.forEach(el => {
      el.style.display = user ? '' : 'none';
    });

    guestLinks.forEach(el => {
      el.style.display = user ? 'none' : '';
    });

    userElements.forEach(el => {
      el.textContent = user?.full_name || '';
    });

    // Admin dashboard link in Account dropdown
    const dropdownMenu = document.querySelector('.nav-dropdown-menu');
    let adminLink = dropdownMenu ? dropdownMenu.querySelector('.nav-admin-dashboard') : null;
    if (user?.is_admin) {
      if (!adminLink && dropdownMenu) {
        adminLink = document.createElement('a');
        adminLink.href = '/pages/admin/dashboard.html';
        adminLink.className = 'nav-dropdown-item nav-admin-dashboard';
        adminLink.setAttribute('role', 'menuitem');
        adminLink.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> Dashboard';
        const myAccountLink = dropdownMenu.querySelector('a[href*="account.html"]');
        if (myAccountLink && myAccountLink.nextElementSibling) {
          dropdownMenu.insertBefore(adminLink, myAccountLink.nextElementSibling);
        } else {
          const cartLink = dropdownMenu.querySelector('a[href*="cart.html"]');
          dropdownMenu.insertBefore(adminLink, cartLink);
        }
      }
      if (adminLink) adminLink.style.display = '';
    } else if (adminLink) {
      adminLink.style.display = 'none';
    }

    // Update cart badge if exists
    this.updateCartBadge();
  },

  /**
   * Update cart badge count
   */
  async updateCartBadge() {
    const badge = document.querySelector('.cart-count');
    if (!badge) return;

    if (!this.isAuthenticated()) {
      // Use localStorage for guest cart
      const guestCart = JSON.parse(localStorage.getItem('moow_guest_cart') || '[]');
      const count = guestCart.reduce((sum, item) => sum + item.quantity, 0);
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline-flex' : 'none';
      return;
    }

    try {
      const response = await fetch('/api/cart/get', {
        headers: {
          'Authorization': `Bearer ${this.getToken()}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        const count = data.data?.reduce((sum, item) => sum + item.quantity, 0) || 0;
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-flex' : 'none';
      } else {
        // API error or 401 — show guest cart count instead of redirecting
        const guestCart = JSON.parse(localStorage.getItem('moow_guest_cart') || '[]');
        const count = guestCart.reduce((sum, item) => sum + item.quantity, 0);
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-flex' : 'none';
      }
    } catch {
      badge.style.display = 'none';
    }
  }
};

/**
 * Session Manager — 5-minute inactivity timeout with countdown warning
 * Tracks user activity, shows a non-intrusive countdown before expiry,
 * and saves pending data before logging out.
 */
const SessionManager = {
  TIMEOUT: (window.__SESSION_CONFIG && window.__SESSION_CONFIG.timeout) || 5 * 60 * 1000,
  WARNING_AT: (window.__SESSION_CONFIG && window.__SESSION_CONFIG.warningAt) || 60 * 1000,
  CHECK_MS: 1000,
  COUNTDOWN_MS: 1000,
  THROTTLE_MS: 1000,
  RE_SHOW_MS: 30000,

  lastActivity: null,
  checkTimer: null,
  countdownTimer: null,
  countdownEl: null,
  warningVisible: false,
  reShowTimer: null,
  initialized: false,
  _trackFn: null,
  _tracked: false,

  isAuthPage() {
    const p = window.location.pathname.toLowerCase();
    return p.includes('login.html') || p.includes('register.html') ||
           p.includes('forgot-password.html') || p.includes('reset-password.html');
  },

  init() {
    if (this.initialized) return;
    if (!Auth.getToken()) return;
    if (this.isAuthPage()) return;

    this.lastActivity = this.loadActivity();
    if (Date.now() - this.lastActivity > this.TIMEOUT) {
      this.expire();
      return;
    }
    this.initialized = true;
    this.persist();
    this.buildUI();
    this.track();
    this.startCheck();
    this.watchCrossTab();
  },

  loadActivity() {
    try {
      const v = sessionStorage.getItem('moow_sa');
      return v ? parseInt(v, 10) : Date.now();
    } catch { return Date.now(); }
  },

  persist() {
    try { sessionStorage.setItem('moow_sa', String(this.lastActivity)); } catch (e) { console.warn('Session persist failed:', e.message); }
  },

  buildUI() {
    if (this.countdownEl) return;
    const el = document.createElement('div');
    el.id = 'session-countdown';
    el.className = 'session-countdown';
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-live', 'polite');
    const warnSec = Math.ceil(this.WARNING_AT / 1000);
    el.innerHTML =
      '<div class="scd-inner">' +
        '<svg class="scd-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
        '<span class="scd-msg">Session expires in <strong id="scd-time">' + Math.floor(warnSec / 60) + ':' + String(warnSec % 60).padStart(2, '0') + '</strong></span>' +
        '<button class="scd-btn" id="scd-extend" type="button">Keep Active</button>' +
        '<button class="scd-x" id="scd-dismiss" type="button" aria-label="Dismiss">&times;</button>' +
      '</div>';
    document.body.appendChild(el);
    this.countdownEl = el;

    document.getElementById('scd-extend').addEventListener('click', (e) => {
      e.stopPropagation();
      this.extend();
    });
    document.getElementById('scd-dismiss').addEventListener('click', (e) => {
      e.stopPropagation();
      this.dismiss();
    });
  },

  track() {
    if (this._tracked) return;
    let last = 0;
    const makeFn = (hideWarning) => () => {
      const now = Date.now();
      if (now - last < this.THROTTLE_MS) return;
      last = now;
      this.markActive(hideWarning);
    };
    this._trackFn = makeFn(true);
    const trackNoHide = makeFn(false);
    ['mousedown','keydown','touchstart','touchend','click','pointerdown'].forEach(e => {
      document.addEventListener(e, this._trackFn, { passive: true });
    });
    ['scroll','touchmove'].forEach(e => {
      document.addEventListener(e, trackNoHide, { passive: true });
    });
    window.addEventListener('focus', () => this.resume());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.resume();
    });
    window.addEventListener('pageshow', () => this.resume());
    this._tracked = true;
  },

  resume() {
    if (!Auth.getToken()) { this.stop(); return; }
    if (!this.lastActivity) this.lastActivity = this.loadActivity();
    const remaining = this.TIMEOUT - (Date.now() - this.lastActivity);
    if (remaining <= 0) { this.expire(); return; }
    if (remaining <= this.WARNING_AT) this.showCountdown(remaining);
  },

  markActive(hideWarning) {
    this.lastActivity = Date.now();
    this.persist();
    if (hideWarning !== false && this.warningVisible) this.hideCountdown();
  },

  startCheck() {
    this.checkTimer = setInterval(() => this.check(), this.CHECK_MS);
  },

  check() {
    if (!Auth.isAuthenticated()) { this.stop(); return; }
    const remaining = this.TIMEOUT - (Date.now() - this.lastActivity);
    if (remaining <= 0) { this.expire(); return; }
    if (remaining <= this.WARNING_AT) this.showCountdown(remaining);
  },

  showCountdown(ms) {
    if (!this.countdownEl) return;
    this.warningVisible = true;
    this.countdownEl.classList.add('visible');
    this.renderTime(ms);
    if (!this.countdownTimer) {
      this.countdownTimer = setInterval(() => {
        const rem = this.TIMEOUT - (Date.now() - this.lastActivity);
        if (rem <= 0) { this.expire(); return; }
        this.renderTime(rem);
      }, this.COUNTDOWN_MS);
    }
  },

  renderTime(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    const el = document.getElementById('scd-time');
    if (el) el.textContent = m + ':' + String(sec).padStart(2, '0');
    if (this.countdownEl) this.countdownEl.classList.toggle('scd-urgent', s <= 60);
  },

  hideCountdown() {
    this.warningVisible = false;
    if (this.countdownEl) {
      this.countdownEl.classList.remove('visible');
      this.countdownEl.classList.remove('scd-urgent');
    }
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  },

  dismiss() {
    this.hideCountdown();
    clearTimeout(this.reShowTimer);
    this.reShowTimer = setTimeout(() => {
      if (!Auth.isAuthenticated() || this.warningVisible) return;
      const rem = this.TIMEOUT - (Date.now() - this.lastActivity);
      if (rem > 0 && rem <= this.WARNING_AT) this.showCountdown(rem);
    }, this.RE_SHOW_MS);
  },

  extend() {
    this.markActive();
    this.hideCountdown();
    const totalSec = Math.round(this.TIMEOUT / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const label = mins > 0 ? (mins + (secs ? 'm ' + secs + 's' : ' minute' + (mins > 1 ? 's' : ''))) : (secs + ' seconds');
    this.toast('Session extended — you\'re active for another ' + label);
  },

  async expire() {
    this.stop();
    await this.flush();
    Auth.logout();
  },

  async flush() {
    try { await new Promise(r => setTimeout(r, 600)); } catch {}
  },

  toast(msg) {
    const t = document.createElement('div');
    t.className = 'session-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('visible'));
    setTimeout(() => {
      t.classList.remove('visible');
      setTimeout(() => t.remove(), 300);
    }, 2500);
  },

  watchCrossTab() {
    window.addEventListener('storage', (e) => {
      if (e.key === 'moow_token' && !e.newValue) {
        this.stop();
        if (!this.isAuthPage()) window.location.href = '/pages/login.html';
      }
    });
  },

  stop() {
    clearTimeout(this.reShowTimer);
    if (this.checkTimer) { clearInterval(this.checkTimer); this.checkTimer = null; }
    if (this.countdownTimer) { clearInterval(this.countdownTimer); this.countdownTimer = null; }
    this.warningVisible = false;
    if (this.countdownEl) {
      this.countdownEl.remove();
      this.countdownEl = null;
    }
    this.initialized = false;
  },

  reset() {
    this.stop();
    this.lastActivity = Date.now();
    this.persist();
    this.initialized = false;
    this.init();
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => Auth.init());
