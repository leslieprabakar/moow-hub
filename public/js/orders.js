/**
 * Moow.Hub - Orders Module
 * Handles order history, details, and cancellation
 */

const Orders = {
  currentPage: 1,
  currentFilter: '',
  pagination: null,

  /**
   * Load user's orders
   */
  async loadOrders(page = 1, status = '') {
    this.currentPage = page;
    this.currentFilter = status;

    const loading = document.getElementById('ordersLoading');
    const empty = document.getElementById('ordersEmpty');
    const list = document.getElementById('ordersList');

    if (loading) loading.style.display = 'block';
    if (empty) empty.style.display = 'none';
    if (list) list.style.display = 'none';

    try {
      const params = new URLSearchParams({ page, limit: 10 });
      if (status) params.append('status', status);

      const response = await Auth.authenticatedFetch(`/api/orders/list?${params}`);
      
      if (!response || !response.ok) {
        throw new Error('Failed to load orders');
      }

      const data = await response.json();
      
      if (loading) loading.style.display = 'none';

      if (!data.data || data.data.length === 0) {
        if (empty) empty.style.display = 'block';
        return;
      }

      this.pagination = data.pagination;
      this.renderOrders(data.data);
      
      if (list) list.style.display = 'flex';
      this.renderPagination(data.pagination);

    } catch (error) {
      if (loading) loading.textContent = 'Failed to load orders';
    }
  },

  /**
   * Render orders list
   */
  renderOrders(orders) {
    const container = document.getElementById('ordersList');
    if (!container) return;

    container.innerHTML = orders.map(order => {
      const shipping = typeof order.shipping_address === 'string' 
        ? JSON.parse(order.shipping_address) 
        : order.shipping_address;
      
      const date = new Date(order.created_at).toLocaleString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
      });

      const statusClass = this.getStatusClass(order.status);
      const canCancel = this.canCancel(order);
      const items = order.order_items || [];
      const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

      return `
        <div class="order-card">
          <div class="order-header">
            <div>
              <div class="order-number">${order.order_number}</div>
              <div class="order-date">${date}</div>
            </div>
            <span class="order-status ${statusClass}">${this.formatStatus(order.status)}</span>
          </div>
          <div class="order-items-preview">
            ${items.slice(0, 3).map(item => `
              <img src="../${item.product_image}" alt="${item.product_name}" class="order-item-thumb" title="${item.product_name}">
            `).join('')}
            ${items.length > 3 ? `<span class="order-item-more">+${items.length - 3}</span>` : ''}
          </div>
          <div class="order-footer">
            <div class="order-total">
              ${itemCount} ${itemCount === 1 ? 'item' : 'items'} · ${order.currency || 'USD'} ${Number(order.total).toFixed(2)}
            </div>
            <div class="order-actions">
              ${canCancel ? `<button class="btn btn-outline btn-sm" onclick="Orders.cancelOrder('${order.id}', '${order.order_number}')">Cancel</button>` : ''}
              <a href="order-detail.html?id=${order.id}" class="btn btn-primary btn-sm">View Details</a>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  /**
   * Get status CSS class
   */
  getStatusClass(status) {
    const classes = {
      pending: 'status-pending',
      confirmed: 'status-confirmed',
      processing: 'status-processing',
      shipped: 'status-shipped',
      delivered: 'status-delivered',
      cancelled: 'status-cancelled'
    };
    return classes[status] || '';
  },

  /**
   * Format status text
   */
  formatStatus(status) {
    return status.charAt(0).toUpperCase() + status.slice(1);
  },

  /**
   * Check if order can be cancelled
   */
  canCancel(order) {
    const allowedStatuses = ['pending', 'confirmed', 'processing'];
    if (!allowedStatuses.includes(order.status)) return false;

    const orderDate = new Date(order.created_at);
    const now = new Date();
    const hoursSinceOrder = (now - orderDate) / (1000 * 60 * 60);
    return hoursSinceOrder <= 24;
  },

  /**
   * Cancel an order
   */
  async cancelOrder(orderId, orderNumber) {
    if (!confirm(`Are you sure you want to cancel order ${orderNumber}?`)) {
      return;
    }

    const reason = prompt('Please provide a reason for cancellation (optional):');

    try {
      const response = await Auth.authenticatedFetch('/api/orders/cancel', {
        method: 'POST',
        body: JSON.stringify({
          order_id: orderId,
          reason: reason || undefined
        })
      });

      if (!response) {
        alert('Failed to cancel order');
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Failed to cancel order');
        return;
      }

      alert('Order cancelled successfully');
      this.loadOrders(this.currentPage, this.currentFilter);

    } catch (error) {
      alert('Failed to cancel order');
    }
  },

  /**
   * Render pagination
   */
  renderPagination(pagination) {
    const container = document.getElementById('pagination');
    if (!container || pagination.pages <= 1) {
      if (container) container.innerHTML = '';
      return;
    }

    let html = '';
    
    if (pagination.page > 1) {
      html += `<button class="pagination-btn" onclick="Orders.loadOrders(${pagination.page - 1}, '${this.currentFilter}')">← Previous</button>`;
    }

    html += `<span class="pagination-info">Page ${pagination.page} of ${pagination.pages}</span>`;

    if (pagination.page < pagination.pages) {
      html += `<button class="pagination-btn" onclick="Orders.loadOrders(${pagination.page + 1}, '${this.currentFilter}')">Next →</button>`;
    }

    container.innerHTML = html;
  },

  /**
   * Filter orders by status
   */
  filterByStatus(status) {
    this.currentFilter = status;
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.status === status);
    });

    this.loadOrders(1, status);
  },

  /**
   * Load single order detail
   */
  async loadOrderDetail(orderId) {
    const loading = document.getElementById('detailLoading');
    const content = document.getElementById('detailContent');

    if (loading) loading.style.display = 'block';
    if (content) content.style.display = 'none';

    try {
      const response = await Auth.authenticatedFetch(`/api/orders/detail?id=${orderId}`);
      
      if (!response || !response.ok) {
        throw new Error('Order not found');
      }

      const data = await response.json();
      
      if (loading) loading.style.display = 'none';
      if (content) content.style.display = 'block';

      this.renderOrderDetail(data.data);
      this.loadTracking(orderId);

    } catch (error) {
      if (loading) loading.textContent = 'Failed to load order details';
    }
  },

  /**
   * Render order detail
   */
  renderOrderDetail(order) {
    const shipping = typeof order.shipping_address === 'string' 
      ? JSON.parse(order.shipping_address) 
      : order.shipping_address;

    const date = new Date(order.created_at).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    document.getElementById('detailOrderNumber').textContent = order.order_number;
    document.getElementById('detailStatus').textContent = this.formatStatus(order.status);
    document.getElementById('detailStatus').className = `order-status ${this.getStatusClass(order.status)}`;
    document.getElementById('detailDate').textContent = date;

    // Shipping address
    document.getElementById('detailAddress').innerHTML = `
      <strong>${shipping.full_name}</strong><br>
      ${shipping.line1}<br>
      ${shipping.line2 ? shipping.line2 + '<br>' : ''}
      ${shipping.city}, ${shipping.state} ${shipping.postal_code}<br>
      ${shipping.country}<br>
      Phone: ${shipping.phone}
    `;

    // Order items
    const items = order.order_items || [];
    document.getElementById('detailItems').innerHTML = items.map(item => `
      <div class="detail-item">
        <img src="../${item.product_image}" alt="${item.product_name}" class="detail-item-img">
        <div class="detail-item-info">
          <div class="detail-item-name">${item.product_name}</div>
          ${item.size ? `<div class="detail-item-size">Size: ${item.size}</div>` : ''}
          <div class="detail-item-qty">Qty: ${item.quantity} × ${order.currency || 'USD'} ${Number(item.unit_price).toFixed(2)}</div>
        </div>
        <div class="detail-item-total">${order.currency || 'USD'} ${Number(item.total_price).toFixed(2)}</div>
      </div>
    `).join('');

    // Totals
    document.getElementById('detailSubtotal').textContent = `${order.currency || 'USD'} ${Number(order.subtotal).toFixed(2)}`;
    document.getElementById('detailShipping').textContent = order.shipping_cost === 0 ? 'Free' : `${order.currency || 'USD'} ${Number(order.shipping_cost).toFixed(2)}`;
    document.getElementById('detailTax').textContent = `${order.currency || 'USD'} ${Number(order.tax).toFixed(2)}`;
    document.getElementById('detailTotal').textContent = `${order.currency || 'USD'} ${Number(order.total).toFixed(2)}`;

    // Payment info
    document.getElementById('detailPayment').innerHTML = `
      <div><strong>Method:</strong> ${this.formatPaymentMethod(order.payment_method)}</div>
      <div><strong>Status:</strong> ${this.formatPaymentStatus(order.payment_status)}</div>
    `;

    // Cancel button
    const cancelBtn = document.getElementById('detailCancelBtn');
    if (cancelBtn) {
      if (this.canCancel(order)) {
        cancelBtn.style.display = 'inline-block';
        cancelBtn.onclick = () => this.cancelOrder(order.id, order.order_number);
      } else {
        cancelBtn.style.display = 'none';
      }
    }
  },

  /**
   * Load tracking info
   */
  async loadTracking(orderId) {
    try {
      const response = await Auth.authenticatedFetch(`/api/orders/track?id=${orderId}`);
      if (!response || !response.ok) return;

      const data = await response.json();
      this.renderTracking(data.data.timeline);
    } catch {}
  },

  /**
   * Render tracking timeline
   */
  renderTracking(timeline) {
    const container = document.getElementById('trackingTimeline');
    if (!container || !timeline || timeline.length === 0) return;

    container.innerHTML = `
      <div class="tracking-timeline">
        ${timeline.map(step => `
          <div class="tracking-step ${step.completed ? 'completed' : ''}">
            <div class="tracking-dot"></div>
            <div class="tracking-content">
              <div class="tracking-status">${step.status}</div>
              ${step.date ? `<div class="tracking-date">${new Date(step.date).toLocaleDateString()}</div>` : ''}
              ${step.description ? `<div class="tracking-desc">${step.description}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  /**
   * Format payment method
   */
  formatPaymentMethod(method) {
    const methods = {
      upi: 'UPI',
      card: 'Credit/Debit Card',
      netbanking: 'Net Banking',
      cod: 'Cash on Delivery',
      stripe: 'Credit/Debit Card'
    };
    return methods[method] || method;
  },

  /**
   * Format payment status
   */
  formatPaymentStatus(status) {
    const statuses = {
      pending: 'Pending',
      paid: 'Paid',
      failed: 'Failed',
      refunded: 'Refunded',
      refund_pending: 'Refund Pending'
    };
    return statuses[status] || status;
  }
};
