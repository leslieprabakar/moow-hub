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
      const isOpen = navLinks.classList.contains('active');
      document.body.style.overflow = isOpen ? 'hidden' : '';
      menuToggle.setAttribute('aria-expanded', isOpen);
    });

    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', (e) => {
        if (link.closest('.nav-dropdown')) return;
        menuToggle.classList.remove('active');
        navLinks.classList.remove('active');
        document.body.style.overflow = '';
        const href = link.getAttribute('href');
        if (href && !href.startsWith('#') && !link.getAttribute('target') && !e.metaKey && !e.ctrlKey && e.button === 0) {
          e.preventDefault();
          window.location.href = href;
        }
      });
    });
  }

  // --- Nav Dropdown ---
  document.querySelectorAll('.nav-dropdown-trigger').forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const dropdown = trigger.closest('.nav-dropdown');
      const isOpen = dropdown.classList.contains('open');

      document.querySelectorAll('.nav-dropdown.open').forEach(d => {
        if (d !== dropdown) d.classList.remove('open');
      });

      dropdown.classList.toggle('open');
      trigger.setAttribute('aria-expanded', !isOpen);
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-dropdown')) {
      document.querySelectorAll('.nav-dropdown.open').forEach(d => {
        d.classList.remove('open');
        const t = d.querySelector('.nav-dropdown-trigger');
        if (t) t.setAttribute('aria-expanded', 'false');
      });
    }
  });

  // --- Hero Cube Transition ---
  const cubeSlider = document.querySelector('.cube-slider');
  if (cubeSlider) {
    const faces = cubeSlider.querySelectorAll('.cube-face');
    if (faces.length > 1) {
      let current = 0;
      setInterval(() => {
        faces[current].classList.remove('cube-active');
        current = (current + 1) % faces.length;
        faces[current].classList.add('cube-active');
      }, 2500);
    }
  }

  // --- Ecosystem QR Transition ---
  const ecoSlider = document.querySelector('.eco-slider');
  if (ecoSlider) {
    const faces = ecoSlider.querySelectorAll('.eco-face');
    if (faces.length > 1) {
      let current = 0;
      setInterval(() => {
        faces[current].classList.remove('eco-active');
        current = (current + 1) % faces.length;
        faces[current].classList.add('eco-active');
      }, 2500);
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
      let productId = btn.getAttribute('data-product-id');
      const slug = btn.getAttribute('data-product-slug');

      if (!productId && slug) {
        try {
          const res = await fetch(`/api/products/list?search=${encodeURIComponent(slug)}&limit=1`);
          const data = await res.json();
          const match = (data.data || []).find(p => p.slug === slug);
          if (match) productId = match.id;
        } catch {}
      }
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

// --- Pose Library Filters ---
const poseGrid = document.getElementById('poseGrid');
const poseFilters = document.getElementById('poseFilters');

if (poseFilters && poseGrid) {
  poseFilters.querySelectorAll('.pose-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      poseFilters.querySelectorAll('.pose-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.getAttribute('data-filter');

      poseGrid.querySelectorAll('.pose-card').forEach(card => {
        if (filter === 'all' || card.getAttribute('data-category') === filter) {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}

// --- Centers Region Filters ---
const centersGrid = document.getElementById('centersGrid');
const regionFilters = document.getElementById('regionFilters');

if (regionFilters && centersGrid) {
  regionFilters.querySelectorAll('.region-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      regionFilters.querySelectorAll('.region-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const region = btn.getAttribute('data-region');

      centersGrid.querySelectorAll('.center-card').forEach(card => {
        if (region === 'all' || card.getAttribute('data-region') === region) {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}

// --- Wellness AI Form ---
const aiForm = document.getElementById('aiForm');

if (aiForm) {
  const poseDB = {
    beginner: {
      stress: [
        { name: 'Balasana', english: "Child's Pose", duration: '3 min' },
        { name: 'Sukhasana', english: 'Easy Seated Pose', duration: '5 min' },
        { name: 'Setu Bandhasana', english: 'Bridge Pose', duration: '1 min' },
        { name: 'Savasana', english: 'Corpse Pose', duration: '10 min' },
      ],
      diabetes: [
        { name: 'Trikonasana', english: 'Triangle Pose', duration: '30 sec' },
        { name: 'Bhujangasana', english: 'Cobra Pose', duration: '30 sec' },
        { name: 'Adho Mukha Svanasana', english: 'Downward-Facing Dog', duration: '1 min' },
        { name: 'Savasana', english: 'Corpse Pose', duration: '5 min' },
      ],
      hypertension: [
        { name: 'Vrksasana', english: 'Tree Pose', duration: '1 min' },
        { name: 'Setu Bandhasana', english: 'Bridge Pose', duration: '1 min' },
        { name: 'Sukhasana', english: 'Easy Seated Pose', duration: '5 min' },
        { name: 'Savasana', english: 'Corpse Pose', duration: '10 min' },
      ],
      'lower back': [
        { name: 'Balasana', english: "Child's Pose", duration: '2 min' },
        { name: 'Bhujangasana', english: 'Cobra Pose', duration: '30 sec' },
        { name: 'Setu Bandhasana', english: 'Bridge Pose', duration: '1 min' },
        { name: 'Savasana', english: 'Corpse Pose', duration: '5 min' },
      ],
    },
    intermediate: {
      stress: [
        { name: 'Adho Mukha Svanasana', english: 'Downward-Facing Dog', duration: '2 min' },
        { name: 'Vrksasana', english: 'Tree Pose', duration: '2 min' },
        { name: 'Trikonasana', english: 'Triangle Pose', duration: '1 min' },
        { name: 'Savasana', english: 'Corpse Pose', duration: '10 min' },
      ],
      diabetes: [
        { name: 'Trikonasana', english: 'Triangle Pose', duration: '1 min' },
        { name: 'Bhujangasana', english: 'Cobra Pose', duration: '1 min' },
        { name: 'Setu Bandhasana', english: 'Bridge Pose', duration: '1 min' },
        { name: 'Savasana', english: 'Corpse Pose', duration: '8 min' },
      ],
      hypertension: [
        { name: 'Vrksasana', english: 'Tree Pose', duration: '2 min' },
        { name: 'Trikonasana', english: 'Triangle Pose', duration: '1 min' },
        { name: 'Setu Bandhasana', english: 'Bridge Pose', duration: '2 min' },
        { name: 'Savasana', english: 'Corpse Pose', duration: '10 min' },
      ],
      'lower back': [
        { name: 'Balasana', english: "Child's Pose", duration: '2 min' },
        { name: 'Bhujangasana', english: 'Cobra Pose', duration: '1 min' },
        { name: 'Trikonasana', english: 'Triangle Pose', duration: '1 min' },
        { name: 'Savasana', english: 'Corpse Pose', duration: '8 min' },
      ],
    },
    advanced: {
      stress: [
        { name: 'Adho Mukha Vrksasana', english: 'Downward-Facing Dog', duration: '2 min' },
        { name: 'Vrksasana', english: 'Tree Pose', duration: '3 min' },
        { name: 'Trikonasana', english: 'Triangle Pose', duration: '2 min' },
        { name: 'Savasana', english: 'Corpse Pose', duration: '10 min' },
      ],
      diabetes: [
        { name: 'Adho Mukha Svanasana', english: 'Downward-Facing Dog', duration: '2 min' },
        { name: 'Bhujangasana', english: 'Cobra Pose', duration: '1 min' },
        { name: 'Trikonasana', english: 'Triangle Pose', duration: '2 min' },
        { name: 'Savasana', english: 'Corpse Pose', duration: '5 min' },
      ],
      hypertension: [
        { name: 'Vrksasana', english: 'Tree Pose', duration: '3 min' },
        { name: 'Setu Bandhasana', english: 'Bridge Pose', duration: '2 min' },
        { name: 'Sukhasana', english: 'Easy Seated Pose', duration: '5 min' },
        { name: 'Savasana', english: 'Corpse Pose', duration: '10 min' },
      ],
      'lower back': [
        { name: 'Adho Mukha Svanasana', english: 'Downward-Facing Dog', duration: '2 min' },
        { name: 'Bhujangasana', english: 'Cobra Pose', duration: '1 min' },
        { name: 'Setu Bandhasana', english: 'Bridge Pose', duration: '2 min' },
        { name: 'Savasana', english: 'Corpse Pose', duration: '8 min' },
      ],
    },
  };

  const defaultSequence = [
    { name: 'Vrksasana', english: 'Tree Pose', duration: '2 min' },
    { name: 'Trikonasana', english: 'Triangle Pose', duration: '1 min' },
    { name: 'Bhujangasana', english: 'Cobra Pose', duration: '1 min' },
    { name: 'Balasana', english: "Child's Pose", duration: '2 min' },
    { name: 'Savasana', english: 'Corpse Pose', duration: '10 min' },
  ];

  function findSequence(condition, experience) {
    const c = condition.toLowerCase();
    const e = experience || 'beginner';

    for (const [key, sequences] of Object.entries(poseDB[e] || poseDB.beginner)) {
      if (c.includes(key)) {
        return sequences;
      }
    }
    return null;
  }

  function renderSequence(sequence) {
    const container = document.getElementById('aiSequence');
    container.innerHTML = '';
    sequence.forEach((pose, i) => {
      const item = document.createElement('div');
      item.className = 'ai-sequence-item';
      item.innerHTML = `
        <div class="ai-sequence-num">${i + 1}</div>
        <div class="pose-name"><em>${pose.name}</em> &mdash; ${pose.english}</div>
        <div class="pose-duration">${pose.duration}</div>
      `;
      container.appendChild(item);
    });
  }

  aiForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const condition = document.getElementById('condition').value.trim();
    const experience = document.getElementById('experience').value;
    const duration = parseInt(document.getElementById('duration').value) || 20;

    const result = document.getElementById('aiResult');
    const seq = findSequence(condition, experience) || defaultSequence;

    renderSequence(seq);

    result.classList.add('show');
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
