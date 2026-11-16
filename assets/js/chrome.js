// LegendAlive Studio — shared chrome: navigation, footer, labels, page meta.
// Every internal href is built from BASE through url(), so page depth and the
// domain cutover are handled in one place. Pages declare which nav item is
// current; shell.js defers its own route marking when data-current is present.

import { SITE, OWNER, LINKS, url } from './config.js';
import { el, qs, qsa } from './dom.js';
import { refreshShell } from './shell.js';

/* ---------- Labels: one source for every page and module ---------- */

export const LABELS = {
  status: {
    live: 'Live',
    building: 'In development',
    lab: 'Experiment',
    paused: 'Paused',
  },
  statusSentence: {
    live: 'Live.',
    building: 'In development.',
    lab: 'In the lab.',
    paused: 'Paused.',
  },
  category: {
    product: 'Product',
    tool: 'Developer tool',
    experiment: 'Experiment',
    client: 'Client work',
  },
  kind: {
    engineering: 'Engineering',
    design: 'Design',
    decision: 'Decision',
    note: 'Note',
    release: 'Release',
  },
};

/* ---------- Navigation definition ---------- */

const NAV = [
  { key: 'work', label: 'Work', path: 'work/' },
  { key: 'writing', label: 'Writing', path: 'writing/' },
  { key: 'capabilities', label: 'Capabilities', path: '', hash: 'capabilities' },
  { key: 'about', label: 'The developer', path: 'about/' },
  { key: 'contact', label: 'Contact', path: '', hash: 'contact' },
  { key: 'github', label: 'GitHub', external: true },
];

function navHref(item) {
  if (item.external) return OWNER.githubUrl;
  return url(item.path || '') + (item.hash ? '#' + item.hash : '');
}

function navAnchor(item, current) {
  return el('a', {
    href: navHref(item),
    'aria-current': item.key === current ? 'true' : null,
    target: item.external ? '_blank' : null,
    rel: item.external ? 'noopener' : null,
  }, [item.label]);
}

export function buildNav(current = '') {
  return el('header', { class: 'site-nav', 'data-nav': true, 'data-current': current }, [
    el('div', { class: 'container nav-bar' }, [
      el('a', { class: 'nav-brand', href: url(''), 'aria-label': SITE.name + ', home' }, [
        el('span', { class: 'studio-mark studio-mark--sm', 'aria-hidden': 'true' }),
        el('span', {}, [SITE.name]),
      ]),
      el('nav', { class: 'nav-links', 'aria-label': 'Primary' },
        NAV.map((item) => navAnchor(item, current))),
      el('button', {
        class: 'nav-toggle', type: 'button', 'data-nav-toggle': true,
        'aria-expanded': 'false', 'aria-controls': 'nav-sheet', 'aria-label': 'Menu',
      }, [el('span', { class: 'nav-toggle-bars', 'aria-hidden': 'true' })]),
    ]),
    el('nav', {
      class: 'nav-sheet', id: 'nav-sheet', 'data-nav-sheet': true, 'aria-label': 'Mobile',
    }, [
      ...NAV.map((item) => navAnchor(item, current)),
      el('span', { class: 'nav-sheet-note' }, [SITE.name]),
    ]),
  ]);
}

/* ---------- Footer ---------- */

function footerCol(label, items) {
  return el('nav', { class: 'footer-col', 'aria-label': label }, [
    el('h3', {}, [label]),
    el('ul', { role: 'list' }, items.map((item) => el('li', {}, [
      el('a', {
        href: item.href,
        target: item.external ? '_blank' : null,
        rel: item.external ? 'noopener' : null,
      }, [item.label]),
    ]))),
  ]);
}

export function buildFooter(projects = []) {
  const productItems = (projects || []).map((p) => ({
    label: p.name,
    href: url(p.page || ('work/' + p.slug + '/')),
  }));
  if (!productItems.length) productItems.push({ label: 'All work', href: url('work/') });

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
        footerCol('Products', productItems),
        footerCol('Elsewhere', [
          { label: 'GitHub profile', href: OWNER.githubUrl, external: true },
          { label: 'Email', href: 'mailto:' + OWNER.email },
          { label: "This site's source", href: LINKS.studioRepo, external: true },
        ]),
      ]),
      el('div', { class: 'footer-bottom' }, [
        el('span', {}, ['© ', el('span', { 'data-year': true }, ['2026']), ' ', OWNER.name]),
      ]),
    ]),
  ]);
}

/* ---------- Mount into page placeholders ---------- */

// Static pages carry <div data-chrome-nav> and <div data-chrome-footer>,
// each holding a <noscript> fallback. renderChrome replaces them and rebinds
// the shell so nav state, scrollspy and the footer year attach to real nodes.
export function renderChrome({ current = '', projects = [] } = {}) {
  const navMount = qs('[data-chrome-nav]');
  if (navMount) navMount.replaceWith(buildNav(current));
  const footMount = qs('[data-chrome-footer]');
  if (footMount) footMount.replaceWith(buildFooter(projects));
  refreshShell();
}

/* ---------- Page meta, all derived from BASE ---------- */

export function absoluteUrl(path = '') {
  return location.origin + url(path);
}

function upsertMeta(attr, key, content) {
  let node = document.head.querySelector('meta[' + attr + '="' + key + '"]');
  if (!node) {
    node = el('meta', { [attr]: key });
    document.head.appendChild(node);
  }
  node.setAttribute('content', content);
}

function upsertCanonical(href) {
  let node = document.head.querySelector('link[rel="canonical"]');
  if (!node) {
    node = el('link', { rel: 'canonical' });
    document.head.appendChild(node);
  }
  node.setAttribute('href', href);
}

// applyMeta({ title, description, path, type, robots, published, modified,
//             tags, jsonLd, ogTitle })
// path is BASE-relative ('work/weaver/'), so canonical and og:url follow the
// domain cutover without any page being edited.
export function applyMeta(opts = {}) {
  const {
    title = '',
    ogTitle = '',
    description = '',
    path = '',
    type = 'website',
    robots = 'index, follow',
    published = '',
    modified = '',
    tags = [],
    jsonLd = null,
  } = opts;

  const desc = description || SITE.description;
  const social = ogTitle || title || SITE.name;
  const canonical = absoluteUrl(path);

  if (title) document.title = title;
  upsertMeta('name', 'description', desc);
  upsertMeta('name', 'robots', robots);
  upsertCanonical(canonical);
  upsertMeta('property', 'og:type', type);
  upsertMeta('property', 'og:site_name', SITE.name);
  upsertMeta('property', 'og:title', social);
  upsertMeta('property', 'og:description', desc);
  upsertMeta('property', 'og:url', canonical);
  upsertMeta('name', 'twitter:card', 'summary');
  upsertMeta('name', 'twitter:title', social);
  upsertMeta('name', 'twitter:description', desc);

  if (published) upsertMeta('property', 'article:published_time', published);
  if (modified) upsertMeta('property', 'article:modified_time', modified);
  qsa('meta[property="article:tag"]').forEach((n) => n.remove());
  (tags || []).forEach((t) => {
    document.head.appendChild(el('meta', { property: 'article:tag', content: String(t) }));
  });

  qsa('script[data-ls-jsonld]').forEach((n) => n.remove());
  if (jsonLd) {
    const script = el('script', { type: 'application/ld+json', 'data-ls-jsonld': true });
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);
  }
}
