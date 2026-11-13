// Repo: studio — assets/js/shell.js — FULL file
// LegendAlive Studio — Phase 0 shell (rewritten in Phase 1 for the full site).
// Responsibilities: stylesheet bootstrap via BASE, favicon, nav scroll state,
// mobile sheet with focus trap, live footer year, staged reveals.
// No dependencies. Native ES module. No innerHTML anywhere.

import { SITE, url } from './config.js';
import { initBrand } from './brand.js';

const doc = document;
const root = doc.documentElement;

/* Stylesheets — single source (plan 4.2 + T4).
   Injected here from BASE so identical HTML works at /studio/ and later at /.
   Pages carry a <noscript> relative <link> to base.css that is active ONLY
   when JavaScript is off — the two sources can never both apply. */
function ensureStylesheet(id, path) {
  if (doc.getElementById(id)) return;
  const link = doc.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = url(path);
  doc.head.appendChild(link);
}

function initNav() {
  const nav = doc.querySelector('[data-nav]');
  if (!nav) return;
  const toggle = nav.querySelector('[data-nav-toggle]');
  const sheet = nav.querySelector('[data-nav-sheet]');
  const isOpen = () => nav.classList.contains('nav-open');

  function setSheet(open, refocusToggle) {
    nav.classList.toggle('nav-open', open);
    doc.body.classList.toggle('no-scroll', open);
    if (toggle) toggle.setAttribute('aria-expanded', String(open));
    if (open && sheet) {
      const first = sheet.querySelector('a, button');
      if (first) first.focus();
    } else if (!open && refocusToggle && toggle) {
      toggle.focus();
    }
  }

  if (toggle) {
    toggle.addEventListener('click', () => setSheet(!isOpen(), false));
  }
  if (sheet) {
    sheet.addEventListener('click', (e) => {
      if (e.target.closest('a')) setSheet(false, false);
    });
  }

  // Escape closes; Tab cycles inside the header while the sheet is open.
  doc.addEventListener('keydown', (e) => {
    if (!isOpen()) return;
    if (e.key === 'Escape') { setSheet(false, true); return; }
    if (e.key !== 'Tab') return;
    const items = Array.from(
      nav.querySelectorAll('a[href], button:not([disabled])')
    );
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && doc.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && doc.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  });

  // Growing past the mobile breakpoint closes the sheet.
  const wide = window.matchMedia('(min-width: 861px)');
  if (wide.addEventListener) {
    wide.addEventListener('change', (e) => {
      if (e.matches && isOpen()) setSheet(false, false);
    });
  }

  // Border + shadow after 12px of scroll. Passive, rAF-throttled.
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      nav.classList.toggle('is-scrolled', window.scrollY > 12);
      ticking = false;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

function initYear() {
  const now = new Date().getFullYear();
  const label = now > SITE.yearStart
    ? SITE.yearStart + '\u2013' + now
    : String(SITE.yearStart);
  doc.querySelectorAll('[data-year]').forEach((node) => {
    node.textContent = label;
  });
}

function initReveals() {
  const els = Array.from(doc.querySelectorAll('[data-reveal]'));
  if (!els.length) return;

  // Stagger siblings inside a group: 70ms, capped at 6 items (plan 6.5).
  doc.querySelectorAll('[data-reveal-group]').forEach((group) => {
    Array.from(group.querySelectorAll('[data-reveal]')).forEach((el, i) => {
      el.style.transitionDelay = (Math.min(i, 5) * 70) + 'ms';
    });
  });

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) {
    els.forEach((el) => {
      el.classList.add('is-in');
      el.style.transitionDelay = '';
    });
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.classList.add('is-in');
      io.unobserve(el);
      // Clear the entrance delay afterwards so hover transitions stay snappy.
      const delay = parseFloat(el.style.transitionDelay) || 0;
      window.setTimeout(() => { el.style.transitionDelay = ''; }, delay + 500);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

  els.forEach((el) => io.observe(el));
}

function start() {
  ensureStylesheet('ls-css-base', 'assets/css/base.css');
  initBrand();
  initNav();
  initYear();
  initReveals();
  // Added LAST: reveal-hiding CSS is gated on .js, so if anything above
  // throws, content stays fully visible instead of stuck at opacity 0.
  root.classList.add('js');
}

try {
  start();
} catch (err) {
  root.classList.remove('js');
  console.error(
    'Studio shell failed to start. Press F12, read the first red line, and report it. Detail:',
    err
  );
}
