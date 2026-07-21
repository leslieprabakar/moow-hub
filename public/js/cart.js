/**
 * Moow.Hub - Cart Module
 * Handles cart operations (add, update, remove, sync)
 */

const Cart = {
  /**
   * Get guest cart from localStorage
   */
  getGuestCart() {
    return JSON.parse(localStorage.getItem('moow_guest_cart') || '[]');
  },

  /**
   * Save guest cart to localStorage
   */
  saveGuestCart(cart) {
    localStorage.setItem('moow_guest_cart', JSON.stringify(cart));
    this.updateBadge();
  },

  /**
   * Add item to cart
   */
  async addItem(productId, quantity = 1, size = null) {
    if (Auth.isAuthenticated()) {
      return this.addServerItem(productId, quantity, size);
    } else {
      return this.addGuestItem(productId, quantity, size);
    }
  },

  /**
   * Add item to server cart (logged in)
   */
  async addServerItem(productId, quantity, size) {
    try {
      const response = await Auth.authenticatedFetch('/api/cart/add', {
        method: 'POST',
        body: JSON.stringify({ product_id: productId, quantity, size })
      });

      if (!response) return { success: false, error: 'Not authenticated' };

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error };
      }

      this.updateBadge();
      return { success: true, message: 'Added to cart' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Add item to guest cart (localStorage)
   */
  addGuestItem(productId, quantity, size) {
    const cart = this.getGuestCart();
    
    // Check if item already exists
    const existingIndex = cart.findIndex(
      item => item.product_id === productId && item.size === size
    );

    if (existingIndex >= 0) {
      cart[existingIndex].quantity += quantity;
    } else {
      cart.push({
        product_id: productId,
        quantity,
        size,
        added_at: new Date().toISOString()
      });
    }

    this.saveGuestCart(cart);
    return { success: true, message: 'Added to cart' };
  },

  /**
   * Get all cart items
   */
  async getItems() {
    if (Auth.isAuthenticated()) {
      return this.getServerItems();
    } else {
      return this.getGuestItems();
    }
  },

  /**
   * Get server cart items
   */
  async getServerItems() {
    try {
      const response = await Auth.authenticatedFetch('/api/cart/get');
      if (!response || !response.ok) return [];
      
      const data = await response.json();
      const items = data.data || [];
      return items.map(item => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.products?.name || '',
        product_image: item.products?.image_url || '',
        price_usd: item.products?.price_usd || 0,
        quantity: item.quantity,
        size: item.size,
        slug: item.products?.slug || ''
      }));
    } catch {
      return [];
    }
  },

  /**
   * Get guest cart items with product details
   */
  async getGuestItems() {
    const cart = this.getGuestCart();
    if (cart.length === 0) return [];

    // Fetch product details for each item
    const items = [];
    for (const item of cart) {
      try {
        const response = await fetch(`/api/products/detail?id=${item.product_id}`);
        if (response.ok) {
          const data = await response.json();
          if (data.data) {
            items.push({
              id: item.product_id,
              product_id: item.product_id,
              product_name: data.data.name,
              product_image: data.data.image_url,
              price_usd: data.data.price_usd,
              quantity: item.quantity,
              size: item.size,
              slug: data.data.slug
            });
          }
        }
      } catch {
        // Skip if product not found
      }
    }

    return items;
  },

  /**
   * Update item quantity
   */
  async updateItem(itemId, quantity) {
    if (Auth.isAuthenticated()) {
      return this.updateServerItem(itemId, quantity);
    } else {
      return this.updateGuestItem(itemId, quantity);
    }
  },

  /**
   * Update server cart item
   */
  async updateServerItem(itemId, quantity) {
    try {
      const response = await Auth.authenticatedFetch('/api/cart/update', {
        method: 'PUT',
        body: JSON.stringify({ item_id: itemId, quantity })
      });

      if (!response) return { success: false };

      const data = await response.json();
      this.updateBadge();
      return { success: response.ok, error: data.error };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Update guest cart item
   */
  updateGuestItem(productId, quantity) {
    const cart = this.getGuestCart();
    const index = cart.findIndex(item => item.product_id === productId);

    if (index >= 0) {
      if (quantity <= 0) {
        cart.splice(index, 1);
      } else {
        cart[index].quantity = quantity;
      }
      this.saveGuestCart(cart);
      return { success: true };
    }

    return { success: false, error: 'Item not found' };
  },

  /**
   * Remove item from cart
   */
  async removeItem(itemId) {
    if (Auth.isAuthenticated()) {
      return this.removeServerItem(itemId);
    } else {
      return this.removeGuestItem(itemId);
    }
  },

  /**
   * Remove server cart item
   */
  async removeServerItem(itemId) {
    try {
      const response = await Auth.authenticatedFetch('/api/cart/remove', {
        method: 'DELETE',
        body: JSON.stringify({ item_id: itemId })
      });

      if (!response) return { success: false };

      const data = await response.json();
      this.updateBadge();
      return { success: response.ok, error: data.error };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Remove guest cart item
   */
  removeGuestItem(productId) {
    const cart = this.getGuestCart();
    const index = cart.findIndex(item => item.product_id === productId);

    if (index >= 0) {
      cart.splice(index, 1);
      this.saveGuestCart(cart);
      return { success: true };
    }

    return { success: false, error: 'Item not found' };
  },

  /**
   * Get cart count
   */
  async getCount() {
    if (Auth.isAuthenticated()) {
      const items = await this.getServerItems();
      return items.reduce((sum, item) => sum + item.quantity, 0);
    } else {
      const cart = this.getGuestCart();
      return cart.reduce((sum, item) => sum + item.quantity, 0);
    }
  },

  /**
   * Update cart badge in UI
   */
  async updateBadge() {
    const badge = document.querySelector('.cart-count');
    if (!badge) return;

    const count = await this.getCount();
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
  },

  /**
   * Merge guest cart into server cart (after login)
   */
  async mergeGuestCart() {
    const guestCart = this.getGuestCart();
    if (guestCart.length === 0) return;

    for (const item of guestCart) {
      await this.addServerItem(item.product_id, item.quantity, item.size);
    }

    // Clear guest cart
    localStorage.removeItem('moow_guest_cart');
    this.updateBadge();
  },

  /**
   * Calculate cart totals
   */
  calculateTotals(items, currency = 'USD') {
    const subtotal = items.reduce((sum, item) => sum + (item.price_usd * item.quantity), 0);
    
    // Free shipping over $100
    const shipping = subtotal >= 100 ? 0 : 4.99;
    
    // Tax (simplified)
    const tax = Math.round(subtotal * 0.08 * 100) / 100;
    
    const total = subtotal + shipping + tax;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      shipping,
      tax,
      total: Math.round(total * 100) / 100,
      currency
    };
  }
};

// Update badge on page load
document.addEventListener('DOMContentLoaded', () => {
  Cart.updateBadge();
});
