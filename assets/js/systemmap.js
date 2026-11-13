// Repo: studio — assets/js/systemmap.js — FULL file
// LegendAlive Studio — the System Map (plan section 7).
// Reads content/index.json through manifest.js. Nodes are products and
// capabilities; edges are the real capability dependencies in the manifest.
// One rAF loop, transforms only, paused when hidden or off-screen.
// No innerHTML. SVG nodes are built with createElementNS.

import { url } from './config.js';
import { el, clear, on } from './dom.js';
import { loadManifest, getProjects, getCapabilities } from './manifest.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MOTION_KEY = 'ls-map-motion';
const W = 640;
const H = 470;

const STATUS_LABEL = {
  live: 'Live',
  building: 'In development',
  lab: 'Experiment',
  paused: 'Paused',
};

function svgEl(tag, attrs = {}, children = []) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of [].concat(children)) {
    if (child == null || child === false) continue;
    node.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function readMotionPref() {
  try {
    const v = localStorage.getItem(MOTION_KEY);
    if (v === 'on') return true;
    if (v === 'off') return false;
  } catch (err) { /* storage unavailable: fall through */ }
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function writeMotionPref(value) {
  try { localStorage.setItem(MOTION_KEY, value ? 'on' : 'off'); } catch (err) { /* ignore */ }
}

function kindLabel(node) {
  if (node.kind === 'capability') return 'Capability';
  const c = node.ref.category;
  if (c === 'tool') return 'Developer tool';
  if (c === 'experiment') return 'Experiment';
  if (c === 'client') return 'Client work';
  return 'Product';
}

function nodeAriaLabel(node) {
  if (node.kind === 'capability') return node.name + ', capability';
  return node.name + ', ' + kindLabel(node).toLowerCase() + ', ' +
    (STATUS_LABEL[node.ref.status] || node.ref.status);
}

function projectHref(project) {
  if (project.links && project.links.app) return project.links.app;
  return url(project.page || 'work/');
}

function isExternal(href) {
  try { return new URL(href, location.href).origin !== location.origin; }
  catch (err) { return false; }
}

// initSystemMap(mount) renders the map into mount. Safe to call again on the
// same mount (the previous instance is destroyed first). Returns a handle
// with destroy(), or undefined while loading / on failure.
export async function initSystemMap(mount) {
  if (!mount) return undefined;
  if (typeof mount.__mapDestroy === 'function') mount.__mapDestroy();

  clear(mount);
  mount.appendChild(el('p', { class: 'map-loading' }, ['Loading the system map…']));

  let data;
  try {
    data = await loadManifest();
  } catch (err) {
    clear(mount);
    mount.appendChild(el('div', { class: 'empty' }, [
      el('p', {}, [err && err.message ? err.message : 'The system map could not load. Check your connection, then retry.']),
      el('button', { class: 'btn btn--primary', type: 'button', onClick: () => initSystemMap(mount) }, ['Retry']),
    ]));
    return undefined;
  }

  const projects = getProjects(data);
  const capabilities = getCapabilities(data);
  if (!projects.length && !capabilities.length) {
    clear(mount);
    mount.appendChild(el('p', { class: 'map-loading' }, ['The manifest has no projects or capabilities yet.']));
    return undefined;
  }

  return buildMap(mount, projects, capabilities);
}

function buildMap(mount, projects, capabilities) {
  const offs = [];
  let destroyed = false;

  /* ---------- Layout: deterministic, derived from the data ---------- */

  const nodes = [];
  projects.forEach((p, i) => {
    nodes.push({
      id: 'p-' + p.slug, kind: 'project', ref: p, name: p.name,
      x: W * (i + 1) / (projects.length + 1), y: 86, r: 26,
    });
  });

  const rows = capabilities.length > 5 ? 2 : 1;
  const perRow = Math.ceil(capabilities.length / rows);
  capabilities.forEach((c, i) => {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const rowCount = Math.min(perRow, capabilities.length - row * perRow);
    nodes.push({
      id: 'c-' + c.id, kind: 'capability', ref: c, name: c.name,
      x: 60 + (W - 120) * (col + 0.5) / rowCount,
      y: rows === 1 ? 330 : (row === 0 ? 300 : 396),
      r: 13,
    });
  });

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges = [];
  projects.forEach((p) => {
    const from = byId.get('p-' + p.slug);
    (p.capabilities || []).forEach((capId) => {
      const to = byId.get('c-' + capId);
      if (from && to) edges.push({ from, to });
    });
  });

  // Drift parameters: amplitude <= 3px, period 12-20s, random phase.
  nodes.forEach((n) => {
    n.amp = 2 + Math.random();
    n.period = 12000 + Math.random() * 8000;
    n.phase = Math.random() * Math.PI * 2;
  });

  /* ---------- State ---------- */

  let filter = 'all';
  let active = null;
  let motionOn = readMotionPref();
  let raf = 0;
  let inView = true;
  let pageVisible = !document.hidden;
  let io = null;

  const passes = (n) =>
    filter === 'all' ||
    (filter === 'products' && n.kind === 'project') ||
    (filter === 'capabilities' && n.kind === 'capability');

  const visibleNodes = () => nodes.filter(passes);

  /* ---------- SVG ---------- */

  const edgeEls = edges.map((e) => svgEl('line', {
    class: 'map-edge',
    x1: e.from.x, y1: e.from.y, x2: e.to.x, y2: e.to.y,
  }));
  const edgesLayer = svgEl('g', {}, edgeEls);

  const nodeEls = nodes.map((n) => {
    const statusClass = n.kind === 'project' ? ' map-node--' + (n.ref.status || 'live') : '';
    const g = svgEl('g', {
      class: 'map-node map-node--' + n.kind + statusClass,
      transform: 'translate(' + n.x + ' ' + n.y + ')',
      id: 'mapnode-' + n.id,
      role: 'option',
      'aria-selected': 'false',
      'aria-label': nodeAriaLabel(n),
    }, [
      svgEl('circle', { class: 'map-node-ring', r: n.r + 7, fill: 'none' }),
      svgEl('circle', { class: 'map-node-core', r: n.r }),
      svgEl('circle', { class: 'map-node-dot', r: n.kind === 'project' ? 4 : 3 }),
      svgEl('text', { class: 'map-label', y: n.r + 18, 'text-anchor': 'middle' }, [n.name]),
    ]);
    n.g = g;
    offs.push(on(g, 'mouseenter', () => setActive(n)));
    offs.push(on(g, 'click', () => navigate(n)));
    return g;
  });

  const svg = svgEl('svg', {
    viewBox: '0 0 ' + W + ' ' + H,
    focusable: 'false',
  }, [edgesLayer, svgEl('g', {}, nodeEls)]);

  const canvas = el('div', {
    class: 'map-canvas',
    role: 'listbox',
    tabindex: '0',
    'aria-label': 'Studio system map: products and the capabilities they use. Use arrow keys to move between nodes, Enter to open, Escape to clear.',
  }, [svg]);

  const stage = el('div', { class: 'map-stage' }, [canvas]);

  /* ---------- Inspect card ---------- */

  const card = el('div', { class: 'map-card', 'aria-live': 'polite' });

  function renderCard(n) {
    clear(card);
    if (!n) {
      card.appendChild(el('p', { class: 'map-card-hint' }, [
        'Hover a node, or focus the map and use the arrow keys.',
      ]));
      return;
    }
    if (n.kind === 'project') {
      const p = n.ref;
      const href = projectHref(p);
      const external = isExternal(href);
      card.appendChild(el('p', { class: 'map-card-kind' }, [
        kindLabel(n) + ' · ' + (STATUS_LABEL[p.status] || p.status),
      ]));
      card.appendChild(el('h3', {}, [p.name]));
      card.appendChild(el('p', {}, [p.tagline || '']));
      if (Array.isArray(p.stack) && p.stack.length) {
        card.appendChild(el('div', { class: 'map-card-stack' },
          p.stack.map((s) => el('span', { class: 'chip-stack' }, [s]))));
      }
      card.appendChild(el('a', {
        class: 'btn btn--ghost btn--sm',
        href,
        target: external ? '_blank' : null,
        rel: external ? 'noopener' : null,
      }, [external ? 'Open app' : 'View project']));
    } else {
      const c = n.ref;
      card.appendChild(el('p', { class: 'map-card-kind' }, ['Capability']));
      card.appendChild(el('h3', {}, [c.name]));
      card.appendChild(el('p', {}, [c.summary || '']));
      card.appendChild(el('button', {
        class: 'btn btn--ghost btn--sm', type: 'button',
        onClick: () => navigate(n),
      }, ['See capability']));
    }
  }

  /* ---------- Active / neighbour highlighting ---------- */

  function setActive(n) {
    active = n;
    const neighbours = new Set([n.id]);
    edges.forEach((e) => {
      if (e.from === n) neighbours.add(e.to.id);
      if (e.to === n) neighbours.add(e.from.id);
    });
    root.classList.add('has-active');
    nodes.forEach((m) => {
      m.g.classList.toggle('is-active', m === n);
      m.g.classList.toggle('is-neighbor', m !== n && neighbours.has(m.id));
      m.g.setAttribute('aria-selected', String(m === n));
    });
    edges.forEach((e, i) => {
      edgeEls[i].classList.toggle('is-lit', e.from === n || e.to === n);
    });
    canvas.setAttribute('aria-activedescendant', 'mapnode-' + n.id);
    renderCard(n);
  }

  function clearActive() {
    active = null;
    root.classList.remove('has-active');
    nodes.forEach((m) => {
      m.g.classList.remove('is-active', 'is-neighbor');
      m.g.setAttribute('aria-selected', 'false');
    });
    edgeEls.forEach((l) => l.classList.remove('is-lit'));
    canvas.removeAttribute('aria-activedescendant');
    renderCard(null);
  }

  /* ---------- Navigation ---------- */

  function navigate(n) {
    if (n.kind === 'project') {
      const href = projectHref(n.ref);
      if (isExternal(href)) window.open(href, '_blank', 'noopener');
      else location.href = href;
      return;
    }
    const anchor = 'cap-' + (n.ref.anchor || n.ref.id);
    const row = document.getElementById(anchor);
    if (!row) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    row.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', '#' + anchor);
    row.classList.remove('is-flash');
    // Restart the flash even on repeated clicks.
    void row.offsetWidth;
    row.classList.add('is-flash');
    window.setTimeout(() => row.classList.remove('is-flash'), 1400);
  }

  /* ---------- Keyboard (single tab stop, roving active descendant) ---------- */

  offs.push(on(canvas, 'keydown', (e) => {
    const list = visibleNodes();
    if (!list.length) return;
    const idx = active ? list.indexOf(active) : -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault(); setActive(list[(idx + 1) % list.length]);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault(); setActive(list[(idx - 1 + list.length) % list.length]);
    } else if (e.key === 'Home') {
      e.preventDefault(); setActive(list[0]);
    } else if (e.key === 'End') {
      e.preventDefault(); setActive(list[list.length - 1]);
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (active) { e.preventDefault(); navigate(active); }
    } else if (e.key === 'Escape') {
      clearActive();
    }
  }));
  offs.push(on(canvas, 'focus', () => {
    const list = visibleNodes();
    if (!active && list.length) setActive(list[0]);
  }));
  offs.push(on(svg, 'mouseleave', () => {
    if (document.activeElement !== canvas) clearActive();
  }));

  /* ---------- Mobile list (same data, same filters) ---------- */

  const listEl = el('ul', { class: 'map-list', role: 'list' });
  const listItems = nodes.map((n) => {
    const meta = n.kind === 'project'
      ? kindLabel(n) + ' · ' + (STATUS_LABEL[n.ref.status] || n.ref.status)
      : 'Capability';
    const desc = n.kind === 'project' ? (n.ref.tagline || '') : (n.ref.summary || '');
    const btn = el('button', { class: 'map-list-item', type: 'button', onClick: () => navigate(n) }, [
      el('span', { class: 'map-list-name' }, [n.name]),
      el('span', { class: 'map-list-meta' }, [meta]),
      el('span', { class: 'map-list-desc' }, [desc]),
    ]);
    const li = el('li', {}, [btn]);
    n.li = li;
    listEl.appendChild(li);
    return li;
  });

  /* ---------- Controls ---------- */

  const filterDefs = [
    { value: 'all', label: 'All' },
    { value: 'products', label: 'Products' },
    { value: 'capabilities', label: 'Capabilities' },
  ];
  const filterChips = filterDefs.map((f) => el('button', {
    class: 'chip', type: 'button',
    'aria-pressed': String(filter === f.value),
    onClick: () => { filter = f.value; applyFilter(); },
  }, [f.label]));

  const motionChip = el('button', {
    class: 'chip', type: 'button',
    'aria-pressed': String(motionOn),
    onClick: () => {
      motionOn = !motionOn;
      writeMotionPref(motionOn);
      syncMotionChip();
      syncLoop();
    },
  }, ['Motion: ' + (motionOn ? 'on' : 'off')]);

  function syncMotionChip() {
    motionChip.textContent = 'Motion: ' + (motionOn ? 'on' : 'off');
    motionChip.setAttribute('aria-pressed', String(motionOn));
    motionChip.classList.toggle('chip--active', motionOn);
  }

  const resetBtn = el('button', {
    class: 'btn btn--ghost btn--sm', type: 'button',
    onClick: () => { filter = 'all'; applyFilter(); clearActive(); },
  }, ['Reset view']);

  const controls = el('div', { class: 'map-controls', role: 'group', 'aria-label': 'System map controls' }, [
    ...filterChips, motionChip, resetBtn,
  ]);

  function applyFilter() {
    nodes.forEach((n) => {
      const show = passes(n);
      n.g.classList.toggle('is-hidden', !show);
      n.g.setAttribute('aria-hidden', String(!show));
      n.li.hidden = !show;
    });
    edges.forEach((e, i) => {
      edgeEls[i].classList.toggle('is-hidden', !(passes(e.from) && passes(e.to)));
    });
    filterChips.forEach((chip, i) => {
      const onNow = filterDefs[i].value === filter;
      chip.classList.toggle('chip--active', onNow);
      chip.setAttribute('aria-pressed', String(onNow));
    });
    if (active && !passes(active)) clearActive();
  }

  /* ---------- Drift loop ---------- */

  function resetTransforms() {
    nodes.forEach((n) => n.g.setAttribute('transform', 'translate(' + n.x + ' ' + n.y + ')'));
  }

  function frame(t) {
    raf = 0;
    if (destroyed || !motionOn || !inView || !pageVisible) return;
    for (const n of nodes) {
      const w = (Math.PI * 2) / n.period;
      const dx = n.amp * Math.sin(t * w + n.phase);
      const dy = n.amp * Math.cos(t * w * 0.83 + n.phase * 1.7);
      n.g.setAttribute('transform', 'translate(' + (n.x + dx).toFixed(2) + ' ' + (n.y + dy).toFixed(2) + ')');
    }
    raf = requestAnimationFrame(frame);
  }

  function syncLoop() {
    const should = motionOn && inView && pageVisible && !destroyed;
    if (should && !raf) raf = requestAnimationFrame(frame);
    if (!should && raf) { cancelAnimationFrame(raf); raf = 0; }
    if (!motionOn) resetTransforms();
  }

  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver((entries) => {
      inView = entries[0].isIntersecting;
      syncLoop();
    }, { threshold: 0.05 });
    io.observe(stage);
  }
  offs.push(on(document, 'visibilitychange', () => {
    pageVisible = !document.hidden;
    syncLoop();
  }));

  /* ---------- Assemble ---------- */

  const root = el('div', { class: 'map' }, [stage, listEl, controls, card]);
  clear(mount);
  mount.appendChild(root);
  renderCard(null);
  applyFilter();
  syncMotionChip();
  syncLoop();

  function destroy() {
    destroyed = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (io) io.disconnect();
    offs.forEach((off) => off());
    clear(mount);
  }
  mount.__mapDestroy = destroy;
  return { destroy };
}
