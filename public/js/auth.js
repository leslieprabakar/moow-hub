/**
 * Moow.Hub - Frontend Auth Module
 * Handles login, register, session management in browser
 */

const Auth = {
  // Supabase config (loaded from environment or defaults)
  supabaseUrl: window.SUPABASE_URL || 'YOUR_SUPABASE_URL',
  supabaseKey: window.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY',

  /**
   * Initialize auth - check if user is logged in
   */
  init() {
    const token = localStorage.getItem('moow_token');
    const user = localStorage.getItem('moow_user');
    
    if (token && user) {
      this.updateUI(JSON.parse(user));
      return JSON.parse(user);
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
    return data.user;
  },

  /**
   * Register new user
   */
  async register(email, password, fullName, phone) {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email, 
        password, 
        full_name: fullName,
        phone: phone || undefined
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
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.getToken();
  },

  /**
   * Check if user is admin
   */
  isAdmin() {
    const user = this.getUser();
    return user?.is_admin === true;
  },

  /**
   * Make authenticated API call
   */
  async authenticatedFetch(url, options = {}) {
    const token = this.getToken();
    
    if (!token) {
      window.location.href = '/pages/login.html';
      return null;
    }

    const response = await fetch(url, {
      ...options,
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
      window.location.href = '/pages/login.html';
      return null;
    }

    return response;
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
      const response = await this.authenticatedFetch('/api/cart/get');
      if (response && response.ok) {
        const data = await response.json();
        const count = data.data?.reduce((sum, item) => sum + item.quantity, 0) || 0;
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-flex' : 'none';
      }
    } catch {
      badge.style.display = 'none';
    }
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => Auth.init());
