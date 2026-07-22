/**
 * AI Study Coach — script.js
 *
 * Modules:
 *  1. Utility helpers
 *  2. Navigation — scroll shrink + mobile menu
 *  3. Smooth scroll for anchor links
 *  4. Stat counter animation (hero numbers)
 *  5. Scroll-reveal animation (IntersectionObserver)
 *  6. Module progress — persist state in localStorage
 *  7. CTA form — email validation + feedback
 *  8. Floating chat widget
 *  9. Footer year
 * 10. Init
 */

'use strict';

/* =============================================
   1. UTILITY HELPERS
============================================= */

/**
 * Shorthand querySelector with optional scope.
 * @param {string} selector
 * @param {Element|Document} [scope=document]
 * @returns {Element|null}
 */
const $ = (selector, scope = document) => scope.querySelector(selector);

/**
 * Shorthand querySelectorAll, returns an Array.
 * @param {string} selector
 * @param {Element|Document} [scope=document]
 * @returns {Element[]}
 */
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

/**
 * Clamp a number between min and max.
 */
const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

/**
 * Linear interpolation.
 */
const lerp = (start, end, t) => start + (end - start) * t;

/**
 * Debounce a function.
 * @param {Function} fn
 * @param {number} delay
 */
const debounce = (fn, delay = 150) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

/* =============================================
   2. NAVIGATION — scroll shrink + mobile menu
============================================= */

function initNav() {
  const header  = $('.site-header');
  const toggle  = $('.nav__toggle');
  const navList = $('.nav__links');

  if (!header || !toggle || !navList) return;

  // --- Scroll shrink ---
  const onScroll = debounce(() => {
    header.classList.toggle('scrolled', window.scrollY > 20);
  }, 50);

  window.addEventListener('scroll', onScroll, { passive: true });

  // --- Mobile menu toggle ---
  toggle.addEventListener('click', () => {
    const isOpen = navList.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(isOpen));
    // Prevent body scroll when menu is open
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  // Close menu when a link is clicked
  navList.addEventListener('click', (e) => {
    if (e.target.closest('.nav__link')) {
      navList.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
  });

  // Close menu on outside click
  document.addEventListener('click', (e) => {
    if (navList.classList.contains('open') &&
        !header.contains(e.target)) {
      navList.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
  });

  // Close menu on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && navList.classList.contains('open')) {
      navList.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      toggle.focus();
    }
  });
}

/* =============================================
   3. SMOOTH SCROLL FOR ANCHOR LINKS
============================================= */

function initSmoothScroll() {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;

    const targetId = link.getAttribute('href');
    if (targetId === '#') return;

    const target = document.querySelector(targetId);
    if (!target) return;

    e.preventDefault();

    const navHeight = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--nav-height'),
      10
    ) || 72;

    const top = target.getBoundingClientRect().top + window.scrollY - navHeight - 16;

    window.scrollTo({ top, behavior: 'smooth' });

    // Update focus for accessibility
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
  });
}

/* =============================================
   4. STAT COUNTER ANIMATION (hero numbers)
============================================= */

function animateCounter(el) {
  const target   = parseInt(el.dataset.target, 10);
  const duration = 1800; // ms
  const start    = performance.now();

  const tick = (now) => {
    const elapsed  = now - start;
    const progress = clamp(elapsed / duration, 0, 1);
    // Ease-out cubic
    const eased    = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(lerp(0, target, eased));

    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = target;
  };

  requestAnimationFrame(tick);
}

function initStatCounters() {
  const statNumbers = $$('[data-target]');
  if (!statNumbers.length) return;

  // Only animate once when the hero stats enter the viewport
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  statNumbers.forEach((el) => observer.observe(el));
}

/* =============================================
   5. SCROLL-REVEAL ANIMATION
============================================= */

function initScrollReveal() {
  // Add .reveal to cards, steps, modules, and section headers
  const revealSelectors = [
    '.feature-card',
    '.module-item',
    '.step',
    '.section-header',
    '.hero__content',
    '.hero__visual',
    '.cta-section__content',
  ];

  revealSelectors.forEach((sel) => {
    $$(sel).forEach((el, i) => {
      el.classList.add('reveal');
      // Stagger siblings within the same parent container
      const delayClass = `reveal-delay-${Math.min(i % 6 + 1, 5)}`;
      el.classList.add(delayClass);
    });
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  $$('.reveal').forEach((el) => observer.observe(el));
}

/* =============================================
   6. MODULE PROGRESS — persist in localStorage
============================================= */

const MODULE_KEY = 'asc_module_progress';
const TOTAL_MODULES = 10;

/**
 * Load progress state from localStorage.
 * Returns an object: { completedModules: Set<number>, currentModule: number }
 */
function loadProgress() {
  try {
    const raw = localStorage.getItem(MODULE_KEY);
    if (!raw) return { completedModules: new Set(), currentModule: 1 };
    const parsed = JSON.parse(raw);
    return {
      completedModules: new Set(parsed.completedModules || []),
      currentModule: parsed.currentModule || 1,
    };
  } catch {
    return { completedModules: new Set(), currentModule: 1 };
  }
}

/**
 * Save progress state to localStorage.
 */
function saveProgress({ completedModules, currentModule }) {
  try {
    localStorage.setItem(MODULE_KEY, JSON.stringify({
      completedModules: Array.from(completedModules),
      currentModule,
    }));
  } catch {
    // Storage may be unavailable (private browsing); fail silently
  }
}

/**
 * Derive the status label and CSS class for a module given current progress.
 */
function getModuleStatus(moduleNum, completedModules, currentModule) {
  if (completedModules.has(moduleNum)) {
    return { label: 'Completed ✓', cls: 'module-item__status--completed' };
  }
  if (moduleNum === currentModule) {
    return { label: 'In Progress', cls: 'module-item__status--current' };
  }
  if (moduleNum < currentModule) {
    // Shouldn't normally happen, but handle gracefully
    return { label: 'Completed ✓', cls: 'module-item__status--completed' };
  }
  return { label: 'Locked', cls: 'module-item__status--locked' };
}

/**
 * Render the modules list to match current progress state.
 */
function renderModules({ completedModules, currentModule }) {
  const items = $$('.module-item');

  items.forEach((item) => {
    const moduleNum = parseInt(item.dataset.module, 10);
    const statusEl  = item.querySelector('.module-item__status');
    if (!statusEl || isNaN(moduleNum)) return;

    const { label, cls } = getModuleStatus(moduleNum, completedModules, currentModule);

    // Update active state
    item.classList.toggle('module-item--active', moduleNum === currentModule);

    // Update status badge
    statusEl.className = `module-item__status ${cls}`;
    statusEl.textContent = label;
    statusEl.setAttribute('aria-label', label);

    // Add click handler to mark current module complete (only active module is clickable)
    item.style.cursor = moduleNum === currentModule ? 'pointer' : 'default';
  });
}

/**
 * Wire up click handlers on module items.
 * Clicking the active module marks it complete and advances to the next.
 */
function initModuleProgress() {
  const state = loadProgress();
  renderModules(state);

  const list = $('.modules__list');
  if (!list) return;

  list.addEventListener('click', (e) => {
    const item = e.target.closest('.module-item');
    if (!item) return;

    const moduleNum = parseInt(item.dataset.module, 10);
    if (isNaN(moduleNum)) return;

    const { completedModules, currentModule } = loadProgress();

    // Only the current (active) module can be advanced
    if (moduleNum !== currentModule) return;

    completedModules.add(moduleNum);
    const nextModule = Math.min(currentModule + 1, TOTAL_MODULES);
    const newState   = { completedModules, currentModule: nextModule };

    saveProgress(newState);
    renderModules(newState);

    // Announce progress change to screen readers
    const announcement = nextModule <= TOTAL_MODULES
      ? `Module ${moduleNum} complete. Now on Module ${nextModule} of ${TOTAL_MODULES}.`
      : 'Congratulations! All modules complete.';

    announceToScreenReader(announcement);

    // If all done, show a congratulations toast
    if (completedModules.size >= TOTAL_MODULES) {
      showToast('🎓 All modules complete! Your Canvas shell is now unlocked.');
    } else {
      showToast(`Module ${moduleNum} complete — moving to Module ${nextModule}.`);
    }
  });
}

/**
 * Inject a live region announcement for screen readers.
 */
function announceToScreenReader(message) {
  let region = $('#sr-announcer');
  if (!region) {
    region = document.createElement('div');
    region.id = 'sr-announcer';
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    region.className = 'sr-only';
    document.body.appendChild(region);
  }
  region.textContent = '';
  // Small delay ensures the DOM mutation fires the live region
  setTimeout(() => { region.textContent = message; }, 50);
}

/* =============================================
   TOAST NOTIFICATION
============================================= */

/**
 * Display a transient toast message at the bottom of the screen.
 * @param {string} message
 * @param {'info'|'success'|'error'} [type='success']
 * @param {number} [duration=4000] ms before auto-dismiss
 */
function showToast(message, type = 'success', duration = 4000) {
  // Ensure toast container exists
  let container = $('#toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('role', 'status');
    Object.assign(container.style, {
      position:   'fixed',
      bottom:     '96px',   // above the chat widget button
      left:       '50%',
      transform:  'translateX(-50%)',
      zIndex:     '300',
      display:    'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap:        '8px',
      pointerEvents: 'none',
    });
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.textContent = message;

  const colors = {
    success: { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.4)', color: '#6ee7b7' },
    error:   { bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.4)',  color: '#fca5a5' },
    info:    { bg: 'rgba(79,70,229,0.15)',  border: 'rgba(79,70,229,0.4)',  color: '#a5b4fc' },
  };
  const { bg, border, color } = colors[type] || colors.info;

  Object.assign(toast.style, {
    background:   bg,
    border:       `1px solid ${border}`,
    color:        color,
    padding:      '10px 20px',
    borderRadius: '9999px',
    fontSize:     '0.875rem',
    fontWeight:   '600',
    backdropFilter: 'blur(12px)',
    opacity:      '0',
    transform:    'translateY(8px)',
    transition:   'opacity 250ms ease, transform 250ms ease',
    fontFamily:   'var(--font-sans, sans-serif)',
    whiteSpace:   'nowrap',
    pointerEvents: 'none',
  });

  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.style.opacity   = '1';
      toast.style.transform = 'translateY(0)';
    });
  });

  // Animate out and remove
  setTimeout(() => {
    toast.style.opacity   = '0';
    toast.style.transform = 'translateY(8px)';
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, duration);
}

/* =============================================
   7. CTA FORM — email validation + feedback
============================================= */

function initCtaForm() {
  const form  = $('.cta-form');
  const input = $('#email');
  if (!form || !input) return;

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Inline error element
  const errorEl = document.createElement('p');
  errorEl.id = 'email-error';
  errorEl.setAttribute('aria-live', 'polite');
  Object.assign(errorEl.style, {
    color:     '#fca5a5',
    fontSize:  '0.8rem',
    marginTop: '4px',
    display:   'none',
  });
  input.parentElement.appendChild(errorEl);
  input.setAttribute('aria-describedby', 'email-error');

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
    input.classList.add('error');
    input.setAttribute('aria-invalid', 'true');
  }

  function clearError() {
    errorEl.style.display = 'none';
    input.classList.remove('error');
    input.setAttribute('aria-invalid', 'false');
  }

  // Clear error on input
  input.addEventListener('input', clearError);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = input.value.trim();

    if (!val) {
      showError('Please enter your institutional email address.');
      input.focus();
      return;
    }

    if (!emailRe.test(val)) {
      showError('That doesn\'t look like a valid email — please double-check.');
      input.focus();
      return;
    }

    clearError();

    // Optimistic UI: disable form while "submitting"
    const btn = form.querySelector('button[type="submit"]');
    const original = btn.textContent;
    btn.textContent = 'Starting…';
    btn.disabled    = true;
    input.disabled  = true;

    // Simulate an async onboarding sign-up (replace with real API call)
    setTimeout(() => {
      btn.textContent = '✓ Check your inbox!';
      showToast(`Welcome! Check ${val} for your onboarding link.`, 'success', 5000);
      announceToScreenReader('Success! Check your inbox for your onboarding link.');
      input.value = '';

      // Re-enable after a moment
      setTimeout(() => {
        btn.textContent = original;
        btn.disabled    = false;
        input.disabled  = false;
      }, 4000);
    }, 1200);
  });
}

/* =============================================
   8. FLOATING CHAT WIDGET
============================================= */

// Scripted responses — a minimal FAQ set that reflects real Canvas onboarding topics.
// In production, replace this with a real API call to your AI backend.
const BOT_RESPONSES = [
  {
    patterns: [/hello|hi|hey|start/i],
    reply: "Hi! I'm your AI Study Coach. Ask me anything about Canvas, or type \"modules\" to see your training progress.",
  },
  {
    patterns: [/module|progress|training/i],
    reply: 'You can see your full training path in the Modules section below. Click a module to mark it complete and unlock the next one.',
  },
  {
    patterns: [/canvas shell|course shell|create course|new course/i],
    reply: 'To create your Canvas shell: go to Courses → New Course, fill in your course name, and click Create Course. Need a step-by-step walkthrough?',
  },
  {
    patterns: [/grade|gradebook|export grade|speedgrader/i],
    reply: 'The Gradebook is under your course sidebar. For exporting: Gradebook → Actions → Export CSV. SpeedGrader is accessible from each assignment.',
  },
  {
    patterns: [/stuck|help|issue|problem|error|won.t submit/i],
    reply: "I'm here to help! If you're stuck on a specific step, describe what you see and I'll guide you through it. For urgent issues, I can route you to live support.",
  },
  {
    patterns: [/support|help desk|live chat|escalat|admin/i],
    reply: 'Escalation options: 1) Help Desk (internal), 2) LMS Administrator (email), 3) Instructure 24/7 Support, 4) Schedule a training call. Which would you like?',
  },
  {
    patterns: [/accessibility|caption|alt text|wcag/i],
    reply: 'Module 7 covers accessibility. Key steps: add alt text to all images, enable auto-captions on videos, and use the Accessibility Checker in Canvas\'s Rich Content Editor.',
  },
  {
    patterns: [/policy|policies|compliance|attendance/i],
    reply: 'College policies are covered in Module 8. Key areas: attendance reporting, grading deadlines, and academic integrity. Would you like a quick summary?',
  },
  {
    patterns: [/congratul|done|finish|complet/i],
    reply: '🎓 Congratulations! Once all 10 modules are complete, your Canvas shell unlocks and you graduate to full policy-based chat access.',
  },
];

const FALLBACK_REPLY = "Great question! I'm still learning that one. For now, check the Modules section or reach out to your LMS Administrator.";

/**
 * Find a scripted response for the given user input.
 */
function getBotReply(input) {
  const text = input.trim().toLowerCase();
  for (const { patterns, reply } of BOT_RESPONSES) {
    if (patterns.some((re) => re.test(text))) return reply;
  }
  return FALLBACK_REPLY;
}

/**
 * Append a message bubble to the chat widget messages area.
 */
function appendMessage(container, text, role = 'bot') {
  const msg = document.createElement('div');
  msg.className = `widget-msg widget-msg--${role}`;

  const bubble = document.createElement('p');
  bubble.textContent = text;
  msg.appendChild(bubble);
  container.appendChild(msg);

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
  return msg;
}

/**
 * Show a typing indicator, then replace it with the bot reply.
 */
function showBotReply(container, text) {
  // Typing indicator
  const indicator = document.createElement('div');
  indicator.className = 'widget-msg widget-msg--bot';
  indicator.setAttribute('aria-label', 'Coach is typing');
  indicator.innerHTML = `
    <p style="display:flex;gap:5px;padding:8px 12px;background:rgba(255,255,255,0.08);border-radius:8px;">
      <span style="animation:typingDot 1.2s ease-in-out infinite 0s;display:inline-block;width:7px;height:7px;border-radius:50%;background:#94a3b8;"></span>
      <span style="animation:typingDot 1.2s ease-in-out infinite 0.2s;display:inline-block;width:7px;height:7px;border-radius:50%;background:#94a3b8;"></span>
      <span style="animation:typingDot 1.2s ease-in-out infinite 0.4s;display:inline-block;width:7px;height:7px;border-radius:50%;background:#94a3b8;"></span>
    </p>`;
  container.appendChild(indicator);
  container.scrollTop = container.scrollHeight;

  // Replace with actual reply after a realistic delay
  const delay = 600 + Math.min(text.length * 12, 1200);
  setTimeout(() => {
    indicator.remove();
    appendMessage(container, text, 'bot');
    announceToScreenReader(text);
  }, delay);
}

function initChatWidget() {
  const widget   = $('#chat-widget');
  const toggle   = $('#chat-toggle');
  const closeBtn = $('#chat-close');
  const window_  = $('#chat-window');
  const form     = $('#chat-form');
  const input    = $('#chat-input');
  const messages = $('#chat-messages');

  if (!widget || !toggle || !window_ || !form || !input || !messages) return;

  // Greeting on first open
  let hasGreeted = false;

  function openChat() {
    window_.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    input.focus();

    if (!hasGreeted) {
      hasGreeted = true;
      showBotReply(
        messages,
        "Hi there! 👋 I'm your AI Study Coach. Ask me anything about your Canvas training, or type \"modules\" to check your progress."
      );
    }
  }

  function closeChat() {
    window_.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.focus();
  }

  toggle.addEventListener('click', () => {
    window_.hidden ? openChat() : closeChat();
  });

  closeBtn.addEventListener('click', closeChat);

  // Close on Escape
  window_.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeChat();
  });

  // Send message
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    appendMessage(messages, text, 'user');
    input.value = '';

    const reply = getBotReply(text);
    showBotReply(messages, reply);
  });
}

/* =============================================
   9. FOOTER YEAR
============================================= */

function initFooterYear() {
  const el = $('#footer-year');
  if (el) el.textContent = new Date().getFullYear();
}

/* =============================================
   10. INIT — wire everything up on DOMContentLoaded
============================================= */

function init() {
  initNav();
  initSmoothScroll();
  initStatCounters();
  initScrollReveal();
  initModuleProgress();
  initCtaForm();
  initChatWidget();
  initFooterYear();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  // DOM already parsed (e.g., script loaded with defer)
  init();
}
