/* ===== MOOW.HUB — Main JavaScript ===== */

document.addEventListener('DOMContentLoaded', () => {
  // --- Navbar Scroll Effect ---
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll();
  }

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

    const closeMobileMenu = () => {
      menuToggle.classList.remove('active');
      navLinks.classList.remove('active');
      document.body.style.overflow = '';
    };

    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', (e) => {
        if (window.innerWidth > 768 && link.closest('.nav-dropdown')) return;
        closeMobileMenu();
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
      const windowW = window.innerWidth;

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
      const href = this.getAttribute('href');
      if (!href || href === '#') return;
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // --- Cart Functionality (integrated with Cart module) ---
  // Event delegation on document to handle dynamically added buttons
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-add-cart');
    if (!btn) return;
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

      showNotification('Added to cart!', 'success', 'View Cart', '/pages/cart.html');

      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
        btn.disabled = false;
      }, 1500);
    } catch (error) {
      btn.textContent = 'Error';
      showNotification('Failed to add item', 'error');
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 1500);
    }
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
      vision: 'At least 10 characters.'
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

      const formData = {
        first_name: document.getElementById('firstName').value,
        last_name: document.getElementById('lastName').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        organisation: document.getElementById('organisation').value,
        location: document.getElementById('location').value,
        quantity: document.getElementById('quantity').value,
        type: document.getElementById('type').value,
        vision: document.getElementById('vision').value
      };

      const token = localStorage.getItem('moow_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      fetch('/api/contact/inquiry', { method: 'POST', headers, body: JSON.stringify(formData) })
        .then(r => r.json())
        .then(data => {
          if (data.success) {
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
          } else {
            submitBtn.innerHTML = 'Failed — Try Again';
            submitBtn.style.background = '#c0392b';
            setTimeout(() => {
              submitBtn.innerHTML = originalText;
              submitBtn.style.background = '';
              submitBtn.disabled = false;
            }, 3000);
          }
        })
        .catch(() => {
          submitBtn.innerHTML = 'Failed — Try Again';
          submitBtn.style.background = '#c0392b';
          setTimeout(() => {
            submitBtn.innerHTML = originalText;
            submitBtn.style.background = '';
            submitBtn.disabled = false;
          }, 3000);
        });
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

  // --- Newsletter Subscribe Form ---
  const subscribeForm = document.getElementById('subscribeForm');
  const subscribeMessage = document.getElementById('subscribeMessage');

  if (subscribeForm) {
    subscribeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = subscribeForm.querySelector('input[name="email"]').value.trim();
      const full_name = subscribeForm.querySelector('input[name="full_name"]').value.trim();
      const btn = subscribeForm.querySelector('.newsletter-submit');
      const originalHtml = btn.innerHTML;

      btn.innerHTML = 'Subscribing...';
      btn.disabled = true;
      subscribeMessage.textContent = '';
      subscribeMessage.className = 'newsletter-message';

      try {
        const res = await fetch('/api/subscriptions/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, full_name: full_name || undefined })
        });
        const data = await res.json();

        if (data.success) {
          subscribeMessage.textContent = 'You\'re in! Welcome to the Moow.Hub community.';
          subscribeMessage.className = 'newsletter-message success';
          subscribeForm.reset();
        } else {
          subscribeMessage.textContent = data.error || 'Something went wrong.';
          subscribeMessage.className = 'newsletter-message error';
        }
      } catch {
        subscribeMessage.textContent = 'Connection error. Please try again.';
        subscribeMessage.className = 'newsletter-message error';
      }

      btn.innerHTML = originalHtml;
      btn.disabled = false;
    });
  }

  // --- Draw Signature Canvas ---
  const sigCanvas = document.getElementById('signaturePad');
  const sigClear = document.getElementById('signatureClear');
  const sigData = document.getElementById('signatureData');
  const sigPlaceholder = document.getElementById('signaturePlaceholder');
  let hasDrawn = false;
  let sigCtx = null;

  if (sigCanvas) {
    sigCtx = sigCanvas.getContext('2d');
    let drawing = false;

    function resizeCanvas() {
      const rect = sigCanvas.parentElement.getBoundingClientRect();
      sigCanvas.width = rect.width;
      sigCanvas.height = 160;
      sigCtx.lineWidth = 2.5;
      sigCtx.lineCap = 'round';
      sigCtx.lineJoin = 'round';
      sigCtx.strokeStyle = '#1a2744';
    }

    function getPos(e) {
      const rect = sigCanvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: clientX - rect.left, y: clientY - rect.top };
    }

    function startDraw(e) {
      e.preventDefault();
      drawing = true;
      const pos = getPos(e);
      sigCtx.beginPath();
      sigCtx.moveTo(pos.x, pos.y);
      sigCanvas.parentElement.classList.add('active');
    }

    function draw(e) {
      e.preventDefault();
      if (!drawing) return;
      const pos = getPos(e);
      sigCtx.lineTo(pos.x, pos.y);
      sigCtx.stroke();
      hasDrawn = true;
      sigPlaceholder.classList.add('hidden');
    }

    function stopDraw(e) {
      e.preventDefault();
      drawing = false;
    }

    sigCanvas.addEventListener('mousedown', startDraw);
    sigCanvas.addEventListener('mousemove', draw);
    sigCanvas.addEventListener('mouseup', stopDraw);
    sigCanvas.addEventListener('mouseleave', stopDraw);
    sigCanvas.addEventListener('touchstart', startDraw, { passive: false });
    sigCanvas.addEventListener('touchmove', draw, { passive: false });
    sigCanvas.addEventListener('touchend', stopDraw, { passive: false });

    sigClear.addEventListener('click', () => {
      sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
      hasDrawn = false;
      sigPlaceholder.classList.remove('hidden');
      sigCanvas.parentElement.classList.remove('active');
      sigData.value = '';
    });

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  }

  // --- Signature File Upload ---
  const sigFileInput = document.getElementById('sigFileInput');
  const sigUploadPreview = document.getElementById('sigUploadPreview');
  const sigUploadedImg = document.getElementById('sigUploadedImg');
  const sigUploadRemove = document.getElementById('sigUploadRemove');
  const sigUploadHint = document.getElementById('sigUploadHint');
  const sigSource = document.getElementById('sigSource');
  const MAX_FILE_SIZE = 2 * 1024 * 1024;
  let uploadedSigData = null;

  if (sigFileInput) {
    sigFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (file.size > MAX_FILE_SIZE) {
        partnerMessage.textContent = 'File is too large. Maximum size is 2MB.';
        partnerMessage.className = 'partner-message error';
        sigFileInput.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        uploadedSigData = ev.target.result;
        sigUploadedImg.src = uploadedSigData;
        sigUploadPreview.style.display = 'flex';
        sigUploadHint.textContent = file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';
        sigSource.value = 'upload';
        partnerMessage.textContent = '';
        partnerMessage.className = 'partner-message';
      };
      reader.readAsDataURL(file);
    });

    sigUploadRemove.addEventListener('click', () => {
      uploadedSigData = null;
      sigFileInput.value = '';
      sigUploadPreview.style.display = 'none';
      sigUploadedImg.src = '';
      sigUploadHint.textContent = 'PNG or JPEG, max 2MB';
      sigSource.value = '';
      partnerMessage.textContent = '';
      partnerMessage.className = 'partner-message';
    });
  }

  // --- Partner Digital Signature Form ---
  const partnerForm = document.getElementById('partnerForm');
  const partnerMessage = document.getElementById('partnerMessage');
  const partnerAgree = document.getElementById('partnerAgree');

  if (partnerForm) {
    partnerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('partnerSubmit');
      const originalHtml = btn.innerHTML;

      // Validate terms acceptance
      if (!partnerAgree.checked) {
        partnerMessage.textContent = 'Please accept the Partnership Agreement terms to continue.';
        partnerMessage.className = 'partner-message error';
        partnerAgree.parentElement.querySelector('.checkmark').style.borderColor = '#c0392b';
        return;
      }

      // Validate signature: either drawn or uploaded
      const hasDrawnSig = hasDrawn && sigCanvas && sigCanvas.toDataURL('image/png').length > 1000;
      const hasUploadedSig = !!uploadedSigData;

      if (!hasDrawnSig && !hasUploadedSig) {
        partnerMessage.textContent = 'Please draw your signature or upload a signed image.';
        partnerMessage.className = 'partner-message error';
        return;
      }

      sigData.value = hasUploadedSig ? uploadedSigData : sigCanvas.toDataURL('image/png');

      const formData = {
        first_name: partnerForm.querySelector('input[name="first_name"]').value.trim(),
        last_name: partnerForm.querySelector('input[name="last_name"]').value.trim(),
        email: partnerForm.querySelector('input[name="email"]').value.trim(),
        phone: partnerForm.querySelector('input[name="phone"]').value.trim(),
        organisation: partnerForm.querySelector('input[name="organisation"]').value.trim(),
        location: partnerForm.querySelector('input[name="location"]').value.trim(),
        org_type: partnerForm.querySelector('select[name="org_type"]').value,
        signature_data: sigData.value
      };

      btn.innerHTML = 'Submitting...';
      btn.disabled = true;
      partnerMessage.textContent = '';
      partnerMessage.className = 'partner-message';

      try {
        const res = await fetch('/api/partner/digisign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        const data = await res.json();

        if (data.success) {
          partnerMessage.innerHTML = '<strong>Agreement signed successfully!</strong><br>Thank you! Our partnerships team will reach out within 2-3 business days.';
          partnerMessage.className = 'partner-message success';
          partnerForm.reset();
          if (sigCtx) {
            sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
          }
          hasDrawn = false;
          if (sigPlaceholder) sigPlaceholder.classList.remove('hidden');
          if (sigCanvas) sigCanvas.parentElement.classList.remove('active');
          sigData.value = '';
          uploadedSigData = null;
          sigFileInput.value = '';
          sigUploadPreview.style.display = 'none';
          sigUploadedImg.src = '';
          sigUploadHint.textContent = 'PNG or JPEG, max 2MB';
          sigSource.value = '';
        } else {
          partnerMessage.textContent = data.error || 'Something went wrong. Please try again.';
          partnerMessage.className = 'partner-message error';
        }
      } catch {
        partnerMessage.textContent = 'Connection error. Please check your internet and try again.';
        partnerMessage.className = 'partner-message error';
      }

      btn.innerHTML = originalHtml;
      btn.disabled = false;
    });
  }

  // --- Initialize Cart badge ---
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

function showNotification(message, type = 'success', actionText, actionUrl) {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
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
    display: flex;
    align-items: center;
    gap: 1rem;
    max-width: 400px;
  `;

  const msgSpan = document.createElement('span');
  msgSpan.textContent = message;
  notification.appendChild(msgSpan);

  if (actionText && actionUrl) {
    const link = document.createElement('a');
    link.href = actionUrl;
    link.className = 'notification-action';
    link.textContent = actionText + ' \u2192';
    notification.appendChild(link);
  }

  document.body.appendChild(notification);

  const dismiss = () => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  };

  notification.addEventListener('click', (e) => {
    if (e.target === notification || e.target === msgSpan) dismiss();
  });

  setTimeout(dismiss, 3500);
}

// ===== THEME PICKER — nav icon + dropdown (site-wide) =====
(function () {
  const panel = document.getElementById('tp');
  if (!panel) return;
  const toggle = document.getElementById('tp-toggle');
  if (!toggle) return;

  const setOpen = (open) => {
    panel.classList.toggle('closed', !open);
    toggle.setAttribute('aria-expanded', String(open));
  };

  toggle.addEventListener('click', () => {
    setOpen(panel.classList.contains('closed'));
  });

  const apply = (name) => {
    document.documentElement.setAttribute('data-theme', name);
    panel.querySelectorAll('[data-theme-btn]').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-theme-btn') === name);
    });
    try { localStorage.setItem('moow_theme_preview', name); } catch (e) {}
  };

  panel.querySelectorAll('[data-theme-btn]').forEach((b) => {
    b.addEventListener('click', () => {
      apply(b.getAttribute('data-theme-btn'));
      setOpen(false);
    });
  });

  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target)) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });

  let saved = 'walnut-latte';
  try { saved = localStorage.getItem('moow_theme_preview') || 'walnut-latte'; } catch (e) {}
  apply(saved);
})();
