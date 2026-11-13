// Repo: studio — assets/js/project.js — NEW FILE
// Shared reader for Markdown-driven project case studies (plan S6).
// A stub at work/<slug>/index.html sets window.__PROJECT_SLUG__ and loads
// this module. Everything else comes from content/index.json and the
// project's Markdown body: chrome, meta, prose, TOC, error states.
// Weaver keeps its hand-authored page; every other project uses this.

import { SITE, OWNER, LINKS, url } from './config.js';
import { el, clear, qsa, on, copyText, toast } from './dom.js';
import { ensureStylesheet, refreshShell } from './shell.js';
import { loadManifest, findBySlug } from './manifest.js';
import { renderMarkdown, extractToc } from './markdown.js';

const app = document.getElementById('app');
const slug = String(window.__PROJECT_SLUG__ || '');
const STATUS = { live: 'Live', building: 'In development', lab: 'Experiment', paused: 'Paused' };
let tocOffs = [];

/* ---------- Meta ---------- */

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

function applySeo(project, canonical) {
  document.title = project.name + ' — Case study — LegendAlive Studio';
  const desc = project.tagline || SITE.description;
  upsertMeta('name', 'description', desc);
  upsertMeta('name', 'robots', 'index, follow');
  upsertCanonical(canonical);
  upsertMeta('property', 'og:type', 'article');
  upsertMeta('property', 'og:site_name', SITE.name);
  upsertMeta('property', 'og:title', document.title);
  upsertMeta('property', 'og:description', desc);
  upsertMeta('property', 'og:url', canonical);
  upsertMeta('name', 'twitter:card', 'summary');
  upsertMeta('name', 'twitter:title', document.title);
  upsertMeta('name', 'twitter:description', desc);

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: project.name,
    description: desc,
    operatingSystem: 'Any',
    url: (project.links && project.links.app) || canonical,
  };
  if (project.category === 'tool') ld.applicationCategory = 'DeveloperApplication';
  const script = el('script', { type: 'application/ld+json' });
  script.textContent = JSON.stringify(ld);
  document.head.appendChild(script);
}

/* ---------- Chrome ---------- */

function navDefs() {
  return [
    { href: url(''), label: 'Home' },
    { href: url('work/'), label: 'Work', work: true },
    { href: url('') + '#capabilities', label: 'Capabilities' },
    { href: url('') + '#developer', label: 'The developer' },
    { href: url('') + '#contact', label: 'Contact' },
    { href: OWNER.githubUrl, label: 'GitHub', external: true },
  ];
}

function navAnchor(l) {
  return el('a', {
    href: l.href,
    target: l.external ? '_blank' : null,
    rel: l.external ? 'noopener' : null,
  }, [l.label]);
}

function buildNav() {
  const links = navDefs();
  return el('header', { class: 'site-nav', 'data-nav': true }, [
    el('div', { class: 'container nav-bar' }, [
      el('a', { class: 'nav-brand', href: url(''), 'aria-label': 'LegendAlive Studio, home' }, [
        el('span', { class: 'studio-mark studio-mark--sm', 'aria-hidden': 'true' }),
        el('span', {}, ['LegendAlive Studio']),
      ]),
      el('nav', { class: 'nav-links', 'aria-label': 'Primary' }, links.map(navAnchor)),
      el('button', {
        class: 'nav-toggle', type: 'button', 'data-nav-toggle': true,
        'aria-expanded': 'false', 'aria-controls': 'nav-sheet', 'aria-label': 'Menu',
      }, [el('span', { class: 'nav-toggle-bars', 'aria-hidden': 'true' })]),
    ]),
    el('nav', { class: 'nav-sheet', id: 'nav-sheet', 'data-nav-sheet': true, 'aria-label': 'Mobile' }, [
      ...links.map(navAnchor),
      el('span', { class: 'nav-sheet-note' }, ['LegendAlive Studio']),
    ]),
  ]);
}

function buildFooter(projects) {
  const productLinks = (projects || [])
    .filter((p) => p.links && p.links.app)
    .map((p) => el('li', {}, [
      el('a', { href: p.links.app, target: '_blank', rel: 'noopener' }, [p.name]),
    ]));

  return el('footer', { class: 'site-footer' }, [
    el('div', { class: 'container' }, [
      el('div', { class: 'footer-grid' }, [
        el('div', { class: 'footer-brand' }, [
          el('span', { class: 'studio-mark studio-mark--md', 'aria-hidden': 'true' }),
          el('span', { class: 'footer-brand-name' }, [SITE.name]),
          el('p', { class: 'footer-tagline' }, [SITE.tagline]),
        ]),
        el('nav', { class: 'footer-col', 'aria-label': 'Studio' }, [
          el('h3', {}, ['Studio']),
          el('ul', { role: 'list' }, [
            el('li', {}, [el('a', { href: url('') }, ['Home'])]),
            el('li', {}, [el('a', { href: url('work/') }, ['Work'])]),
            el('li', {}, [el('a', { href: url('') + '#contact' }, ['Contact'])]),
          ]),
        ]),
        el('nav', { class: 'footer-col', 'aria-label': 'Products' }, [
          el('h3', {}, ['Products']),
          el('ul', { role: 'list' }, productLinks),
        ]),
        el('nav', { class: 'footer-col', 'aria-label': 'Elsewhere' }, [
          el('h3', {}, ['Elsewhere']),
          el('ul', { role: 'list' }, [
            el('li', {}, [el('a', { href: OWNER.githubUrl, target: '_blank', rel: 'noopener' }, ['GitHub profile'])]),
            el('li', {}, [el('a', { href: 'mailto:' + OWNER.email }, ['Email'])]),
            el('li', {}, [el('a', { href: LINKS.studioRepo, target: '_blank', rel: 'noopener' }, ["This site's source"]) ]),
          ]),
        ]),
      ]),
      el('div', { class: 'footer-bottom' }, [
        el('span', {}, ['© ', el('span', { 'data-year': true }, ['2026']), ' Benson Mtsotso']),
      ]),
    ]),
  ]);
}

function markWorkCurrent() {
  qsa('[data-nav] a').forEach((a) => {
    if (a.getAttribute('href') === url('work/')) a.setAttribute('aria-current', 'true');
  });
}

/* ---------- States ---------- */

function skeleton() {
  return el('div', { class: 'skeleton', 'aria-label': 'Loading case study' }, [
    el('div', { class: 'skeleton-line skeleton-line--title' }),
    el('div', { class: 'skeleton-line' }),
    el('div', { class: 'skeleton-line' }),
    el('div', { class: 'skeleton-line skeleton-line--short' }),
  ]);
}

function errorBlock(message, retry) {
  return el('div', { class: 'empty' }, [
    el('p', {}, [message]),
    retry ? el('button', { class: 'btn btn--primary', type: 'button', onClick: retry }, ['Retry']) : null,
    el('a', { class: 'btn btn--ghost', href: url('work/') }, ['Back to work']),
  ]);
}

function renderFatal(message, retry) {
  clear(app);
  app.append(
    el('a', { class: 'skip-link', href: '#main' }, ['Skip to content']),
    buildNav(),
    el('main', { id: 'main' }, [
      el('section', { class: 'page-head' }, [
        el('div', { class: 'container' }, [el('h1', {}, ['Case study'])]),
      ]),
      el('section', { class: 'section' }, [
        el('div', { class: 'container narrow' }, [errorBlock(message, retry)]),
      ]),
    ]),
    buildFooter([]),
  );
  refreshShell();
  markWorkCurrent();
}

/* ---------- Page ---------- */

function buildPage(project, data) {
  const links = project.links || {};
  const actions = [];
  if (links.app) actions.push(el('a', { class: 'btn btn--primary', href: links.app, target: '_blank', rel: 'noopener' }, ['Open app']));
  if (links.source) actions.push(el('a', { class: 'btn btn--ghost', href: links.source, target: '_blank', rel: 'noopener' }, ['Source code']));
  if (links.site) actions.push(el('a', { class: 'btn btn--ghost', href: links.site, target: '_blank', rel: 'noopener' }, ['Product site']));
  if (links.pricing) actions.push(el('a', { class: 'btn btn--ghost', href: links.pricing, target: '_blank', rel: 'noopener' }, ['Pricing']));
  actions.push(el('button', {
    class: 'btn btn--ghost', type: 'button',
    onClick: async () => {
      const ok = await copyText(location.href);
      toast(ok ? 'Link copied.' : 'Copy failed. Copy the address bar instead.', ok ? 'success' : 'danger');
    },
  }, ['Copy link']));

  const prose = el('div', { class: 'prose' }, [skeleton()]);
  const rail = el('aside', { class: 'rail', 'aria-label': 'On this page' });
  const grid = el('div', { class: 'content-grid' }, [
    el('div', { class: 'content-main' }, [prose]),
    rail,
  ]);

  const main = el('main', { id: 'main' }, [
    el('section', { class: 'page-head' }, [
      el('div', { class: 'container' }, [
        el('h1', {}, [project.name]),
        el('p', { class: 'lede' }, [project.tagline || '']),
        el('div', { class: 'page-head-meta' }, [
          el('span', {}, [String(project.year || '')]),
          el('span', {}, [project.category || 'project']),
          el('span', {}, [STATUS[project.status] || project.status || '']),
        ]),
        el('div', { class: 'pill-row', style: { marginTop: '16px' } },
          (project.stack || []).map((s) => el('span', { class: 'chip-stack' }, [s]))),
        el('div', { class: 'btn-row', style: { marginTop: '24px' } }, actions),
      ]),
    ]),
    el('section', { class: 'project-body' }, [
      el('div', { class: 'container' }, [grid]),
    ]),
    el('div', { class: 'container' }, [
      el('nav', { class: 'case-nav', 'aria-label': 'More work' }, [
        el('a', { class: 'text-link', href: url('work/') }, ['Back to all work']),
        el('a', { class: 'text-link', href: url('') }, ['Home']),
      ]),
    ]),
  ]);

  clear(app);
  app.append(
    el('a', { class: 'skip-link', href: '#main' }, ['Skip to content']),
    buildNav(),
    main,
    buildFooter(data.projects),
  );
  return { prose, rail, grid };
}

/* ---------- Body fetch and TOC ---------- */

async function fetchBody(path) {
  let res;
  try {
    res = await fetch(url('content/' + path), { cache: 'no-cache' });
  } catch (err) {
    throw new Error('Could not reach the case study body. Check your connection, then retry.');
  }
  if (!res.ok) {
    throw new Error(
      'The case study body returned HTTP ' + res.status +
      '. Confirm content/' + path + ' exists on main and the Pages deploy is green, then retry.'
    );
  }
  const text = await res.text();
  const head = text.trimStart().slice(0, 200).toLowerCase();
  if (head.startsWith('<!doctype') || head.startsWith('<html')) {
    throw new Error(
      'The case study body came back as HTML instead of Markdown. Check the latest Pages deploy. ' +
      'If it persists, rename the file to .txt and update CONTENT_EXT in config.js.'
    );
  }
  return text;
}

function initToc(prose, rail, grid) {
  tocOffs.forEach((off) => off());
  tocOffs = [];
  const items = extractToc(prose);
  clear(rail);
  if (items.length < 2) {
    grid.classList.add('no-rail');
    return;
  }
  grid.classList.remove('no-rail');

  const links = new Map();
  const toc = el('nav', { class: 'toc', 'aria-label': 'On this page' }, [
    el('p', { class: 'toc-title' }, ['On this page']),
    ...items.map((it) => {
      const a = el('a', { href: '#' + it.id, class: it.level === 3 ? 'toc-h3' : '' }, [it.text]);
      links.set(it.id, a);
      return a;
    }),
  ]);
  rail.appendChild(toc);

  const headings = items.map((it) => document.getElementById(it.id)).filter(Boolean);
  let active = '';
  let ticking = false;
  const update = () => {
    let cur = headings.length ? headings[0].id : '';
    for (const h of headings) {
      if (h.getBoundingClientRect().top <= 96) cur = h.id;
    }
    if (cur !== active) {
      active = cur;
      links.forEach((a, id) => a.classList.toggle('is-active', id === cur));
    }
  };
  tocOffs.push(on(window, 'scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { update(); ticking = false; });
  }, { passive: true }));
  tocOffs.push(on(window, 'resize', update));
  update();
}

async function loadBody(project, prose, rail, grid) {
  clear(prose);
  prose.appendChild(skeleton());
  clear(rail);
  grid.classList.add('no-rail');
  try {
    const text = await fetchBody(project.body);
    clear(prose);
    prose.appendChild(renderMarkdown(text));
    initToc(prose, rail, grid);
  } catch (err) {
    clear(prose);
    prose.appendChild(errorBlock(
      err && err.message ? err.message : 'The case study body could not be loaded. Retry or head back to the work index.',
      () => loadBody(project, prose, rail, grid),
    ));
  }
}

/* ---------- Boot ---------- */

async function start() {
  ensureStylesheet('ls-css-prose', 'assets/css/prose.css');
  if (!app) return;

  if (!slug) {
    renderFatal('This page did not receive a project slug. Open the work index and choose a project.');
    return;
  }

  clear(app);
  app.appendChild(el('div', { class: 'container section' }, [skeleton()]));

  let data;
  try {
    data = await loadManifest();
  } catch (err) {
    renderFatal(err && err.message ? err.message : 'The content manifest could not be loaded. Check your connection, then retry.', () => start());
    return;
  }

  const project = findBySlug(data.projects, slug);
  if (!project) {
    renderFatal('No project with slug "' + slug + '" is in the manifest. It may have been renamed. Open the work index to find it.');
    return;
  }

  const canonical = location.origin + url('work/' + project.slug + '/');
  applySeo(project, canonical);
  const { prose, rail, grid } = buildPage(project, data);
  refreshShell();
  markWorkCurrent();

  if (!project.body) {
    clear(prose);
    grid.classList.add('no-rail');
    prose.appendChild(el('p', {}, [project.tagline || 'This project has no long-form body yet.']));
    return;
  }
  await loadBody(project, prose, rail, grid);
}

start();
