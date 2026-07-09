/**
 * Moow.Hub - Checkout Module
 * Handles checkout flow, payment processing, and order creation
 */

const Checkout = {
  currentStep: 1,
  shippingData: null,
  paymentMethod: null,
  currency: 'USD',
  cartItems: [],
  totals: null,
  orderResult: null,
  razorpayInstance: null,

  /**
   * Initialize checkout
   */
  async init() {
    if (!Auth.isAuthenticated()) {
      window.location.href = '/pages/login.html?redirect=/pages/checkout.html';
      return false;
    }

    this.cartItems = await Cart.getItems();
    if (this.cartItems.length === 0) {
      window.location.href = '/pages/cart.html';
      return false;
    }

    this.currency = localStorage.getItem('moow_currency') || 'USD';
    this.totals = Cart.calculateTotals(this.cartItems, this.currency);
    
    this.renderSummary();
    this.initCurrencySelector();
    this.loadSavedAddresses();
    
    return true;
  },

  /**
   * Initialize currency selector
   */
  initCurrencySelector() {
    const selector = document.getElementById('currencySelect');
    if (selector) {
      selector.value = this.currency;
      selector.addEventListener('change', (e) => {
        this.currency = e.target.value;
        localStorage.setItem('moow_currency', this.currency);
        this.updateTotals();
      });
    }
  },

  /**
   * Update totals when currency changes
   */
  async updateTotals() {
    const rates = await this.getExchangeRates();
    const convertedTotals = { ...this.totals };
    
    if (this.currency !== 'USD' && rates[this.currency]) {
      const rate = rates[this.currency];
      convertedTotals.subtotal = Math.round(this.totals.subtotal * rate * 100) / 100;
      convertedTotals.shipping = Math.round(this.totals.shipping * rate * 100) / 100;
      convertedTotals.tax = Math.round(this.totals.tax * rate * 100) / 100;
      convertedTotals.total = Math.round(this.totals.total * rate * 100) / 100;
    }

    this.totals = convertedTotals;
    this.renderSummary();
  },

  /**
   * Get exchange rates
   */
  async getExchangeRates() {
    try {
      const response = await fetch('/api/currency/rates');
      if (!response.ok) return {};
      const data = await response.json();
      return data.rates || {};
    } catch {
      return {};
    }
  },

  /**
   * Get currency symbol
   */
  getCurrencySymbol() {
    const symbols = { USD: '$', INR: '₹', EUR: '€', GBP: '£', AED: 'د.إ', SGD: 'S$' };
    return symbols[this.currency] || '$';
  },

  /**
   * Render order summary
   */
  renderSummary() {
    const symbol = this.getCurrencySymbol();
    
    document.getElementById('summaryItems').innerHTML = this.cartItems.map(item => `
      <div class="summary-item">
        <img src="../${item.product_image}" alt="${item.product_name}" class="summary-item-img">
        <div class="summary-item-info">
          <div class="summary-item-name">${item.product_name}</div>
          ${item.size ? `<div class="summary-item-size">${item.size}</div>` : ''}
          <div class="summary-item-qty">Qty: ${item.quantity}</div>
        </div>
        <div class="summary-item-price">${symbol}${(item.price_usd * item.quantity).toFixed(2)}</div>
      </div>
    `).join('');

    document.getElementById('summarySubtotal').textContent = `${symbol}${this.totals.subtotal.toFixed(2)}`;
    document.getElementById('summaryShipping').textContent = this.totals.shipping === 0 ? 'Free' : `${symbol}${this.totals.shipping.toFixed(2)}`;
    document.getElementById('summaryTax').textContent = `${symbol}${this.totals.tax.toFixed(2)}`;
    document.getElementById('summaryTotal').textContent = `${symbol}${this.totals.total.toFixed(2)}`;
  },

  /**
   * Load saved addresses from user profile
   */
  async loadSavedAddresses() {
    const user = Auth.getUser();
    if (!user) return;

    try {
      const response = await Auth.authenticatedFetch('/api/auth/user');
      if (!response || !response.ok) return;
      
      const data = await response.json();
      if (data.data?.addresses?.length > 0) {
        this.renderSavedAddresses(data.data.addresses);
      }
    } catch {}
  },

  /**
   * Render saved addresses
   */
  renderSavedAddresses(addresses) {
    const container = document.getElementById('savedAddresses');
    if (!container || addresses.length === 0) return;

    container.innerHTML = `
      <h4>Saved Addresses</h4>
      <div class="saved-addresses">
        ${addresses.map((addr, i) => `
          <div class="saved-address" onclick="Checkout.selectAddress(${i})">
            <input type="radio" name="saved_address" id="addr_${i}" ${i === 0 ? 'checked' : ''}>
            <label for="addr_${i}">
              <strong>${addr.full_name}</strong><br>
              ${addr.line1}<br>
              ${addr.line2 ? addr.line2 + '<br>' : ''}
              ${addr.city}, ${addr.state} ${addr.postal_code}<br>
              ${addr.country}
            </label>
          </div>
        `).join('')}
      </div>
      <button class="btn btn-outline" onclick="Checkout.showNewAddressForm()" style="margin-top:1rem;">
        Use New Address
      </button>
    `;

    // Auto-select first address
    if (addresses.length > 0) {
      this.shippingData = addresses[0];
    }
  },

  /**
   * Select saved address
   */
  selectAddress(index) {
    const user = Auth.getUser();
    // This would need to store addresses - simplified for now
    document.querySelectorAll('.saved-address').forEach((el, i) => {
      el.classList.toggle('selected', i === index);
    });
  },

  /**
   * Show new address form
   */
  showNewAddressForm() {
    document.getElementById('savedAddressesSection').style.display = 'none';
    document.getElementById('newAddressForm').style.display = 'block';
  },

  /**
   * Proceed to step 2 (payment)
   */
  goToStep2() {
    if (!this.validateStep1()) return;
    this.currentStep = 2;
    this.updateSteps();
    this.renderPaymentMethods();
    window.scrollTo(0, 0);
  },

  /**
   * Validate step 1 (shipping address)
   */
  validateStep1() {
    const form = document.getElementById('shippingForm');
    if (!form) return true;

    const required = ['fullName', 'address', 'city', 'state', 'postalCode', 'phone'];
    let valid = true;

    required.forEach(field => {
      const input = document.getElementById(field);
      if (input && !input.value.trim()) {
        input.classList.add('error');
        valid = false;
      } else if (input) {
        input.classList.remove('error');
      }
    });

    if (!valid) {
      alert('Please fill in all required fields');
      return false;
    }

    // Store shipping data
    this.shippingData = {
      full_name: document.getElementById('fullName').value,
      line1: document.getElementById('address').value,
      line2: document.getElementById('address2')?.value || '',
      city: document.getElementById('city').value,
      state: document.getElementById('state').value,
      postal_code: document.getElementById('postalCode').value,
      country: document.getElementById('country').value,
      phone: document.getElementById('phone').value
    };

    return true;
  },

  /**
   * Render payment methods based on currency
   */
  renderPaymentMethods() {
    const isINR = this.currency === 'INR';
    const container = document.getElementById('paymentMethods');
    
    if (isINR) {
      container.innerHTML = `
        <div class="payment-method selected" onclick="Checkout.selectPayment('upi')">
          <input type="radio" name="payment" id="upi" checked>
          <label for="upi">
            <span class="payment-icon">📱</span>
            <span class="payment-name">UPI</span>
            <span class="payment-desc">Google Pay, PhonePe, Paytm, etc.</span>
          </label>
        </div>
        <div class="payment-method" onclick="Checkout.selectPayment('card')">
          <input type="radio" name="payment" id="card">
          <label for="card">
            <span class="payment-icon">💳</span>
            <span class="payment-name">Credit/Debit Card</span>
            <span class="payment-desc">Visa, Mastercard, RuPay</span>
          </label>
        </div>
        <div class="payment-method" onclick="Checkout.selectPayment('netbanking')">
          <input type="radio" name="payment" id="netbanking">
          <label for="netbanking">
            <span class="payment-icon">🏦</span>
            <span class="payment-name">Net Banking</span>
            <span class="payment-desc">All major banks</span>
          </label>
        </div>
        <div class="payment-method" onclick="Checkout.selectPayment('cod')">
          <input type="radio" name="payment" id="cod">
          <label for="cod">
            <span class="payment-icon">💵</span>
            <span class="payment-name">Cash on Delivery</span>
            <span class="payment-desc">Pay when you receive</span>
          </label>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="payment-method selected" onclick="Checkout.selectPayment('card')">
          <input type="radio" name="payment" id="card" checked>
          <label for="card">
            <span class="payment-icon">💳</span>
            <span class="payment-name">Credit/Debit Card</span>
            <span class="payment-desc">Visa, Mastercard, AMEX</span>
          </label>
        </div>
      `;
    }

    this.paymentMethod = isINR ? 'upi' : 'card';
  },

  /**
   * Select payment method
   */
  selectPayment(method) {
    this.paymentMethod = method;
    document.querySelectorAll('.payment-method').forEach(el => {
      el.classList.remove('selected');
    });
    event.currentTarget.classList.add('selected');
    
    // Show/hide UPI ID field
    const upiField = document.getElementById('upiIdField');
    if (upiField) {
      upiField.style.display = method === 'upi' ? 'block' : 'none';
    }
  },

  /**
   * Proceed to step 3 (review)
   */
  goToStep3() {
    if (!this.paymentMethod) {
      alert('Please select a payment method');
      return;
    }
    
    this.currentStep = 3;
    this.updateSteps();
    this.renderReview();
    window.scrollTo(0, 0);
  },

  /**
   * Render order review
   */
  renderReview() {
    const symbol = this.getCurrencySymbol();
    const shipping = this.shippingData;

    document.getElementById('reviewAddress').innerHTML = `
      <strong>${shipping.full_name}</strong><br>
      ${shipping.line1}<br>
      ${shipping.line2 ? shipping.line2 + '<br>' : ''}
      ${shipping.city}, ${shipping.state} ${shipping.postal_code}<br>
      ${shipping.country}<br>
      Phone: ${shipping.phone}
    `;

    const paymentNames = {
      upi: 'UPI',
      card: 'Credit/Debit Card',
      netbanking: 'Net Banking',
      cod: 'Cash on Delivery'
    };
    document.getElementById('reviewPayment').textContent = paymentNames[this.paymentMethod] || this.paymentMethod;

    document.getElementById('reviewTotal').textContent = `${symbol}${this.totals.total.toFixed(2)}`;
  },

  /**
   * Update step indicators
   */
  updateSteps() {
    document.querySelectorAll('.step').forEach((step, i) => {
      const stepNum = i + 1;
      step.classList.remove('active', 'completed');
      if (stepNum === this.currentStep) {
        step.classList.add('active');
      } else if (stepNum < this.currentStep) {
        step.classList.add('completed');
      }
    });

    document.querySelectorAll('.checkout-step').forEach((step, i) => {
      step.style.display = (i + 1) === this.currentStep ? 'block' : 'none';
    });
  },

  /**
   * Place order
   */
  async placeOrder() {
    const btn = document.getElementById('placeOrderBtn');
    btn.disabled = true;
    btn.textContent = 'Processing...';

    try {
      // Handle COD separately
      if (this.paymentMethod === 'cod') {
        await this.placeCODOrder();
        return;
      }

      // Create order on server
      const response = await Auth.authenticatedFetch('/api/checkout/create-order', {
        method: 'POST',
        body: JSON.stringify({
          shipping_address: this.shippingData,
          currency: this.currency,
          payment_method: this.paymentMethod
        })
      });

      if (!response) {
        throw new Error('Failed to create order');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create order');
      }

      this.orderResult = data.data;

      // Process payment based on gateway
      if (data.data.payment.gateway === 'razorpay') {
        await this.processRazorpayPayment(data.data);
      } else if (data.data.payment.gateway === 'stripe') {
        await this.processStripePayment(data.data);
      }

    } catch (error) {
      alert('Error: ' + error.message);
      btn.disabled = false;
      btn.textContent = 'Place Order';
    }
  },

  /**
   * Process Razorpay payment
   */
  async processRazorpayPayment(orderData) {
    const { payment } = orderData;

    const options = {
      key: payment.razorpay_key,
      amount: Math.round(orderData.total * 100),
      currency: 'INR',
      name: 'Moow.Hub',
      description: `Order ${orderData.order_number}`,
      order_id: payment.razorpay_order_id,
      handler: async (response) => {
        // Verify payment
        await this.verifyPayment({
          gateway: 'razorpay',
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
          order_id: orderData.order_id
        });
      },
      prefill: {
        name: this.shippingData.full_name,
        contact: this.shippingData.phone
      },
      theme: {
        color: '#d4735e'
      },
      modal: {
        ondismiss: () => {
          document.getElementById('placeOrderBtn').disabled = false;
          document.getElementById('placeOrderBtn').textContent = 'Place Order';
        }
      }
    };

    this.razorpayInstance = new Razorpay(options);
    this.razorpayInstance.open();
  },

  /**
   * Process Stripe payment
   */
  async processStripePayment(orderData) {
    const { payment } = orderData;

    const stripe = Stripe(payment.stripe_publishable_key);
    const { error } = await stripe.confirmCardPayment(payment.stripe_client_secret, {
      payment_method: {
        card: {
          // Card details would be collected via Stripe Elements
          // This is simplified - real implementation uses Stripe Elements
        },
        billing_details: {
          name: this.shippingData.full_name
        }
      }
    });

    if (error) {
      throw new Error(error.message);
    }

    // Payment successful - server webhook will confirm
    this.showSuccess(orderData);
  },

  /**
   * Place COD order
   */
  async placeCODOrder() {
    // Send OTP for COD verification
    const response = await Auth.authenticatedFetch('/api/checkout/cod-send-otp', {
      method: 'POST',
      body: JSON.stringify({
        shipping_address: this.shippingData,
        currency: this.currency
      })
    });

    if (!response) {
      throw new Error('Failed to initiate COD order');
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to initiate COD order');
    }

    // Show OTP verification modal
    this.showOTPModal(data.otp_session_id);
  },

  /**
   * Show OTP verification modal
   */
  showOTPModal(sessionId) {
    const modal = document.getElementById('otpModal');
    modal.style.display = 'flex';
    
    document.getElementById('verifyOtpBtn').onclick = async () => {
      const otp = document.getElementById('otpInput').value;
      
      const response = await Auth.authenticatedFetch('/api/checkout/cod-verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          session_id: sessionId,
          otp: otp
        })
      });

      if (!response) {
        alert('Verification failed');
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Invalid OTP');
        return;
      }

      modal.style.display = 'none';
      this.showSuccess(data.data);
    };
  },

  /**
   * Show success page
   */
  showSuccess(orderData) {
    document.getElementById('successOrderNumber').textContent = orderData.order_number;
    document.getElementById('successTotal').textContent = `${this.getCurrencySymbol()}${orderData.total.toFixed(2)}`;
    
    // Clear guest cart
    localStorage.removeItem('moow_guest_cart');
    
    // Hide checkout steps, show success
    document.getElementById('checkoutSteps').style.display = 'none';
    document.getElementById('checkoutSuccess').style.display = 'block';
    
    window.scrollTo(0, 0);
  },

  /**
   * Verify payment with server
   */
  async verifyPayment(paymentData) {
    try {
      const response = await Auth.authenticatedFetch('/api/checkout/verify-payment', {
        method: 'POST',
        body: JSON.stringify(paymentData)
      });

      if (!response) {
        throw new Error('Verification failed');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Payment verification failed');
      }

      this.showSuccess(data.data);
    } catch (error) {
      alert('Payment verification failed: ' + error.message);
      window.location.href = '/pages/orders.html';
    }
  }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  const success = await Checkout.init();
  if (success) {
    Checkout.updateSteps();
  }
});
