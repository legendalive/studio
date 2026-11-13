// Repo: studio — assets/js/markdown.js — FULL file
// Safe Markdown renderer for LegendAlive Studio (plan 8.4).
// Returns DOM nodes built through el(). Raw source is escaped before inline
// parsing, then decoded only when written through textContent/setAttribute.
// innerHTML is never used. Code copy and toasts reuse dom.js helpers.

import { el, escapeHtml, copyText, toast } from './dom.js';

const CALLOUT_LABELS = { note: 'Note', warn: 'Warning', tip: 'Tip', danger: 'Danger' };

/* ---------- Public helpers ---------- */

export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

export function countWords(source) {
  const text = String(source || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|]/g, ' ')
    .replace(/:::[a-z]*/gi, ' ');
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

export function extractToc(root) {
  return Array.from(root.querySelectorAll('h2, h3')).map((h) => ({
    id: h.id,
    text: h.textContent,
    level: h.tagName === 'H2' ? 2 : 3,
  }));
}

export function renderMarkdown(source) {
  const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
  const frag = document.createDocumentFragment();
  renderBlocks(lines, 0, lines.length, frag, { ids: new Map() });
  return frag;
}

/* ---------- Entity + URL safety ---------- */

function decodeEntities(s) {
  return String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function safeUrl(value) {
  const v = String(value || '').trim();
  if (/^(https?:\/\/|mailto:|#|\/|\.{1,2}\/)/i.test(v)) return v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return null; // block other schemes
  return v; // relative path
}

/* ---------- Inline parsing ---------- */

function linkNode(href, children, title = '') {
  const url = safeUrl(decodeEntities(href));
  if (!url) return el('span', {}, [children]);
  const props = { href: url };
  if (title) props.title = decodeEntities(title);
  if (/^https?:\/\//i.test(url)) {
    try {
      const u = new URL(url, location.href);
      if (u.origin !== location.origin) {
        props.target = '_blank';
        props.rel = 'noopener';
      }
    } catch (err) { /* malformed absolute URL: render as same-tab link */ }
  }
  return el('a', props, [children]);
}

function imageNode(src, alt, caption = '') {
  const url = safeUrl(decodeEntities(src));
  const altText = decodeEntities(alt || '');
  if (!url) return el('span', {}, [altText]);
  const img = el('img', { src: url, alt: altText, loading: 'lazy', decoding: 'async' });
  if (caption) {
    return el('figure', { class: 'figure' }, [img, el('figcaption', {}, [decodeEntities(caption)])]);
  }
  return img;
}

function bareUrlNode(raw) {
  const trimmed = raw.replace(/(?:&quot;|&#39;|[.,;:!])+$/, '');
  const tail = raw.slice(trimmed.length);
  const frag = document.createDocumentFragment();
  frag.appendChild(linkNode(trimmed, [decodeEntities(trimmed)]));
  if (tail) frag.appendChild(document.createTextNode(decodeEntities(tail)));
  return frag;
}

const INLINE_PATTERNS = [
  { re: /`([^`\n]+)`/, make: (m) => el('code', {}, [decodeEntities(m[1])]) },
  {
    re: /!\[([^\]]*)\]\(([^\s)]+)(?:\s+&quot;([^&]*)&quot;)?\)/,
    make: (m) => imageNode(m[2], m[1], m[3] || ''),
  },
  {
    re: /\[([^\]]+)\]\(([^\s)]+)(?:\s+&quot;([^&]*)&quot;)?\)/,
    make: (m) => linkNode(m[2], parseInline(m[1]), m[3] || ''),
  },
  {
    re: /&lt;(https?:\/\/[^\s]+?)&gt;/,
    make: (m) => linkNode(m[1], [decodeEntities(m[1])]),
  },
  {
    re: /\*\*([\s\S]+?)\*\*|__([\s\S]+?)__/,
    make: (m) => el('strong', {}, [parseInline(m[1] ?? m[2])]),
  },
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
    for (const p of INLINE_PATTERNS) {
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
    if (best.m.index > 0) {
      frag.appendChild(document.createTextNode(decodeEntities(rest.slice(0, best.m.index))));
    }
    frag.appendChild(best.p.make(best.m));
    rest = rest.slice(best.m.index + best.m[0].length);
  }
  return frag;
}

/* ---------- Block helpers ---------- */

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
      setTimeout(() => {
        btn.classList.remove('is-copied');
        btn.textContent = 'Copy';
      }, 2000);
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
  const cell = (tag, value, idx) => el(
    tag,
    aligns[idx] ? { style: { textAlign: aligns[idx] } } : {},
    [parseInline(escapeHtml(value || ''))]
  );
  return el('div', { class: 'table-wrap' }, [
    el('table', { class: 'table' }, [
      el('thead', {}, [el('tr', {}, header.map((c, idx) => cell('th', c, idx)))]),
      el('tbody', {}, rows.map((r) => el('tr', {}, header.map((_, idx) => cell('td', r[idx], idx))))),
    ]),
  ]);
}

function renderList(lines, start, end, out) {
  const first = /^(\s*)([-*+]|\d+[.)])[ \t]+(.*)$/.exec(lines[start]);
  const baseIndent = first[1].length;
  const root = el(/^\d/.test(first[2]) ? 'ol' : 'ul');
  const stack = [{ indent: baseIndent, list: root }];
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
      if (lastLi) lastLi.appendChild(sub);
      else top.list.appendChild(sub);
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

function renderBlocks(lines, start, end, out, ctx) {
  let i = start;
  while (i < end) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    // Fenced code
    let m = /^ {0,3}(`{3,}|~{3,})[ \t]*([^`\s]*)[ \t]*$/.exec(line);
    if (m) {
      const fence = m[1];
      const lang = m[2];
      const closeRe = new RegExp('^ {0,3}' + fence[0] + '{' + fence.length + ',}[ \\t]*$');
      let j = i + 1;
      const buf = [];
      while (j < end && !closeRe.test(lines[j])) { buf.push(lines[j]); j++; }
      out.appendChild(codeBlock(lang, buf.join('\n')));
      i = j < end ? j + 1 : end;
      continue;
    }

    // Callout fence
    m = /^ {0,3}:::(note|warn|tip|danger)[ \t]*(.*)$/.exec(line);
    if (m) {
      const kind = m[1];
      const title = m[2].trim();
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

    // Heading
    m = /^ {0,3}(#{1,4})[ \t]+(.+?)[ \t]*#*[ \t]*$/.exec(line);
    if (m) {
      const level = m[1].length;
      const plain = m[2].replace(/[*_`~]/g, '');
      out.appendChild(el('h' + level, { id: uniqueId(slugify(plain), ctx) }, [parseInline(escapeHtml(m[2]))]));
      i++;
      continue;
    }

    // Table
    if (line.includes('|') && i + 1 < end && isTableSeparator(lines[i + 1])) {
      const aligns = splitRow(lines[i + 1]).map((c) => {
        const l = c.startsWith(':');
        const r = c.endsWith(':');
        return l && r ? 'center' : r ? 'right' : l ? 'left' : '';
      });
      const header = splitRow(line);
      let j = i + 2;
      const rows = [];
      while (j < end && lines[j].trim() && lines[j].includes('|')) {
        rows.push(splitRow(lines[j]));
        j++;
      }
      out.appendChild(buildTable(header, rows, aligns));
      i = j;
      continue;
    }

    // Horizontal rule
    if (/^ {0,3}((\*[ \t]*){3,}|(-[ \t]*){3,}|(_[ \t]*){3,})$/.test(line)) {
      out.appendChild(el('hr', { class: 'divider' }));
      i++;
      continue;
    }

    // Blockquote
    if (/^ {0,3}>/.test(line)) {
      let j = i;
      const buf = [];
      while (j < end && /^ {0,3}>/.test(lines[j])) {
        buf.push(lines[j].replace(/^ {0,3}>[ \t]?/, ''));
        j++;
      }
      const q = el('blockquote');
      renderBlocks(buf, 0, buf.length, q, ctx);
      out.appendChild(q);
      i = j;
      continue;
    }

    // List
    if (/^(\s*)([-*+]|\d+[.)])[ \t]+/.test(line)) {
      i = renderList(lines, i, end, out);
      continue;
    }

    // Standalone image
    m = /^ {0,3}!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)[ \t]*$/.exec(line);
    if (m) {
      const url = safeUrl(m[2]);
      if (url) {
        out.appendChild(el('figure', { class: 'figure' }, [
          el('img', { src: url, alt: m[1], loading: 'lazy', decoding: 'async' }),
          m[3] ? el('figcaption', {}, [m[3]]) : null,
        ]));
      } else {
        out.appendChild(el('p', {}, [m[1]]));
      }
      i++;
      continue;
    }

    // Paragraph
    let j = i;
    const buf = [];
    while (j < end && lines[j].trim() && !isBlockStart(lines, j, end)) {
      buf.push(lines[j]);
      j++;
    }
    const raw = buf.join('\n');
    const segments = raw.split(/ {2,}\n/);
    const p = el('p');
    segments.forEach((seg, idx) => {
      if (idx > 0) p.appendChild(el('br'));
      p.appendChild(parseInline(escapeHtml(seg.replace(/\n/g, ' '))));
    });
    out.appendChild(p);
    i = j;
  }
}
