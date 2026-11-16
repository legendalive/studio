// LegendAlive Studio — long-form reader. Projects and articles, one module.
// A stub sets window.__PROJECT_SLUG__ or window.__POST_SLUG__ and loads this.
// app.js arrives as a dependency and boots the shared shell. Everything here
// is the Markdown renderer, the long-form layout, and the two page boots.

import {
  SITE, OWNER, CONTENT_EXT, LABELS, url, absoluteUrl,
  el, clear, qsa, on, copyText, toast,
  applyMeta, buildNav, buildFooter, refreshShell,
  loadManifest, getPosts, findBySlug, formatDate,
} from './app.js';

const app = document.getElementById('app');
const projectSlug = String(window.__PROJECT_SLUG__ || '');
const postSlug = String(window.__POST_SLUG__ || '');
const WORDS_PER_MINUTE = 220;
let tocOffs = [];

/* ============================================================
   Markdown → DOM. Escape first, then build tags deliberately.
   ============================================================ */

function slugify(text) {
  return String(text || '').toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, '')
    .trim().replace(/[\s-]+/g, '-').replace(/^-+|-+$/g, '') || 'section';
}

function countWords(source) {
  const text = String(source || '')
    .replace(/```[\s\S]*?```/g, ' ').replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|]/g, ' ').replace(/:::[a-z]*/gi, ' ');
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function extractToc(root) {
  return Array.from(root.querySelectorAll('h2, h3')).map((h) => ({
    id: h.id, text: h.textContent, level: h.tagName === 'H2' ? 2 : 3,
  }));
}

function decodeEntities(s) {
  return String(s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

function safeUrl(value) {
  const v = String(value || '').trim();
  if (/^(https?:\/\/|mailto:|#|\/|\.{1,2}\/)/i.test(v)) return v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return null;
  return v;
}

function linkNode(href, children, title = '') {
  const target = safeUrl(decodeEntities(href));
  if (!target) return el('span', {}, [children]);
  const props = { href: target };
  if (title) props.title = decodeEntities(title);
  if (/^https?:\/\//i.test(target)) {
    try {
      if (new URL(target, location.href).origin !== location.origin) {
        props.target = '_blank';
        props.rel = 'noopener';
      }
    } catch (err) { /* malformed absolute URL: same-tab link */ }
  }
  return el('a', props, [children]);
}

function imageNode(src, alt, caption = '') {
  const target = safeUrl(decodeEntities(src));
  const altText = decodeEntities(alt || '');
  if (!target) return el('span', {}, [altText]);
  const img = el('img', { src: target, alt: altText, loading: 'lazy', decoding: 'async' });
  return caption
    ? el('figure', { class: 'figure' }, [img, el('figcaption', {}, [decodeEntities(caption)])])
    : img;
}

function bareUrlNode(raw) {
  const trimmed = raw.replace(/(?:&quot;|&#39;|[.,;:!])+$/, '');
  const tail = raw.slice(trimmed.length);
  const frag = document.createDocumentFragment();
  frag.appendChild(linkNode(trimmed, [decodeEntities(trimmed)]));
  if (tail) frag.appendChild(document.createTextNode(decodeEntities(tail)));
  return frag;
}

const INLINE = [
  { re: /`([^`\n]+)`/, make: (m) => el('code', {}, [decodeEntities(m[1])]) },
  { re: /!\[([^\]]*)\]\(([^\s)]+)(?:\s+&quot;([^&]*)&quot;)?\)/, make: (m) => imageNode(m[2], m[1], m[3] || '') },
  { re: /\[([^\]]+)\]\(([^\s)]+)(?:\s+&quot;([^&]*)&quot;)?\)/, make: (m) => linkNode(m[2], parseInline(m[1]), m[3] || '') },
  { re: /&lt;(https?:\/\/[^\s]+?)&gt;/, make: (m) => linkNode(m[1], [decodeEntities(m[1])]) },
  { re: /\*\*([\s\S]+?)\*\*|__([\s\S]+?)__/, make: (m) => el('strong', {}, [parseInline(m[1] ?? m[2])]) },
  { re: /~~([\s\S]+?)~~/, make: (m) => el('del', {}, [parseInline(m[1])]) },
  { re: /\*([^*\n]+)\*/, make: (m) => el('em', {}, [parseInline(m[1])]) },
  {
    re: /(^|[^A-Za-z0-9])_([^_\n]+)_(?![A-Za-z0-9])/,
    make: (m) => {
      const f = document.createDocumentFragment();
      if (m[1]) f.appendChild(document.createTextNode(decodeEntities(m[1])));
      f.appendChild(el('em', {}, [parseInline(m[2])]));
      return f;
    },
  },
  { re: /https?:\/\/[^\s<>()]+/, make: (m) => bareUrlNode(m[0]) },
];

function parseInline(escaped) {
  const frag = document.createDocumentFragment();
  let rest = String(escaped);
  while (rest.length) {
    let best = null;
    for (const p of INLINE) {
      const m = p.re.exec(rest);
      if (m && (!best || m.index < best.m.index)) {
        best = { p, m };
        if (m.index === 0) break;
      }
    }
    if (!best) {
      frag.appendChild(document.createTextNode(decodeEntities(rest)));
      break;
    }
    if (best.m.index > 0) frag.appendChild(document.createTextNode(decodeEntities(rest.slice(0, best.m.index))));
    frag.appendChild(best.p.make(best.m));
    rest = rest.slice(best.m.index + best.m[0].length);
  }
  return frag;
}

function escapeHtml(v) {
  return String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function uniqueId(base, ctx) {
  const n = (ctx.ids.get(base) || 0) + 1;
  ctx.ids.set(base, n);
  return n === 1 ? base : base + '-' + n;
}

function codeBlock(lang, raw) {
  const btn = el('button', { class: 'copy-btn', type: 'button' }, ['Copy']);
  btn.addEventListener('click', async () => {
    const ok = await copyText(raw);
    if (ok) {
      btn.classList.add('is-copied');
      btn.textContent = 'Copied';
      setTimeout(() => { btn.classList.remove('is-copied'); btn.textContent = 'Copy'; }, 2000);
    } else {
      toast('Copy failed. Select the code and copy it manually.', 'danger');
    }
  });
  return el('div', { class: 'codeblock' }, [
    el('div', { class: 'codeblock-head' }, [el('span', {}, [lang || 'text']), btn]),
    el('pre', { tabindex: '0' }, [el('code', {}, [raw])]),
  ]);
}

function splitRow(line) {
  let s = String(line).trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

function isTableSeparator(line) {
  if (!line || !line.includes('-')) return false;
  const cells = splitRow(line);
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));
}

function buildTable(header, rows, aligns) {
  const cell = (tag, value, i) => el(tag, aligns[i] ? { style: { textAlign: aligns[i] } } : {},
    [parseInline(escapeHtml(value || ''))]);
  return el('div', { class: 'table-wrap' }, [
    el('table', { class: 'table' }, [
      el('thead', {}, [el('tr', {}, header.map((c, i) => cell('th', c, i)))]),
      el('tbody', {}, rows.map((r) => el('tr', {}, header.map((_, i) => cell('td', r[i], i))))),
    ]),
  ]);
}

function renderList(lines, start, end, out) {
  const first = /^(\s*)([-*+]|\d+[.)])[ \t]+(.*)$/.exec(lines[start]);
  const root = el(/^\d/.test(first[2]) ? 'ol' : 'ul');
  const stack = [{ indent: first[1].length, list: root }];
  let i = start;
  while (i < end) {
    const m = /^(\s*)([-*+]|\d+[.)])[ \t]+(.*)$/.exec(lines[i]);
    if (!m) break;
    const indent = m[1].length;
    const ordered = /^\d/.test(m[2]);
    while (stack.length > 1 && indent < stack[stack.length - 1].indent) stack.pop();
    let top = stack[stack.length - 1];
    if (indent > top.indent) {
      const sub = el(ordered ? 'ol' : 'ul');
      const lastLi = top.list.lastElementChild;
      if (lastLi) lastLi.appendChild(sub); else top.list.appendChild(sub);
      stack.push({ indent, list: sub });
      top = stack[stack.length - 1];
    }
    top.list.appendChild(el('li', {}, [parseInline(escapeHtml(m[3]))]));
    i++;
  }
  out.appendChild(root);
  return i;
}

function isBlockStart(lines, i, end) {
  const line = lines[i];
  return (
    /^ {0,3}(`{3,}|~{3,})/.test(line) ||
    /^ {0,3}:::(note|warn|tip|danger)/.test(line) ||
    /^ {0,3}#{1,4}[ \t]/.test(line) ||
    /^ {0,3}((\*[ \t]*){3,}|(-[ \t]*){3,}|(_[ \t]*){3,})$/.test(line) ||
    /^ {0,3}>/.test(line) ||
    /^(\s*)([-*+]|\d+[.)])[ \t]+/.test(line) ||
    (line.includes('|') && i + 1 < end && isTableSeparator(lines[i + 1])) ||
    /^ {0,3}!\[[^\]]*\]\([^\s)]+(?:\s+"[^"]*")?\)[ \t]*$/.test(line)
  );
}

const CALLOUT_LABELS = { note: 'Note', warn: 'Warning', tip: 'Tip', danger: 'Danger' };

function renderBlocks(lines, start, end, out, ctx) {
  let i = start;
  while (i < end) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    let m = /^ {0,3}(`{3,}|~{3,})[ \t]*([^`\s]*)[ \t]*$/.exec(line);
    if (m) {
      const fence = m[1], lang = m[2];
      const closeRe = new RegExp('^ {0,3}' + fence[0] + '{' + fence.length + ',}[ \\t]*$');
      let j = i + 1;
      const buf = [];
      while (j < end && !closeRe.test(lines[j])) { buf.push(lines[j]); j++; }
      out.appendChild(codeBlock(lang, buf.join('\n')));
      i = j < end ? j + 1 : end;
      continue;
    }

    m = /^ {0,3}:::(note|warn|tip|danger)[ \t]*(.*)$/.exec(line);
    if (m) {
      const kind = m[1], title = m[2].trim();
      let j = i + 1;
      const buf = [];
      while (j < end && !/^ {0,3}:::[ \t]*$/.test(lines[j])) { buf.push(lines[j]); j++; }
      const body = el('div', { class: 'callout-body' });
      renderBlocks(buf, 0, buf.length, body, ctx);
      out.appendChild(el('div', { class: 'callout callout--' + kind }, [
        el('span', { class: 'callout-label' }, [title || CALLOUT_LABELS[kind]]),
        body,
      ]));
      i = j < end ? j + 1 : end;
      continue;
    }

    m = /^ {0,3}(#{1,4})[ \t]+(.+?)[ \t]*#*[ \t]*$/.exec(line);
    if (m) {
      const level = m[1].length;
      const plain = m[2].replace(/[*_`~]/g, '');
      out.appendChild(el('h' + level, { id: uniqueId(slugify(plain), ctx) }, [parseInline(escapeHtml(m[2]))]));
      i++;
      continue;
    }

    if (line.includes('|') && i + 1 < end && isTableSeparator(lines[i + 1])) {
      const aligns = splitRow(lines[i + 1]).map((c) => {
        const l = c.startsWith(':'), r = c.endsWith(':');
        return l && r ? 'center' : r ? 'right' : l ? 'left' : '';
      });
      const header = splitRow(line);
      let j = i + 2;
      const rows = [];
      while (j < end && lines[j].trim() && lines[j].includes('|')) { rows.push(splitRow(lines[j])); j++; }
      out.appendChild(buildTable(header, rows, aligns));
      i = j;
      continue;
    }

    if (/^ {0,3}((\*[ \t]*){3,}|(-[ \t]*){3,}|(_[ \t]*){3,})$/.test(line)) {
      out.appendChild(el('hr', { class: 'divider' }));
      i++;
      continue;
    }

    if (/^ {0,3}>/.test(line)) {
      let j = i;
      const buf = [];
      while (j < end && /^ {0,3}>/.test(lines[j])) { buf.push(lines[j].replace(/^ {0,3}>[ \t]?/, '')); j++; }
      const q = el('blockquote');
      renderBlocks(buf, 0, buf.length, q, ctx);
      out.appendChild(q);
      i = j;
      continue;
    }

    if (/^(\s*)([-*+]|\d+[.)])[ \t]+/.test(line)) { i = renderList(lines, i, end, out); continue; }

    m = /^ {0,3}!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)[ \t]*$/.exec(line);
    if (m) {
      const target = safeUrl(m[2]);
      out.appendChild(target
        ? el('figure', { class: 'figure' }, [
            el('img', { src: target, alt: m[1], loading: 'lazy', decoding: 'async' }),
            m[3] ? el('figcaption', {}, [m[3]]) : null,
          ])
        : el('p', {}, [m[1]]));
      i++;
      continue;
    }

    let j = i;
    const buf = [];
    while (j < end && lines[j].trim() && !isBlockStart(lines, j, end)) { buf.push(lines[j]); j++; }
    const p = el('p');
    buf.join('\n').split(/ {2,}\n/).forEach((seg, idx) => {
      if (idx > 0) p.appendChild(el('br'));
      p.appendChild(parseInline(escapeHtml(seg.replace(/\n/g, ' '))));
    });
    out.appendChild(p);
    i = j;
  }
}

function renderMarkdown(source) {
  const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
  const frag = document.createDocumentFragment();
  renderBlocks(lines, 0, lines.length, frag, { ids: new Map() });
  return frag;
}

/* ============================================================
   Long-form layout, loading and failure states
   ============================================================ */

function skeleton(label = 'Loading') {
  return el('div', { class: 'skeleton', 'aria-label': label }, [
    el('div', { class: 'skeleton-line skeleton-line--title' }),
    el('div', { class: 'skeleton-line' }),
    el('div', { class: 'skeleton-line' }),
    el('div', { class: 'skeleton-line skeleton-line--short' }),
  ]);
}

function copyLinkButton() {
  return el('button', {
    class: 'btn btn--ghost', type: 'button',
    onClick: async () => {
      const ok = await copyText(location.href);
      toast(ok ? 'Link copied.' : 'Copy failed. Copy the address bar instead.', ok ? 'success' : 'danger');
    },
  }, ['Copy link']);
}

function errorBlock(message, retry, backHref, backLabel) {
  return el('div', { class: 'empty' }, [
    el('p', {}, [message]),
    retry ? el('button', { class: 'btn btn--primary', type: 'button', onClick: retry }, ['Retry']) : null,
    backHref ? el('a', { class: 'btn btn--ghost', href: backHref }, [backLabel]) : null,
  ]);
}

function fatalPage({ current, heading, message, retry, backHref, backLabel }) {
  clear(app);
  app.append(
    el('a', { class: 'skip-link', href: '#main' }, ['Skip to content']),
    buildNav(current),
    el('main', { id: 'main' }, [
      el('section', { class: 'page-head' }, [el('div', { class: 'container' }, [el('h1', {}, [heading])])]),
      el('section', { class: 'section' }, [
        el('div', { class: 'container narrow' }, [errorBlock(message, retry, backHref, backLabel)]),
      ]),
    ]),
    buildFooter([]),
  );
  refreshShell();
}

function renderLongForm({ current, projects, head, notice, nav }) {
  const prose = el('div', { class: 'prose' }, [skeleton()]);
  const rail = el('aside', { class: 'rail', 'aria-label': 'On this page' });
  const grid = el('div', { class: 'content-grid' }, [
    el('div', { class: 'content-main' }, [prose]), rail,
  ]);

  const main = el('main', { id: 'main' }, [
    el('section', { class: 'page-head' }, [el('div', { class: 'container' }, [].concat(head))]),
    notice ? el('div', { class: 'container', style: { paddingTop: '32px' } }, [notice]) : null,
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

async function fetchMarkdown(path, label) {
  let res;
  try {
    res = await fetch(url(path), { cache: 'no-cache' });
  } catch (err) {
    throw new Error('Could not reach the ' + label + '. Check your connection, then retry.');
  }
  if (!res.ok) {
    throw new Error('The ' + label + ' returned HTTP ' + res.status + '. Confirm ' + path + ' exists on main and the Pages deploy is green, then retry.');
  }
  const text = await res.text();
  const head = text.trimStart().slice(0, 200).toLowerCase();
  if (head.startsWith('<!doctype') || head.startsWith('<html')) {
    throw new Error('The ' + label + ' came back as HTML instead of Markdown. Check the latest Pages deploy. If it persists, rename content files to .txt and update CONTENT_EXT in app.js.');
  }
  return text;
}

function initToc(prose, rail, grid) {
  tocOffs.forEach((off) => off());
  tocOffs = [];
  const items = extractToc(prose);
  clear(rail);
  if (items.length < 2) { grid.classList.add('no-rail'); return; }
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
  let active = '', ticking = false;
  const update = () => {
    let cur = headings.length ? headings[0].id : '';
    for (const h of headings) if (h.getBoundingClientRect().top <= 96) cur = h.id;
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

async function loadBody(opts) {
  const { path, label, prose, rail, grid, backHref, backLabel, onRendered } = opts;
  tocOffs.forEach((off) => off());
  tocOffs = [];
  clear(prose);
  prose.appendChild(skeleton('Loading ' + label));
  clear(rail);
  grid.classList.add('no-rail');
  try {
    const text = await fetchMarkdown(path, label);
    clear(prose);
    prose.appendChild(renderMarkdown(text));
    initToc(prose, rail, grid);
    if (onRendered) onRendered(text);
  } catch (err) {
    clear(prose);
    prose.appendChild(errorBlock(err.message, () => loadBody(opts), backHref, backLabel));
  }
}

/* ============================================================
   Project boot
   ============================================================ */

function projectHead(p) {
  const links = p.links || {};
  const actions = [];
  if (links.app) actions.push(el('a', { class: 'btn btn--primary', href: links.app, target: '_blank', rel: 'noopener' }, ['Open app']));
  if (links.source) actions.push(el('a', { class: 'btn btn--ghost', href: links.source, target: '_blank', rel: 'noopener' }, ['Source code']));
  if (links.site) actions.push(el('a', { class: 'btn btn--ghost', href: links.site, target: '_blank', rel: 'noopener' }, ['Product site']));
  if (links.pricing) actions.push(el('a', { class: 'btn btn--ghost', href: links.pricing, target: '_blank', rel: 'noopener' }, ['Pricing']));
  actions.push(copyLinkButton());

  const meta = [
    p.year ? String(p.year) : '',
    LABELS.category[p.category] || p.category || '',
    LABELS.status[p.status] || p.status || '',
  ].filter(Boolean);
  const stack = p.stack || [];

  return [
    el('h1', {}, [p.name]),
    el('p', { class: 'lede' }, [p.tagline || '']),
    el('div', { class: 'page-head-meta' }, meta.map((m) => el('span', {}, [m]))),
    stack.length ? el('div', { class: 'pill-row', style: { marginTop: '16px' } },
      stack.map((s) => el('span', { class: 'chip-stack' }, [s]))) : null,
    el('div', { class: 'btn-row', style: { marginTop: '24px' } }, actions),
  ];
}

async function startProject() {
  const backHref = url('work/');
  if (!projectSlug) {
    fatalPage({ current: 'work', heading: 'Case study', message: 'This page did not receive a project slug. Open the work index and choose a project.', backHref, backLabel: 'Back to work' });
    return;
  }
  clear(app);
  app.appendChild(el('div', { class: 'container section' }, [skeleton('Loading case study')]));

  let data;
  try { data = await loadManifest(); }
  catch (err) {
    fatalPage({ current: 'work', heading: 'Case study', message: err.message, retry: startProject, backHref, backLabel: 'Back to work' });
    return;
  }

  const p = findBySlug(data.projects, projectSlug);
  if (!p) {
    fatalPage({ current: 'work', heading: 'Case study', message: 'No project with slug "' + projectSlug + '" is in the manifest. It may have been renamed. Open the work index to find it.', backHref, backLabel: 'Back to work' });
    return;
  }

  const path = 'work/' + p.slug + '/';
  const ld = {
    '@context': 'https://schema.org', '@type': 'SoftwareApplication',
    name: p.name, description: p.tagline || '', operatingSystem: 'Any',
    url: (p.links && p.links.app) || absoluteUrl(path),
  };
  if (p.category === 'tool') ld.applicationCategory = 'DeveloperApplication';

  applyMeta({
    title: p.name + ' — Case study — LegendAlive Studio',
    ogTitle: p.name + ' — Case study',
    description: p.tagline || '', path, type: 'article', jsonLd: ld,
  });

  const { prose, rail, grid } = renderLongForm({
    current: 'work',
    projects: data.projects,
    head: projectHead(p),
    nav: el('nav', { class: 'case-nav', 'aria-label': 'More work' }, [
      el('a', { class: 'text-link', href: url('work/') }, ['Back to all work']),
      el('a', { class: 'text-link', href: url('') }, ['Home']),
    ]),
  });

  if (!p.body) {
    clear(prose);
    grid.classList.add('no-rail');
    prose.appendChild(el('p', {}, [p.tagline || 'This project has no long-form body yet.']));
    return;
  }
  await loadBody({ path: 'content/' + p.body, label: 'case study', prose, rail, grid, backHref, backLabel: 'Back to work' });
}

/* ============================================================
   Article boot
   ============================================================ */

function articleHead(post, readTime) {
  const tags = post.tags || [];
  return [
    el('div', { class: 'post-meta' }, [
      el('span', { class: 'chip-kind' }, [post.kind || 'note']),
      el('span', {}, [formatDate(post.date)]),
      post.updated ? el('span', {}, ['Updated ' + formatDate(post.updated)]) : null,
      readTime,
    ]),
    el('h1', { style: { maxWidth: '32ch', marginTop: '16px' } }, [post.title]),
    el('p', { class: 'lede' }, [post.dek || '']),
    tags.length ? el('div', { class: 'post-tags', style: { marginTop: '16px' } },
      tags.map((t) => el('span', { class: 'tag' }, [t]))) : null,
    el('div', { class: 'btn-row', style: { marginTop: '24px' } }, [
      copyLinkButton(),
      el('a', { class: 'btn btn--ghost', href: url('writing/') }, ['All writing']),
    ]),
  ];
}

function draftNotice() {
  return el('div', { class: 'callout callout--warn', style: { maxWidth: '68ch' } }, [
    el('span', { class: 'callout-label' }, ['Draft preview']),
    el('div', { class: 'callout-body' }, [
      el('p', {}, ['This article is not published. It is absent from the writing index, the home page and the sitemap, and search engines are told not to index it. Review it here, then publish it by clearing the draft flag in the manifest.']),
    ]),
  ]);
}

function articleNav(post, data) {
  const published = getPosts(data);
  const idx = published.findIndex((x) => x.slug === post.slug);
  const newer = idx > 0 ? published[idx - 1] : null;
  const older = idx >= 0 && idx < published.length - 1 ? published[idx + 1] : null;
  return el('nav', { class: 'case-nav', 'aria-label': 'More writing' }, [
    older ? el('a', { class: 'text-link', style: { maxWidth: '34ch' }, href: url('p/' + older.slug + '/') }, ['← ', older.title]) : el('span'),
    el('a', { class: 'text-link', href: url('writing/') }, ['All writing']),
    newer ? el('a', { class: 'text-link', style: { maxWidth: '34ch' }, href: url('p/' + newer.slug + '/') }, [newer.title, ' →']) : el('span'),
  ]);
}

async function startArticle() {
  const backHref = url('writing/');
  if (!postSlug) {
    fatalPage({ current: 'writing', heading: 'Article', message: 'This page did not receive an article slug. Open the writing index and choose an article.', backHref, backLabel: 'Back to writing' });
    return;
  }
  clear(app);
  app.appendChild(el('div', { class: 'container section' }, [skeleton('Loading article')]));

  let data;
  try { data = await loadManifest(); }
  catch (err) {
    fatalPage({ current: 'writing', heading: 'Article', message: err.message, retry: startArticle, backHref, backLabel: 'Back to writing' });
    return;
  }

  const post = findBySlug(data.posts, postSlug);
  if (!post) {
    fatalPage({ current: 'writing', heading: 'Article', message: 'No article with slug "' + postSlug + '" is in the manifest. It may have been renamed. Open the writing index to find it.', backHref, backLabel: 'Back to writing' });
    return;
  }

  const path = 'p/' + post.slug + '/';
  applyMeta({
    title: (post.draft ? 'Draft — ' : '') + post.title + ' — LegendAlive Studio',
    ogTitle: post.title,
    description: post.dek || '',
    path, type: 'article',
    robots: post.draft ? 'noindex, nofollow' : 'index, follow',
    published: post.date || '',
    modified: post.updated || post.date || '',
    tags: post.tags || [],
    jsonLd: post.draft ? null : {
      '@context': 'https://schema.org', '@type': 'Article',
      headline: post.title, description: post.dek || '',
      datePublished: post.date || '', dateModified: post.updated || post.date || '',
      inLanguage: 'en', keywords: (post.tags || []).join(', '),
      author: { '@type': 'Person', name: OWNER.name, url: absoluteUrl('about/') },
      publisher: { '@type': 'Organization', name: SITE.name, url: absoluteUrl('') },
      mainEntityOfPage: absoluteUrl(path),
    },
  });

  const readTime = el('span', {}, [(post.minutes || 1) + ' min read']);
  const { prose, rail, grid } = renderLongForm({
    current: 'writing',
    projects: data.projects,
    head: articleHead(post, readTime),
    notice: post.draft ? draftNotice() : null,
    nav: articleNav(post, data),
  });

  await loadBody({
    path: 'content/posts/' + post.slug + CONTENT_EXT,
    label: 'article', prose, rail, grid, backHref, backLabel: 'Back to writing',
    onRendered: (text) => {
      readTime.textContent = Math.max(1, Math.round(countWords(text) / WORDS_PER_MINUTE)) + ' min read';
    },
  });
}

/* ============================================================
   Boot
   ============================================================ */

async function start() {
  if (!app) return;
  if (projectSlug) await startProject();
  else if (postSlug) await startArticle();
}

start().catch((err) => {
  console.error('Reader failed. Press F12 and report the first red line. Detail:', err);
  if (app) {
    clear(app);
    app.appendChild(el('div', { class: 'container section' }, [
      errorBlock('This page could not be rendered. Reload, or head back to the work index.',
        () => location.reload(), url('work/'), 'Back to work'),
    ]));
  }
});
