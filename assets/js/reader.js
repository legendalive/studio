// Repo: studio — assets/js/reader.js — NEW FILE
// LegendAlive Studio — the article reader (plan 9.5).
// A stub at p/<slug>/index.html sets window.__POST_SLUG__ and loads this
// module. Metadata comes from content/index.json; prose comes from
// content/posts/<slug> + CONTENT_EXT. Drafts render as noindex previews.

import { SITE, OWNER, LINKS, url, CONTENT_EXT } from './config.js';
import { el, clear, qsa, on, copyText, toast } from './dom.js';
import { ensureStylesheet, refreshShell } from './shell.js';
import { loadManifest, getPosts, findBySlug, formatDate } from './manifest.js';
import { renderMarkdown, extractToc, countWords } from './markdown.js';

const app = document.getElementById('app');
const slug = String(window.__POST_SLUG__ || '');
const WORDS_PER_MINUTE = 220;
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

function applySeo(post, canonical) {
  const desc = post.dek || SITE.description;
  document.title = (post.draft ? 'Draft — ' : '') + post.title + ' — LegendAlive Studio';
  upsertMeta('name', 'description', desc);
  upsertMeta('name', 'robots', post.draft ? 'noindex, nofollow' : 'index, follow');
  upsertCanonical(canonical);
  upsertMeta('property', 'og:type', 'article');
  upsertMeta('property', 'og:site_name', SITE.name);
  upsertMeta('property', 'og:title', post.title);
  upsertMeta('property', 'og:description', desc);
  upsertMeta('property', 'og:url', canonical);
  upsertMeta('name', 'twitter:card', 'summary');
  upsertMeta('name', 'twitter:title', post.title);
  upsertMeta('name', 'twitter:description', desc);
  upsertMeta('property', 'article:published_time', post.date || '');
  upsertMeta('property', 'article:modified_time', post.updated || post.date || '');

  qsa('meta[property="article:tag"]').forEach((n) => n.remove());
  (post.tags || []).forEach((t) => {
    document.head.appendChild(el('meta', { property: 'article:tag', content: String(t) }));
  });

  if (post.draft) return;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: desc,
    datePublished: post.date || '',
    dateModified: post.updated || post.date || '',
    inLanguage: 'en',
    keywords: (post.tags || []).join(', '),
    author: { '@type': 'Person', name: OWNER.name, url: location.origin + url('about/') },
    publisher: { '@type': 'Organization', name: SITE.name },
    mainEntityOfPage: canonical,
  };
  const script = el('script', { type: 'application/ld+json' });
  script.textContent = JSON.stringify(ld);
  document.head.appendChild(script);
}

/* ---------- Chrome ---------- */

function navDefs() {
  return [
    { href: url(''), label: 'Home' },
    { href: url('work/'), label: 'Work' },
    { href: url('writing/'), label: 'Writing', writing: true },
    { href: url('about/'), label: 'The developer' },
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
            el('li', {}, [el('a', { href: url('writing/') }, ['Writing'])]),
            el('li', {}, [el('a', { href: url('about/') }, ['The developer'])]),
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
            el('li', {}, [el('a', { href: LINKS.studioRepo, target: '_blank', rel: 'noopener' }, ["This site's source"])]),
          ]),
        ]),
      ]),
      el('div', { class: 'footer-bottom' }, [
        el('span', {}, ['© ', el('span', { 'data-year': true }, ['2026']), ' Benson Mtsotso']),
      ]),
    ]),
  ]);
}

function markWritingCurrent() {
  qsa('[data-nav] a').forEach((a) => {
    if (a.getAttribute('href') === url('writing/')) a.setAttribute('aria-current', 'true');
  });
}

/* ---------- States ---------- */

function skeleton() {
  return el('div', { class: 'skeleton', 'aria-label': 'Loading article' }, [
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
    el('a', { class: 'btn btn--ghost', href: url('writing/') }, ['Back to writing']),
  ]);
}

function renderFatal(message, retry) {
  clear(app);
  app.append(
    el('a', { class: 'skip-link', href: '#main' }, ['Skip to content']),
    buildNav(),
    el('main', { id: 'main' }, [
      el('section', { class: 'page-head' }, [
        el('div', { class: 'container' }, [el('h1', {}, ['Article'])]),
      ]),
      el('section', { class: 'section' }, [
        el('div', { class: 'container narrow' }, [errorBlock(message, retry)]),
      ]),
    ]),
    buildFooter([]),
  );
  refreshShell();
  markWritingCurrent();
}

/* ---------- Page ---------- */

function buildPage(post, data) {
  const published = getPosts(data);
  const idx = published.findIndex((p) => p.slug === post.slug);
  const newer = idx > 0 ? published[idx - 1] : null;
  const older = idx >= 0 && idx < published.length - 1 ? published[idx + 1] : null;

  const readTime = el('span', {}, [(post.minutes || 1) + ' min read']);
  const prose = el('div', { class: 'prose' }, [skeleton()]);
  const rail = el('aside', { class: 'rail', 'aria-label': 'On this page' });
  const grid = el('div', { class: 'content-grid', style: { paddingBottom: '48px' } }, [
    el('div', { class: 'content-main' }, [prose]),
    rail,
  ]);

  const metaRow = el('div', { class: 'post-meta' }, [
    el('span', { class: 'chip-kind' }, [post.kind || 'note']),
    el('span', {}, [formatDate(post.date)]),
    post.updated ? el('span', {}, ['Updated ' + formatDate(post.updated)]) : null,
    readTime,
  ]);

  const main = el('main', { id: 'main' }, [
    el('section', { class: 'page-head' }, [
      el('div', { class: 'container' }, [
        metaRow,
        el('h1', { style: { maxWidth: '32ch', marginTop: '16px' } }, [post.title]),
        el('p', { class: 'lede' }, [post.dek || '']),
        el('div', { class: 'post-tags', style: { marginTop: '16px' } },
          (post.tags || []).map((t) => el('span', { class: 'tag' }, [t]))),
        el('div', { class: 'btn-row', style: { marginTop: '24px' } }, [
          el('button', {
            class: 'btn btn--ghost', type: 'button',
            onClick: async () => {
              const ok = await copyText(location.href);
              toast(ok ? 'Link copied.' : 'Copy failed. Copy the address bar instead.', ok ? 'success' : 'danger');
            },
          }, ['Copy link']),
          el('a', { class: 'btn btn--ghost', href: url('writing/') }, ['All writing']),
        ]),
      ]),
    ]),
    post.draft
      ? el('div', { class: 'container', style: { paddingTop: '32px' } }, [
          el('div', { class: 'callout callout--warn', style: { maxWidth: '68ch' } }, [
            el('span', { class: 'callout-label' }, ['Draft preview']),
            el('div', { class: 'callout-body' }, [
              el('p', {}, [
                'This article is not published. It is absent from the writing index, the home page and the sitemap, and search engines are told not to index it. Review it here, then publish it by clearing the draft flag in the manifest.',
              ]),
            ]),
          ]),
        ])
      : null,
    el('section', {}, [el('div', { class: 'container' }, [grid])]),
    el('div', { class: 'container' }, [
      el('nav', { class: 'case-nav', 'aria-label': 'More writing' }, [
        older
          ? el('a', { class: 'text-link', style: { maxWidth: '34ch' }, href: url('p/' + older.slug + '/') }, ['← ', older.title])
          : el('span'),
        el('a', { class: 'text-link', href: url('writing/') }, ['All writing']),
        newer
          ? el('a', { class: 'text-link', style: { maxWidth: '34ch' }, href: url('p/' + newer.slug + '/') }, [newer.title, ' →'])
          : el('span'),
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
  return { prose, rail, grid, readTime };
}

/* ---------- Body and TOC ---------- */

async function fetchBody(postSlug) {
  const path = 'content/posts/' + postSlug + CONTENT_EXT;
  let res;
  try {
    res = await fetch(url(path), { cache: 'no-cache' });
  } catch (err) {
    throw new Error('Could not reach the article. Check your connection, then retry.');
  }
  if (!res.ok) {
    throw new Error(
      'The article returned HTTP ' + res.status + '. Confirm ' + path +
      ' exists on main and the Pages deploy is green, then retry.'
    );
  }
  const text = await res.text();
  const head = text.trimStart().slice(0, 200).toLowerCase();
  if (head.startsWith('<!doctype') || head.startsWith('<html')) {
    throw new Error(
      'The article came back as HTML instead of Markdown. Check the latest Pages deploy. ' +
      'If it persists, rename content files to .txt and update CONTENT_EXT in config.js.'
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
  rail.appendChild(el('nav', { class: 'toc', 'aria-label': 'On this page' }, [
    el('p', { class: 'toc-title' }, ['On this page']),
    ...items.map((it) => {
      const a = el('a', { href: '#' + it.id, class: it.level === 3 ? 'toc-h3' : '' }, [it.text]);
      links.set(it.id, a);
      return a;
    }),
  ]));

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

async function loadBody(post, parts) {
  const { prose, rail, grid, readTime } = parts;
  clear(prose);
  prose.appendChild(skeleton());
  clear(rail);
  grid.classList.add('no-rail');
  try {
    const text = await fetchBody(post.slug);
    clear(prose);
    prose.appendChild(renderMarkdown(text));
    const minutes = Math.max(1, Math.round(countWords(text) / WORDS_PER_MINUTE));
    readTime.textContent = minutes + ' min read';
    initToc(prose, rail, grid);
  } catch (err) {
    clear(prose);
    prose.appendChild(errorBlock(
      err && err.message ? err.message : 'The article could not be loaded. Retry or head back to the writing index.',
      () => loadBody(post, parts),
    ));
  }
}

/* ---------- Boot ---------- */

async function start() {
  ensureStylesheet('ls-css-prose', 'assets/css/prose.css');
  if (!app) return;

  if (!slug) {
    renderFatal('This page did not receive an article slug. Open the writing index and choose an article.');
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

  const post = findBySlug(data.posts, slug);
  if (!post) {
    renderFatal('No article with slug "' + slug + '" is in the manifest. It may have been renamed. Open the writing index to find it.');
    return;
  }

  applySeo(post, location.origin + url('p/' + post.slug + '/'));
  const parts = buildPage(post, data);
  refreshShell();
  markWritingCurrent();
  await loadBody(post, parts);
}

start();
