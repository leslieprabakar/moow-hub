/* ===== MOOW.HUB — Main JavaScript ===== */

document.addEventListener('DOMContentLoaded', () => {
  // --- Navbar Scroll Effect ---
  const navbar = document.querySelector('.navbar');
  const handleScroll = () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  };
  window.addEventListener('scroll', handleScroll);
  handleScroll();

  // --- Mobile Menu Toggle ---
  const menuToggle = document.querySelector('.menu-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (menuToggle) {
    menuToggle.addEventListener('click', () => {
      menuToggle.classList.toggle('active');
      navLinks.classList.toggle('active');
      document.body.style.overflow = navLinks.classList.contains('active') ? 'hidden' : '';
    });

    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        menuToggle.classList.remove('active');
        navLinks.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
  }

  // --- Hero Cube Transition ---
  const cubeSlider = document.querySelector('.cube-slider');
  if (cubeSlider) {
    const faces = cubeSlider.querySelectorAll('.cube-face');
    if (faces.length > 1) {
      let current = 0;
      setInterval(() => {
        const prev = current;
        current = (current + 1) % faces.length;
        faces[prev].classList.remove('cube-active');
        faces[prev].classList.add('cube-exit-left');
        faces[current].classList.add('cube-active');
        setTimeout(() => {
          faces[prev].classList.remove('cube-exit-left');
        }, 1500);
      }, 5000);
    }
  }

  // --- Scroll Reveal Animation ---
  const revealElements = document.querySelectorAll('.reveal');

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
  });

  revealElements.forEach(el => revealObserver.observe(el));

  // --- Active Nav Link ---
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });

  // --- Counter Animation ---
  const counters = document.querySelectorAll('.stat-number');

  const animateCounter = (el) => {
    const target = parseInt(el.getAttribute('data-count'));
    const suffix = el.getAttribute('data-suffix') || '';
    const duration = 2000;
    const increment = target / (duration / 16);
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        current = target;
        clearInterval(timer);
      }
      el.textContent = Math.floor(current) + suffix;
    }, 16);
  };

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !entry.target.classList.contains('counted')) {
        entry.target.classList.add('counted');
        animateCounter(entry.target);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(counter => counterObserver.observe(counter));

  // --- Smooth Scroll for Anchor Links ---
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // --- Cart Functionality (integrated with Cart module) ---
  document.querySelectorAll('.btn-add-cart').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const productId = btn.getAttribute('data-product-id');
      if (!productId) return;

      const originalText = btn.textContent;
      btn.textContent = 'Adding...';
      btn.disabled = true;

      try {
        await Cart.addItem(productId, 1);
        btn.textContent = 'Added!';
        btn.style.background = 'var(--primary)';
        
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.background = '';
          btn.disabled = false;
        }, 1500);
      } catch (error) {
        btn.textContent = 'Error';
        setTimeout(() => {
          btn.textContent = originalText;
          btn.disabled = false;
        }, 1500);
      }
    });
  });

  // --- Form Validation ---
  const contactForm = document.querySelector('#contactForm');
  if (contactForm) {
    const errorMessages = {
      firstName: 'Please enter your first name (at least 2 characters).',
      lastName: 'Please enter your last name (at least 2 characters).',
      email: 'Please enter a valid email address.',
      phone: 'Please enter a valid phone number (7-20 digits, may include +, spaces, dashes, parentheses).',
      organisation: 'Please enter your organisation name (at least 2 characters).',
      location: 'Please enter your location (at least 2 characters).',
      quantity: 'Estimated quantity cannot exceed 50 characters.',
      type: 'Please select your organisation type.',
      vision: 'Please tell us about your vision (at least 10 characters).'
    };

    const validateField = (field) => {
      const formGroup = field.closest('.form-group');
      const errorEl = formGroup.querySelector('.error-message');
      let message = '';

      if (!field.checkValidity()) {
        if (field.validity.valueMissing) {
          message = errorMessages[field.name] || 'This field is required.';
        } else if (field.validity.typeMismatch) {
          message = errorMessages[field.name] || 'Please enter a valid value.';
        } else if (field.validity.patternMismatch) {
          message = errorMessages[field.name] || 'Please match the required format.';
        } else if (field.validity.tooShort) {
          message = `Minimum ${field.minLength} characters required.`;
        } else if (field.validity.tooLong) {
          message = `Maximum ${field.maxLength} characters allowed.`;
        } else {
          message = errorMessages[field.name] || 'Please fill out this field correctly.';
        }
        formGroup.classList.add('error');
        formGroup.classList.remove('success');
        if (errorEl) errorEl.textContent = message;
      } else {
        formGroup.classList.remove('error');
        formGroup.classList.add('success');
        if (errorEl) errorEl.textContent = '';
      }

      return field.checkValidity();
    };

    contactForm.querySelectorAll('input, textarea, select').forEach(field => {
      field.addEventListener('blur', () => validateField(field));
      field.addEventListener('input', () => {
        const formGroup = field.closest('.form-group');
        if (formGroup.classList.contains('error')) {
          validateField(field);
        }
      });
    });

    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();

      let allValid = true;
      contactForm.querySelectorAll('input, textarea, select').forEach(field => {
        if (!validateField(field)) {
          allValid = false;
        }
      });

      if (!allValid) {
        const firstError = contactForm.querySelector('.form-group.error');
        if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = 'Sending...';
      submitBtn.disabled = true;

      setTimeout(() => {
        submitBtn.innerHTML = 'Message Sent!';
        submitBtn.style.background = '#2a7a4f';

        setTimeout(() => {
          submitBtn.innerHTML = originalText;
          submitBtn.style.background = '';
          submitBtn.disabled = false;
          contactForm.reset();
          contactForm.querySelectorAll('.form-group').forEach(g => {
            g.classList.remove('error', 'success');
            const err = g.querySelector('.error-message');
            if (err) err.textContent = '';
          });
        }, 2000);
      }, 1500);
    });
  }

  // --- Back to Top ---
  const backToTop = document.querySelector('.back-to-top');
  if (backToTop) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 500) {
        backToTop.classList.add('visible');
      } else {
        backToTop.classList.remove('visible');
      }
    });

    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // --- Initialize Auth and Cart ---
  if (typeof Auth !== 'undefined') {
    Auth.init();
  }
  if (typeof Cart !== 'undefined') {
    Cart.updateBadge();
  }
});

// --- Utility Functions ---
function formatCurrency(amount, currency = 'USD') {
  const symbols = { USD: '$', INR: '₹', EUR: '€', GBP: '£', AED: 'د.إ', SGD: 'S$' };
  return `${symbols[currency] || '$'}${Number(amount).toFixed(2)}`;
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    padding: 1rem 1.5rem;
    background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    z-index: 9999;
    animation: slideIn 0.3s ease;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}
