// LegendAlive Studio — the shared runtime, in one module.
// Constants, DOM helpers, favicon, nav + footer, scroll state, manifest
// access and the system map. It boots itself on load: a page only needs
// <body data-nav="..."> and the chrome placeholders. Page-specific code
// imports what it needs from here.

/* ============ Constants ============ */

export const BASE = '/studio/';            // -> '/' at domain cutover
export const CONTENT_EXT = '.md';

export const SITE = {
  name: 'LegendAlive Studio',
  tagline: 'We build software and keep it running.',
  description: 'An independent software studio. Products in production, engineering case studies, technical writing and release notes.',
  yearStart: 2026,
};

export const OWNER = {
  name: 'Benson Mtsotso',
  email: 'mbenson.mb62@gmail.com',
  githubUrl: 'https://github.com/legendalive',
};

export const LINKS = {
  studioRepo: 'https://github.com/legendalive/studio',
  weaver: {
    app: 'https://legendalive.github.io/Weaver/',
    site: 'https://weaver-studio.pages.dev/',
    pricing: 'https://weaver-studio.pages.dev/pricing',
    monthly: 'https://mbenson62.gumroad.com/l/weaver-monthly',
    yearly: 'https://mbenson62.gumroad.com/l/weaver-yearly',
    lifetime: 'https://mbenson62.gumroad.com/l/weaver-lifetime',
  },
  repobundle: {
    app: 'https://legendalive.github.io/RepoBundle/',
    source: 'https://github.com/legendalive/RepoBundle',
  },
};

export const LABELS = {
  status: { live: 'Live', building: 'In development', lab: 'Experiment', paused: 'Paused' },
  statusSentence: { live: 'Live.', building: 'In development.', lab: 'In the lab.', paused: 'Paused.' },
  category: { product: 'Product', tool: 'Developer tool', experiment: 'Experiment', client: 'Client work' },
  kind: { engineering: 'Engineering', design: 'Design', decision: 'Decision', note: 'Note', release: 'Release' },
};

export function url(path = '') { return BASE + String(path).replace(/^\/+/, ''); }
export function absoluteUrl(path = '') { return location.origin + url(path); }

/* ============ DOM ============ */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function escapeHtml(v) { return String(v).replace(/[&<>"']/g, (c) => ESCAPES[c]); }

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') { node.className = String(v); continue; }
    if (k === 'text') { node.textContent = String(v); continue; }
    if (k === 'dataset') { for (const [a, b] of Object.entries(v)) node.dataset[a] = String(b); continue; }
    if (k === 'style' && typeof v === 'object') { Object.assign(node.style, v); continue; }
    if (k.startsWith('on') && typeof v === 'function') { node.addEventListener(k.slice(2).toLowerCase(), v); continue; }
    if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') { node[k] = v; continue; }
    node.setAttribute(k, v === true ? '' : String(v));
  }
  append(node, children);
  return node;
}
function append(node, children) {
  if (children == null || children === false) return;
  if (Array.isArray(children)) { for (const c of children) append(node, c); return; }
  node.appendChild(children instanceof Node ? children : document.createTextNode(String(children)));
}
export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }
export function qs(s, r = document) { return r.querySelector(s); }
export function qsa(s, r = document) { return Array.from(r.querySelectorAll(s)); }
export function on(t, type, fn, opts) { t.addEventListener(type, fn, opts); return () => t.removeEventListener(type, fn, opts); }
export function debounce(fn, wait = 180) {
  let id = 0;
  const w = (...a) => { clearTimeout(id); id = setTimeout(() => fn(...a), wait); };
  w.cancel = () => clearTimeout(id);
  return w;
}

let toastRegion = null;
export function toast(message, kind = 'info', timeout = 4200) {
  if (!toastRegion || !toastRegion.isConnected) {
    toastRegion = el('div', { class: 'toast-region', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(toastRegion);
  }
  while (toastRegion.children.length >= 4) toastRegion.removeChild(toastRegion.firstChild);
  const k = ['success', 'warn', 'danger'].includes(kind) ? kind : 'info';
  let timer = 0;
  const node = el('div', { class: 'toast' + (k !== 'info' ? ' toast--' + k : '') }, [
    el('span', {}, [String(message)]),
    el('button', { class: 'toast-close', type: 'button', 'aria-label': 'Dismiss notification', onClick: () => dismiss() }, ['\u00d7']),
  ]);
  function dismiss() { clearTimeout(timer); if (node.isConnected) node.remove(); }
  toastRegion.appendChild(node);
  if (timeout > 0) timer = setTimeout(dismiss, timeout);
  return dismiss;
}

export async function copyText(text) {
  const value = String(text);
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(value); return true; }
  } catch (err) { /* fall through */ }
  try {
    const ta = el('textarea', { style: { position: 'fixed', top: '-1000px', opacity: '0' } });
    ta.value = value;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (err) { return false; }
}

/* ============ Favicon ============ */

const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="lm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b3a55"/><stop offset=".32" stop-color="#38bdf8"/><stop offset=".5" stop-color="#eaf6ff"/><stop offset=".68" stop-color="#0ea5e9"/><stop offset="1" stop-color="#0b3a55"/></linearGradient><radialGradient id="ln" cx=".35" cy=".35" r=".9"><stop offset="0" stop-color="#f4fbff"/><stop offset=".55" stop-color="#38bdf8"/><stop offset="1" stop-color="#0b3a55"/></radialGradient></defs><rect x="1.5" y="1.5" width="61" height="61" rx="14" fill="#06080b" stroke="#232d3a" stroke-width="3"/><path d="M22 14v34h30" fill="none" stroke="#04121d" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 14v34h30" fill="none" stroke="url(#lm)" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 14v34h30" fill="none" stroke="#eaf6ff" stroke-opacity=".8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M44 48v-8" fill="none" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/><circle cx="22" cy="48" r="5.5" fill="url(#ln)" stroke="#04121d" stroke-width="2"/></svg>`;

function initBrand() {
  let link = qs('link[rel="icon"]');
  if (!link) { link = el('link', { rel: 'icon' }); document.head.appendChild(link); }
  link.type = 'image/svg+xml';
  link.href = 'data:image/svg+xml,' + encodeURIComponent(FAVICON);
}

/* ============ Chrome ============ */

const NAV = [
  { key: 'work', label: 'Work', path: 'work/' },
  { key: 'writing', label: 'Writing', path: 'writing/' },
  { key: 'capabilities', label: 'Capabilities', path: '', hash: 'capabilities' },
  { key: 'about', label: 'The developer', path: 'about/' },
  { key: 'contact', label: 'Contact', path: '', hash: 'contact' },
  { key: 'github', label: 'GitHub', external: true },
];

function navHref(i) {
  if (i.external) return OWNER.githubUrl;
  return url(i.path || '') + (i.hash ? '#' + i.hash : '');
}
function navAnchor(i, current) {
  return el('a', {
    href: navHref(i),
    'aria-current': i.key === current ? 'true' : null,
    target: i.external ? '_blank' : null,
    rel: i.external ? 'noopener' : null,
  }, [i.label]);
}

export function buildNav(current = '') {
  return el('header', { class: 'site-nav', 'data-nav': true, 'data-current': current }, [
    el('div', { class: 'container nav-bar' }, [
      el('a', { class: 'nav-brand', href: url(''), 'aria-label': SITE.name + ', home' }, [
        el('span', { class: 'studio-mark studio-mark--sm', 'aria-hidden': 'true' }),
        el('span', {}, [SITE.name]),
      ]),
      el('nav', { class: 'nav-links', 'aria-label': 'Primary' }, NAV.map((i) => navAnchor(i, current))),
      el('button', {
        class: 'nav-toggle', type: 'button', 'data-nav-toggle': true,
        'aria-expanded': 'false', 'aria-controls': 'nav-sheet', 'aria-label': 'Menu',
      }, [el('span', { class: 'nav-toggle-bars', 'aria-hidden': 'true' })]),
    ]),
    el('nav', { class: 'nav-sheet', id: 'nav-sheet', 'data-nav-sheet': true, 'aria-label': 'Mobile' }, [
      ...NAV.map((i) => navAnchor(i, current)),
      el('span', { class: 'nav-sheet-note' }, [SITE.name]),
    ]),
  ]);
}

function footerCol(label, items) {
  return el('nav', { class: 'footer-col', 'aria-label': label }, [
    el('h3', {}, [label]),
    el('ul', { role: 'list' }, items.map((i) => el('li', {}, [
      el('a', { href: i.href, target: i.external ? '_blank' : null, rel: i.external ? 'noopener' : null }, [i.label]),
    ]))),
  ]);
}

export function buildFooter(projects = []) {
  const products = (projects || []).map((p) => ({ label: p.name, href: url(p.page || 'work/' + p.slug + '/') }));
  if (!products.length) products.push({ label: 'All work', href: url('work/') });
  return el('footer', { class: 'site-footer' }, [
    el('div', { class: 'container' }, [
      el('div', { class: 'footer-grid' }, [
        el('div', { class: 'footer-brand' }, [
          el('span', { class: 'studio-mark studio-mark--md', 'aria-hidden': 'true' }),
          el('span', { class: 'footer-brand-name' }, [SITE.name]),
          el('p', { class: 'footer-tagline' }, [SITE.tagline]),
        ]),
        footerCol('Studio', [
          { label: 'Home', href: url('') },
          { label: 'Work', href: url('work/') },
          { label: 'Writing', href: url('writing/') },
          { label: 'Coming soon', href: url('') + '#coming-soon' },
          { label: 'The developer', href: url('about/') },
          { label: 'Contact', href: url('') + '#contact' },
        ]),
        footerCol('Products', products),
        footerCol('Elsewhere', [
          { label: 'GitHub profile', href: OWNER.githubUrl, external: true },
          { label: 'Email', href: 'mailto:' + OWNER.email },
          { label: "This site's source", href: LINKS.studioRepo, external: true },
        ]),
      ]),
      el('div', { class: 'footer-bottom' }, [
        el('span', {}, ['\u00a9 ', el('span', { 'data-year': true }, ['2026']), ' ', OWNER.name]),
      ]),
    ]),
  ]);
}

function upsertMeta(attr, key, content) {
  let n = document.head.querySelector('meta[' + attr + '="' + key + '"]');
  if (!n) { n = el('meta', { [attr]: key }); document.head.appendChild(n); }
  n.setAttribute('content', content);
}

// Optional per-page override. Canonical and og:url are handled at boot for
// every page, so this is only needed for JSON-LD or article metadata.
export function applyMeta(o = {}) {
  const desc = o.description || SITE.description;
  const social = o.ogTitle || o.title || SITE.name;
  const canonical = absoluteUrl(o.path || '');
  if (o.title) document.title = o.title;
  upsertMeta('name', 'description', desc);
  if (o.robots) upsertMeta('name', 'robots', o.robots);
  upsertMeta('property', 'og:type', o.type || 'website');
  upsertMeta('property', 'og:site_name', SITE.name);
  upsertMeta('property', 'og:title', social);
  upsertMeta('property', 'og:description', desc);
  upsertMeta('property', 'og:url', canonical);
  upsertMeta('name', 'twitter:title', social);
  upsertMeta('name', 'twitter:description', desc);
  if (o.published) upsertMeta('property', 'article:published_time', o.published);
  if (o.modified) upsertMeta('property', 'article:modified_time', o.modified);
  qsa('meta[property="article:tag"]').forEach((n) => n.remove());
  (o.tags || []).forEach((t) => document.head.appendChild(el('meta', { property: 'article:tag', content: String(t) })));
  qsa('script[data-ls-jsonld]').forEach((n) => n.remove());
  if (o.jsonLd) {
    const s = el('script', { type: 'application/ld+json', 'data-ls-jsonld': true });
    s.textContent = JSON.stringify(o.jsonLd);
    document.head.appendChild(s);
  }
}

function fixCanonical() {
  const path = location.pathname.startsWith(BASE) ? location.pathname.slice(BASE.length) : '';
  const canonical = absoluteUrl(path);
  let link = qs('link[rel="canonical"]');
  if (!link) { link = el('link', { rel: 'canonical' }); document.head.appendChild(link); }
  link.href = canonical;
  upsertMeta('property', 'og:url', canonical);
}

/* ============ Shell behaviour ============ */

let spy = [];
let scrollBound = false;
let ticking = false;

function norm(p) { return p.replace(/index\.html$/i, '').replace(/\/?$/, '/'); }

function buildSpy() {
  const map = new Map();
  const here = norm(location.pathname);
  qsa('.nav-links a[href], .nav-sheet a[href]').forEach((a) => {
    let u;
    try { u = new URL(a.href, location.href); } catch (err) { return; }
    if (u.origin !== location.origin || !u.hash) return;
    if (norm(u.pathname) !== here) return;
    const id = u.hash.slice(1);
    const section = id && document.getElementById(id);
    if (!section) return;
    if (!map.has(id)) map.set(id, { id, section, links: [] });
    map.get(id).links.push(a);
  });
  spy = Array.from(map.values());
}

function updateScroll() {
  const nav = qs('[data-nav]');
  if (nav) nav.classList.toggle('is-scrolled', window.scrollY > 12);
  if (!spy.length) return;
  const line = window.innerHeight * 0.35;
  let cur = '';
  for (const t of spy) if (t.section.getBoundingClientRect().top <= line) cur = t.id;
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = spy[spy.length - 1].id;
  for (const t of spy) for (const a of t.links) {
    if (t.id === cur) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
  }
}

function bindScroll() {
  if (scrollBound) return;
  scrollBound = true;
  const req = () => { if (ticking) return; ticking = true; requestAnimationFrame(() => { updateScroll(); ticking = false; }); };
  on(window, 'scroll', req, { passive: true });
  on(window, 'resize', req);
  on(window, 'hashchange', req);
}

function bindNav() {
  const nav = qs('[data-nav]');
  if (!nav || nav.dataset.bound) return;
  nav.dataset.bound = '1';
  const toggle = nav.querySelector('[data-nav-toggle]');
  const sheet = nav.querySelector('[data-nav-sheet]');
  const open = () => nav.classList.contains('nav-open');
  function set(v, refocus) {
    nav.classList.toggle('nav-open', v);
    document.body.classList.toggle('no-scroll', v);
    if (toggle) toggle.setAttribute('aria-expanded', String(v));
    if (v && sheet) { const f = sheet.querySelector('a, button'); if (f) f.focus(); }
    else if (!v && refocus && toggle) toggle.focus();
  }
  if (toggle) toggle.addEventListener('click', () => set(!open(), false));
  if (sheet) sheet.addEventListener('click', (e) => { if (e.target.closest('a')) set(false, false); });
  document.addEventListener('keydown', (e) => {
    if (!open()) return;
    if (e.key === 'Escape') { set(false, true); return; }
    if (e.key !== 'Tab') return;
    const items = qsa('a[href], button:not([disabled])', nav);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  const wide = window.matchMedia('(min-width: 861px)');
  if (wide.addEventListener) wide.addEventListener('change', (e) => { if (e.matches && open()) set(false, false); });
}

function initYear() {
  const now = new Date().getFullYear();
  const label = now > SITE.yearStart ? SITE.yearStart + '\u2013' + now : String(SITE.yearStart);
  qsa('[data-year]').forEach((n) => { n.textContent = label; });
}

export function refreshShell() { bindNav(); buildSpy(); bindScroll(); initYear(); updateScroll(); }

function renderChrome() {
  const current = document.body.dataset.nav || '';
  const navMount = qs('[data-chrome-nav]');
  if (navMount) navMount.replaceWith(buildNav(current));
  const footMount = qs('[data-chrome-footer]');
  if (footMount) footMount.replaceWith(buildFooter([]));
  refreshShell();
}

/* ============ Manifest ============ */

let inflight = null;
export function loadManifest(force = false) {
  if (force) inflight = null;
  if (!inflight) inflight = fetchManifest().catch((e) => { inflight = null; throw e; });
  return inflight;
}

async function fetchManifest() {
  let res;
  try {
    res = await fetch(url('content/index.json'), { cache: 'no-cache', headers: { accept: 'application/json' } });
  } catch (err) {
    throw new Error('Could not reach the content manifest. Check your connection, then retry.');
  }
  if (!res.ok) throw new Error('The content manifest returned HTTP ' + res.status + '. Confirm content/index.json exists on main and the Pages deploy is green, then retry.');
  const text = await res.text();
  const head = text.trimStart().slice(0, 200).toLowerCase();
  if (head.startsWith('<!doctype') || head.startsWith('<html')) {
    throw new Error('The manifest came back as HTML instead of JSON. Check the latest Pages deploy, then retry.');
  }
  let data;
  try { data = JSON.parse(text); }
  catch (err) { throw new Error('The content manifest is not valid JSON. Open content/index.json and check the last edit for a missing comma or quote.'); }
  const arr = (v) => (Array.isArray(v) ? v : []);
  const ok = (x) => x && typeof x.slug === 'string' && /^[a-z0-9-]+$/.test(x.slug);
  return {
    version: Number(data.version) || 1,
    updated: typeof data.updated === 'string' ? data.updated : '',
    projects: arr(data.projects).filter(ok),
    posts: arr(data.posts).filter(ok),
    releases: arr(data.releases).filter((r) => r && r.product && r.version),
    capabilities: arr(data.capabilities).filter((c) => c && c.id),
  };
}

const byName = (a, b) => String(a.name || a.title || '').localeCompare(String(b.name || b.title || ''));
const dateDesc = (a, b) => String(b.date || '').localeCompare(String(a.date || ''));

export function getProjects(m) {
  return (m && m.projects ? m.projects : []).slice().sort((a, b) =>
    Number(Boolean(b.featured)) - Number(Boolean(a.featured)) ||
    (Number(a.order) || 999) - (Number(b.order) || 999) ||
    (Number(b.year) || 0) - (Number(a.year) || 0) || byName(a, b));
}
export function getPosts(m, includeDrafts = false) {
  const list = (m && m.posts ? m.posts : []).filter((p) => includeDrafts || p.draft !== true);
  return list.slice().sort((a, b) => dateDesc(a, b) || byName(a, b));
}
export function getReleases(m) {
  return (m && m.releases ? m.releases : []).slice().sort((a, b) => dateDesc(a, b));
}
export function getCapabilities(m) { return m && m.capabilities ? m.capabilities : []; }
export function findBySlug(list, slug) { return (list || []).find((x) => x && x.slug === slug) || null; }
export function formatDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return '';
  const d = new Date(String(iso) + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

/* ============ System map ============ */

const NS = 'http://www.w3.org/2000/svg';
const MOTION_KEY = 'ls-map-motion';
const W = 640, H = 470;

function sv(tag, attrs = {}, kids = []) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; n.setAttribute(k, v === true ? '' : String(v)); }
  for (const c of [].concat(kids)) { if (c == null || c === false) continue; n.appendChild(c instanceof Node ? c : document.createTextNode(String(c))); }
  return n;
}
function motionPref() {
  try { const v = localStorage.getItem(MOTION_KEY); if (v === 'on') return true; if (v === 'off') return false; } catch (err) { /* ignore */ }
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function saveMotion(v) { try { localStorage.setItem(MOTION_KEY, v ? 'on' : 'off'); } catch (err) { /* ignore */ } }
function kindOf(n) { return n.kind === 'capability' ? 'Capability' : (LABELS.category[n.ref.category] || 'Product'); }
function statusOf(p) { return LABELS.status[p.status] || p.status || ''; }
function caseHref(p) { return url(p.page || 'work/' + p.slug + '/'); }

export async function initSystemMap(mount) {
  if (!mount) return;
  if (typeof mount.__destroy === 'function') mount.__destroy();
  clear(mount);
  mount.appendChild(el('p', { class: 'map-loading' }, ['Loading the system map…']));

  let data;
  try { data = await loadManifest(); }
  catch (err) {
    clear(mount);
    mount.appendChild(el('div', { class: 'empty' }, [
      el('p', {}, [err.message]),
      el('button', { class: 'btn btn--primary', type: 'button', onClick: () => initSystemMap(mount) }, ['Retry']),
    ]));
    return;
  }

  const projects = getProjects(data);
  const caps = getCapabilities(data);
  const nodes = [];
  projects.forEach((p, i) => nodes.push({ id: 'p-' + p.slug, kind: 'project', ref: p, name: p.name, x: W * (i + 1) / (projects.length + 1), y: 86, r: 26 }));
  const rows = caps.length > 5 ? 2 : 1;
  const perRow = Math.ceil(caps.length / rows);
  caps.forEach((c, i) => {
    const row = Math.floor(i / perRow), col = i % perRow;
    const count = Math.min(perRow, caps.length - row * perRow);
    nodes.push({ id: 'c-' + c.id, kind: 'capability', ref: c, name: c.name, x: 60 + (W - 120) * (col + 0.5) / count, y: rows === 1 ? 330 : (row === 0 ? 300 : 396), r: 13 });
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges = [];
  projects.forEach((p) => {
    const from = byId.get('p-' + p.slug);
    (p.capabilities || []).forEach((id) => { const to = byId.get('c-' + id); if (from && to) edges.push({ from, to }); });
  });
  nodes.forEach((n) => { n.amp = 2 + Math.random(); n.period = 12000 + Math.random() * 8000; n.phase = Math.random() * Math.PI * 2; });

  const offs = [];
  let filter = 'all', active = null, motion = motionPref(), raf = 0, inView = true, visible = !document.hidden, dead = false, io = null;
  const passes = (n) => filter === 'all' || (filter === 'products' ? n.kind === 'project' : n.kind === 'capability');
  const shown = () => nodes.filter(passes);

  const edgeEls = edges.map((e) => sv('line', { class: 'map-edge', x1: e.from.x, y1: e.from.y, x2: e.to.x, y2: e.to.y }));
  const nodeEls = nodes.map((n) => {
    const g = sv('g', {
      class: 'map-node map-node--' + n.kind + (n.kind === 'project' ? ' map-node--' + (n.ref.status || 'live') : ''),
      transform: 'translate(' + n.x + ' ' + n.y + ')', id: 'mapnode-' + n.id,
      role: 'option', 'aria-selected': 'false',
      'aria-label': n.kind === 'capability' ? n.name + ', capability' : n.name + ', ' + kindOf(n).toLowerCase() + ', ' + statusOf(n.ref),
    }, [
      sv('circle', { class: 'map-node-ring', r: n.r + 7, fill: 'none' }),
      sv('circle', { class: 'map-node-core', r: n.r }),
      sv('circle', { class: 'map-node-dot', r: n.kind === 'project' ? 4 : 3 }),
      sv('text', { class: 'map-label', y: n.r + 18, 'text-anchor': 'middle' }, [n.name]),
    ]);
    n.g = g;
    offs.push(on(g, 'mouseenter', () => setActive(n)));
    offs.push(on(g, 'click', () => go(n)));
    return g;
  });

  const svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, focusable: 'false' }, [sv('g', {}, edgeEls), sv('g', {}, nodeEls)]);
  const canvas = el('div', {
    class: 'map-canvas', role: 'listbox', tabindex: '0',
    'aria-label': 'Studio system map. Arrow keys move between nodes, Enter opens, Escape clears.',
  }, [svg]);
  const stage = el('div', { class: 'map-stage' }, [canvas]);
  const card = el('div', { class: 'map-card', 'aria-live': 'polite' });

  function renderCard(n) {
    clear(card);
    if (!n) { card.appendChild(el('p', { class: 'map-card-hint' }, ['Hover a node, or focus the map and use the arrow keys.'])); return; }
    if (n.kind === 'project') {
      const p = n.ref, app = (p.links && p.links.app) || '';
      card.appendChild(el('p', { class: 'map-card-kind' }, [kindOf(n) + ' · ' + statusOf(p)]));
      card.appendChild(el('h3', {}, [p.name]));
      card.appendChild(el('p', {}, [p.tagline || '']));
      if ((p.stack || []).length) card.appendChild(el('div', { class: 'map-card-stack' }, p.stack.map((s) => el('span', { class: 'chip-stack' }, [s]))));
      card.appendChild(el('div', { class: 'btn-row' }, [
        el('a', { class: 'btn btn--primary btn--sm', href: caseHref(p) }, ['View case study']),
        app ? el('a', { class: 'btn btn--ghost btn--sm', href: app, target: '_blank', rel: 'noopener' }, ['Open app']) : null,
      ]));
    } else {
      card.appendChild(el('p', { class: 'map-card-kind' }, ['Capability']));
      card.appendChild(el('h3', {}, [n.name]));
      card.appendChild(el('p', {}, [n.ref.summary || '']));
      card.appendChild(el('button', { class: 'btn btn--ghost btn--sm', type: 'button', onClick: () => go(n) }, ['See capability']));
    }
  }

  function setActive(n) {
    active = n;
    const near = new Set([n.id]);
    edges.forEach((e) => { if (e.from === n) near.add(e.to.id); if (e.to === n) near.add(e.from.id); });
    root.classList.add('has-active');
    nodes.forEach((m) => {
      m.g.classList.toggle('is-active', m === n);
      m.g.classList.toggle('is-neighbor', m !== n && near.has(m.id));
      m.g.setAttribute('aria-selected', String(m === n));
    });
    edges.forEach((e, i) => edgeEls[i].classList.toggle('is-lit', e.from === n || e.to === n));
    canvas.setAttribute('aria-activedescendant', 'mapnode-' + n.id);
    renderCard(n);
  }
  function clearActive() {
    active = null;
    root.classList.remove('has-active');
    nodes.forEach((m) => { m.g.classList.remove('is-active', 'is-neighbor'); m.g.setAttribute('aria-selected', 'false'); });
    edgeEls.forEach((l) => l.classList.remove('is-lit'));
    canvas.removeAttribute('aria-activedescendant');
    renderCard(null);
  }
  function go(n) {
    if (n.kind === 'project') { location.href = caseHref(n.ref); return; }
    const row = document.getElementById('cap-' + (n.ref.anchor || n.ref.id));
    if (!row) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    row.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', '#' + row.id);
    row.classList.remove('is-flash');
    void row.offsetWidth;
    row.classList.add('is-flash');
    setTimeout(() => row.classList.remove('is-flash'), 1400);
  }

  offs.push(on(canvas, 'keydown', (e) => {
    const list = shown();
    if (!list.length) return;
    const i = active ? list.indexOf(active) : -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setActive(list[(i + 1) % list.length]); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setActive(list[(i - 1 + list.length) % list.length]); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(list[0]); }
    else if (e.key === 'End') { e.preventDefault(); setActive(list[list.length - 1]); }
    else if (e.key === 'Enter' || e.key === ' ') { if (active) { e.preventDefault(); go(active); } }
    else if (e.key === 'Escape') clearActive();
  }));
  offs.push(on(canvas, 'focus', () => { const l = shown(); if (!active && l.length) setActive(l[0]); }));
  offs.push(on(svg, 'mouseleave', () => { if (document.activeElement !== canvas) clearActive(); }));

  const listEl = el('ul', { class: 'map-list', role: 'list' });
  nodes.forEach((n) => {
    const meta = n.kind === 'project' ? kindOf(n) + ' · ' + statusOf(n.ref) : 'Capability';
    const desc = n.kind === 'project' ? (n.ref.tagline || '') : (n.ref.summary || '');
    const li = el('li', {}, [el('button', { class: 'map-list-item', type: 'button', onClick: () => go(n) }, [
      el('span', { class: 'map-list-name' }, [n.name]),
      el('span', { class: 'map-list-meta' }, [meta]),
      el('span', { class: 'map-list-desc' }, [desc]),
    ])]);
    n.li = li;
    listEl.appendChild(li);
  });

  const defs = [{ v: 'all', l: 'All' }, { v: 'products', l: 'Products' }, { v: 'capabilities', l: 'Capabilities' }];
  const chips = defs.map((d) => el('button', {
    class: 'chip', type: 'button', 'aria-pressed': String(filter === d.v),
    onClick: () => { filter = d.v; applyFilter(); },
  }, [d.l]));
  const motionChip = el('button', {
    class: 'chip', type: 'button', 'aria-pressed': String(motion),
    onClick: () => { motion = !motion; saveMotion(motion); syncMotion(); syncLoop(); },
  }, ['Motion: ' + (motion ? 'on' : 'off')]);
  function syncMotion() {
    motionChip.textContent = 'Motion: ' + (motion ? 'on' : 'off');
    motionChip.setAttribute('aria-pressed', String(motion));
    motionChip.classList.toggle('chip--active', motion);
  }
  const controls = el('div', { class: 'map-controls', role: 'group', 'aria-label': 'System map controls' }, [
    ...chips, motionChip,
    el('button', { class: 'btn btn--ghost btn--sm', type: 'button', onClick: () => { filter = 'all'; applyFilter(); clearActive(); } }, ['Reset view']),
  ]);

  function applyFilter() {
    nodes.forEach((n) => {
      const s = passes(n);
      n.g.classList.toggle('is-hidden', !s);
      n.g.setAttribute('aria-hidden', String(!s));
      n.li.hidden = !s;
    });
    edges.forEach((e, i) => edgeEls[i].classList.toggle('is-hidden', !(passes(e.from) && passes(e.to))));
    chips.forEach((c, i) => { const on = defs[i].v === filter; c.classList.toggle('chip--active', on); c.setAttribute('aria-pressed', String(on)); });
    if (active && !passes(active)) clearActive();
  }

  function reset() { nodes.forEach((n) => n.g.setAttribute('transform', 'translate(' + n.x + ' ' + n.y + ')')); }
  function frame(t) {
    raf = 0;
    if (dead || !motion || !inView || !visible) return;
    for (const n of nodes) {
      const w = (Math.PI * 2) / n.period;
      const dx = n.amp * Math.sin(t * w + n.phase);
      const dy = n.amp * Math.cos(t * w * 0.83 + n.phase * 1.7);
      n.g.setAttribute('transform', 'translate(' + (n.x + dx).toFixed(2) + ' ' + (n.y + dy).toFixed(2) + ')');
    }
    raf = requestAnimationFrame(frame);
  }
  function syncLoop() {
    const should = motion && inView && visible && !dead;
    if (should && !raf) raf = requestAnimationFrame(frame);
    if (!should && raf) { cancelAnimationFrame(raf); raf = 0; }
    if (!motion) reset();
  }
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver((es) => { inView = es[0].isIntersecting; syncLoop(); }, { threshold: 0.05 });
    io.observe(stage);
  }
  offs.push(on(document, 'visibilitychange', () => { visible = !document.hidden; syncLoop(); }));

  const root = el('div', { class: 'map' }, [stage, listEl, controls, card]);
  clear(mount);
  mount.appendChild(root);
  renderCard(null);
  applyFilter();
  syncMotion();
  syncLoop();

  mount.__destroy = () => {
    dead = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (io) io.disconnect();
    offs.forEach((f) => f());
    clear(mount);
  };
}

/* ============ Boot ============ */

function boot() {
  initBrand();
  renderChrome();
  fixCanonical();
  const map = document.getElementById('system-map');
  if (map) initSystemMap(map);
  loadManifest().then((data) => {
    const foot = qs('.site-footer');
    if (foot) { foot.replaceWith(buildFooter(data.projects)); refreshShell(); }
  }).catch(() => { /* footer keeps its fallback link */ });
  document.documentElement.classList.add('js');
}

try { boot(); }
catch (err) {
  document.documentElement.classList.remove('js');
  console.error('Studio runtime failed to start. Press F12 and report the first red line. Detail:', err);
}
