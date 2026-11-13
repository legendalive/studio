// Repo: studio — assets/js/shell.js — FULL file
// LegendAlive Studio — site shell (Phase 1 rewrite).
// Loads the shared stylesheets from BASE (single CSS source, T4), sets the
// favicon, and wires: nav scroll state, current-section marking (scrollspy),
// route marking for future pages, the mobile sheet with focus trap, the live
// footer year, and the optional reveal system.
// Pages built later (article stubs) call refreshShell() after constructing
// their nav/footer. Every binder is idempotent: no duplicated listeners.

import { SITE, url } from './config.js';
import { initBrand } from './brand.js';
import { el, qsa, on } from './dom.js';

const doc = document;
const root = doc.documentElement;

/* Stylesheets. Pages carry only a <noscript> fallback link, so these are
   the single active source. Feature modules may request extra sheets
   (reader.js will add prose.css) through the exported helper. */
export function ensureStylesheet(id, path) {
  if (doc.getElementById(id)) return;
  doc.head.appendChild(el('link', { id, rel: 'stylesheet', href: url(path) }));
}

/* ---------- Scroll state + scrollspy ---------- */

let spyTargets = [];
let scrollBound = false;
let ticking = false;

function buildSpy() {
  const map = new Map();
  qsa('.nav-links a[href^="#"], .nav-sheet a[href^="#"]').forEach((a) => {
    const id = a.getAttribute('href').slice(1);
    if (!id) return;
    const section = doc.getElementById(id);
    if (!section) return;
    if (!map.has(id)) map.set(id, { id, section, links: [] });
    map.get(id).links.push(a);
  });
  spyTargets = Array.from(map.values());
}

function updateScrollState() {
  const nav = doc.querySelector('[data-nav]');
  if (nav) nav.classList.toggle('is-scrolled', window.scrollY > 12);
  if (!spyTargets.length) return;

  // The section whose top has passed the reading line owns the nav mark.
  const line = window.innerHeight * 0.35;
  let currentId = '';
  for (const t of spyTargets) {
    if (t.section.getBoundingClientRect().top <= line) currentId = t.id;
  }
  const atBottom = window.innerHeight + window.scrollY >= root.scrollHeight - 4;
  if (atBottom) currentId = spyTargets[spyTargets.length - 1].id;

  for (const t of spyTargets) {
    for (const a of t.links) {
      if (t.id === currentId) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    }
  }
}

function bindScroll() {
  if (scrollBound) return;
  scrollBound = true;
  const request = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { updateScrollState(); ticking = false; });
  };
  on(window, 'scroll', request, { passive: true });
  on(window, 'resize', request);
  on(window, 'hashchange', request);
}

/* ---------- Route marking (activates when interior pages exist) ---------- */

function normalizePath(p) {
  return p.replace(/index\.html$/i, '').replace(/\/?$/, '/');
}

function markRoute() {
  const here = normalizePath(location.pathname);
  qsa('.nav-links a[href], .nav-sheet a[href]').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (href.startsWith('#')) return;
    let u;
    try { u = new URL(a.href, location.href); } catch (err) { return; }
    if (u.origin !== location.origin) return;
    if (!u.hash && normalizePath(u.pathname) === here) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  });
}

/* ---------- Nav + mobile sheet ---------- */

function bindNav() {
  const nav = doc.querySelector('[data-nav]');
  if (!nav || nav.dataset.shellBound) return;
  nav.dataset.shellBound = '1';

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

  if (toggle) toggle.addEventListener('click', () => setSheet(!isOpen(), false));
  if (sheet) {
    sheet.addEventListener('click', (e) => {
      if (e.target.closest('a')) setSheet(false, false);
    });
  }

  doc.addEventListener('keydown', (e) => {
    if (!isOpen()) return;
    if (e.key === 'Escape') { setSheet(false, true); return; }
    if (e.key !== 'Tab') return;
    const items = qsa('a[href], button:not([disabled])', nav);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  const wide = window.matchMedia('(min-width: 861px)');
  if (wide.addEventListener) {
    wide.addEventListener('change', (e) => {
      if (e.matches && isOpen()) setSheet(false, false);
    });
  }
}

/* ---------- Footer year ---------- */

function initYear() {
  const now = new Date().getFullYear();
  const label = now > SITE.yearStart ? SITE.yearStart + '\u2013' + now : String(SITE.yearStart);
  qsa('[data-year]').forEach((node) => { node.textContent = label; });
}

/* ---------- Reveals (opt-in via data-reveal; unused by the landing) ---------- */

let revealIO = null;

function initReveals() {
  const els = qsa('[data-reveal]').filter((n) => !n.dataset.revealBound);
  if (!els.length) return;
  els.forEach((n) => { n.dataset.revealBound = '1'; });

  qsa('[data-reveal-group]').forEach((group) => {
    qsa('[data-reveal]', group).forEach((n, i) => {
      if (!n.style.transitionDelay) n.style.transitionDelay = (Math.min(i, 5) * 70) + 'ms';
    });
  });

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) {
    els.forEach((n) => { n.classList.add('is-in'); n.style.transitionDelay = ''; });
    return;
  }

  if (!revealIO) {
    revealIO = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const n = entry.target;
        n.classList.add('is-in');
        revealIO.unobserve(n);
        const delay = parseFloat(n.style.transitionDelay) || 0;
        setTimeout(() => { n.style.transitionDelay = ''; }, delay + 500);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  }
  els.forEach((n) => revealIO.observe(n));
}

/* ---------- Public refresh + boot ---------- */

export function refreshShell() {
  bindNav();
  markRoute();
  buildSpy();
  bindScroll();
  initYear();
  initReveals();
  updateScrollState();
}

function start() {
  ensureStylesheet('ls-css-base', 'assets/css/base.css');
  ensureStylesheet('ls-css-layout', 'assets/css/layout.css');
  ensureStylesheet('ls-css-components', 'assets/css/components.css');
  initBrand();
  refreshShell();
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
