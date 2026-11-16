// LegendAlive Studio — shared long-form page engine.
// project.js and reader.js assemble the same shell: a page head, an optional
// notice, a measured prose column with a sticky TOC rail, and a footer nav.
// Chrome, meta and labels come from chrome.js. This module owns layout,
// loading and failure states, Markdown fetching and TOC tracking.

import { el, clear, on, copyText, toast } from './dom.js';
import { ensureStylesheet, refreshShell } from './shell.js';
import { buildNav, buildFooter } from './chrome.js';
import { renderMarkdown, extractToc } from './markdown.js';
import { url } from './config.js';

let tocOffs = [];

export function ensureProseStyles() {
  ensureStylesheet('ls-css-prose', 'assets/css/prose.css');
}

export function skeleton(label = 'Loading') {
  return el('div', { class: 'skeleton', 'aria-label': label }, [
    el('div', { class: 'skeleton-line skeleton-line--title' }),
    el('div', { class: 'skeleton-line' }),
    el('div', { class: 'skeleton-line' }),
    el('div', { class: 'skeleton-line skeleton-line--short' }),
  ]);
}

export function bootSkeleton(app, label = 'Loading') {
  clear(app);
  app.appendChild(el('div', { class: 'container section' }, [skeleton(label)]));
}

export function copyLinkButton() {
  return el('button', {
    class: 'btn btn--ghost', type: 'button',
    onClick: async () => {
      const ok = await copyText(location.href);
      toast(
        ok ? 'Link copied.' : 'Copy failed. Copy the address bar instead.',
        ok ? 'success' : 'danger'
      );
    },
  }, ['Copy link']);
}

export function errorBlock(message, { retry = null, backHref = '', backLabel = 'Back' } = {}) {
  return el('div', { class: 'empty' }, [
    el('p', {}, [message]),
    retry ? el('button', { class: 'btn btn--primary', type: 'button', onClick: retry }, ['Retry']) : null,
    backHref ? el('a', { class: 'btn btn--ghost', href: backHref }, [backLabel]) : null,
  ]);
}

// A complete page for a failure that happened before any content existed.
export function fatalPage({
  app, current = '', heading = 'Page', message,
  retry = null, backHref = '', backLabel = 'Back',
}) {
  clear(app);
  app.append(
    el('a', { class: 'skip-link', href: '#main' }, ['Skip to content']),
    buildNav(current),
    el('main', { id: 'main' }, [
      el('section', { class: 'page-head' }, [
        el('div', { class: 'container' }, [el('h1', {}, [heading])]),
      ]),
      el('section', { class: 'section' }, [
        el('div', { class: 'container narrow' }, [
          errorBlock(message, { retry, backHref, backLabel }),
        ]),
      ]),
    ]),
    buildFooter([]),
  );
  refreshShell();
}

// Assembles the full long-form page and returns the parts the caller fills.
export function renderLongForm({
  app, current = '', projects = [], head = [], notice = null, nav = null,
}) {
  const prose = el('div', { class: 'prose' }, [skeleton('Loading')]);
  const rail = el('aside', { class: 'rail', 'aria-label': 'On this page' });
  const grid = el('div', { class: 'content-grid', style: { paddingBottom: '48px' } }, [
    el('div', { class: 'content-main' }, [prose]),
    rail,
  ]);

  const main = el('main', { id: 'main' }, [
    el('section', { class: 'page-head' }, [
      el('div', { class: 'container' }, [].concat(head)),
    ]),
    notice
      ? el('div', { class: 'container', style: { paddingTop: '32px' } }, [notice])
      : null,
    el('section', {}, [el('div', { class: 'container' }, [grid])]),
    nav ? el('div', { class: 'container' }, [nav]) : null,
  ]);

  clear(app);
  app.append(
    el('a', { class: 'skip-link', href: '#main' }, ['Skip to content']),
    buildNav(current),
    main,
    buildFooter(projects),
  );
  refreshShell();
  return { prose, rail, grid };
}

/* ---------- Markdown fetch ---------- */

export async function fetchMarkdown(path, label = 'document') {
  let res;
  try {
    res = await fetch(url(path), { cache: 'no-cache' });
  } catch (err) {
    throw new Error('Could not reach the ' + label + '. Check your connection, then retry.');
  }
  if (!res.ok) {
    throw new Error(
      'The ' + label + ' returned HTTP ' + res.status + '. Confirm ' + path +
      ' exists on main and the Pages deploy is green, then retry.'
    );
  }
  const text = await res.text();
  const head = text.trimStart().slice(0, 200).toLowerCase();
  if (head.startsWith('<!doctype') || head.startsWith('<html')) {
    throw new Error(
      'The ' + label + ' came back as HTML instead of Markdown. Check the latest Pages deploy. ' +
      'If it persists, rename content files to .txt and update CONTENT_EXT in config.js.'
    );
  }
  return text;
}

/* ---------- Table of contents ---------- */

export function clearToc() {
  tocOffs.forEach((off) => off());
  tocOffs = [];
}

export function initToc(prose, rail, grid) {
  clearToc();
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
  rail.appendChild(el('a', { class: 'text-link', href: '#main' }, ['Back to top']));

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

/* ---------- Fetch, render, track ---------- */

export async function loadBody(opts) {
  const {
    path, label = 'document', prose, rail, grid,
    backHref = '', backLabel = 'Back', onRendered,
  } = opts;

  clearToc();
  clear(prose);
  prose.appendChild(skeleton('Loading ' + label));
  clear(rail);
  grid.classList.add('no-rail');

  try {
    const text = await fetchMarkdown(path, label);
    clear(prose);
    prose.appendChild(renderMarkdown(text));
    initToc(prose, rail, grid);
    if (typeof onRendered === 'function') onRendered(text);
    return text;
  } catch (err) {
    clear(prose);
    prose.appendChild(errorBlock(
      err && err.message ? err.message : 'The ' + label + ' could not be loaded. Retry, or use the link below.',
      { retry: () => loadBody(opts), backHref, backLabel },
    ));
    return '';
  }
}
