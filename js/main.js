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

  // --- Cart Functionality ---
  let cartCount = 0;
  const cartBadge = document.querySelector('.cart-count');

  document.querySelectorAll('.btn-add-cart').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      cartCount++;
      if (cartBadge) {
        cartBadge.textContent = cartCount;
        cartBadge.style.display = 'inline-flex';
      }

      const originalText = btn.textContent;
      btn.textContent = 'Added!';
      btn.style.background = 'var(--primary)';
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
      }, 1500);
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
});
