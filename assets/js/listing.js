// Repo: studio — assets/js/listing.js — FULL file
// Shared listing controller for /work/, /writing/ and /updates/.
// Builds a live FilterBar (search + pill groups + sort), keeps state in the
// URL query for shareable views, renders through the page's own renderItem,
// and handles loading / empty / error states with honest next actions.
// Query functions come from manifest.js; this module owns behaviour only.

import { el, clear, qsa, on, debounce } from './dom.js';

let uid = 0;

/* ---------- URL query state ---------- */

export function readUrlState(defaults) {
  const params = new URLSearchParams(location.search);
  const state = {};
  for (const [key, def] of Object.entries(defaults)) {
    const raw = params.get(key);
    if (Array.isArray(def)) {
      state[key] = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [];
    } else {
      state[key] = raw != null && raw !== '' ? raw : def;
    }
  }
  return state;
}

export function writeUrlState(state, defaults) {
  const params = new URLSearchParams();
  for (const [key, def] of Object.entries(defaults)) {
    const v = state[key];
    const same = Array.isArray(def)
      ? Array.isArray(v) && v.join(',') === def.join(',')
      : v === def;
    if (same || v == null || v === '') continue;
    params.set(key, Array.isArray(v) ? v.join(',') : String(v));
  }
  const qs = params.toString();
  history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
}

/* ---------- Listing controller ---------- */

export function createListing(opts) {
  const {
    mount,
    load,
    query,
    renderItem,
    filters = [],
    sorts = [],
    defaults = {},
    count,
    emptyMessage = 'Nothing matches the current filters.',
    searchLabel = 'Search',
    searchPlaceholder = 'Search',
    resultsClass = '',
    urlSync = true,
  } = opts;

  if (!mount || typeof query !== 'function' || typeof renderItem !== 'function') {
    throw new Error('createListing needs mount, query and renderItem.');
  }

  const loadItems = typeof load === 'function' ? load : async () => load;
  const baseDefaults = { q: '', sort: sorts[0] ? sorts[0].value : '', ...defaults };
  let state = { ...baseDefaults, ...(urlSync ? readUrlState(baseDefaults) : {}) };
  let items = [];
  let loaded = false;
  const offs = [];
  const id = 'listing-' + (++uid);

  const searchInput = el('input', {
    class: 'input', id: id + '-q', type: 'search',
    placeholder: searchPlaceholder, value: state.q,
  });
  const sortSelect = sorts.length
    ? el('select', { class: 'select', id: id + '-sort', 'aria-label': 'Sort by' },
        sorts.map((s) => el('option', { value: s.value }, [s.label])))
    : null;
  if (sortSelect) sortSelect.value = state.sort;
  const countLine = el('p', { class: 'result-count', role: 'status' });
  const groupRows = filters.map((g) => ({
    g,
    row: el('div', { class: 'filterbar-row', role: 'group', 'aria-label': g.label }),
  }));

  const bar = el('div', { class: 'filterbar' }, [
    el('div', { class: 'filterbar-row' }, [
      el('label', { class: 'visually-hidden', for: id + '-q' }, [searchLabel]),
      searchInput,
      sortSelect ? el('label', { class: 'visually-hidden', for: id + '-sort' }, ['Sort by']) : null,
      sortSelect,
    ]),
    ...groupRows.map((x) => x.row),
    countLine,
  ]);
  const results = el('div', { class: resultsClass || 'listing-results' });
  const root = el('section', { class: 'listing' }, [bar, results]);
  mount.appendChild(root);

  function optionsFor(g) {
    return typeof g.options === 'function' ? g.options(items) : (g.options || []);
  }

  function pill(g, o, active) {
    return el('button', {
      class: 'chip' + (active ? ' chip--active' : ''),
      type: 'button',
      'data-key': g.key,
      'data-value': o.value,
      'aria-pressed': String(active),
      onClick: () => toggle(g, o.value),
    }, [
      o.label,
      o.count != null ? el('span', { class: 'chip-count' }, [String(o.count)]) : null,
    ]);
  }

  function buildPills() {
    for (const { g, row } of groupRows) {
      clear(row);
      if (!g.multi) {
        row.appendChild(pill(g, { value: '', label: g.allLabel || 'All' }, !state[g.key]));
      }
      for (const o of optionsFor(g)) {
        const active = g.multi
          ? (state[g.key] || []).includes(o.value)
          : (state[g.key] || '') === o.value;
        row.appendChild(pill(g, o, active));
      }
    }
  }

  function toggle(g, value) {
    if (g.multi) {
      const cur = Array.isArray(state[g.key]) ? state[g.key].slice() : [];
      const idx = cur.indexOf(value);
      if (idx >= 0) cur.splice(idx, 1);
      else cur.push(value);
      update({ [g.key]: cur });
    } else {
      update({ [g.key]: (state[g.key] || '') === value ? '' : value });
    }
  }

  function syncControls() {
    searchInput.value = state.q || '';
    if (sortSelect) sortSelect.value = state.sort;
    for (const btn of qsa('button[data-key]', bar)) {
      const key = btn.dataset.key;
      const value = btn.dataset.value;
      const g = filters.find((f) => f.key === key);
      const active = g && g.multi
        ? (state[key] || []).includes(value)
        : (state[key] || '') === value;
      btn.classList.toggle('chip--active', active);
      btn.setAttribute('aria-pressed', String(active));
    }
  }

  function cloneDefaults() {
    const d = {};
    for (const [k, v] of Object.entries(baseDefaults)) d[k] = Array.isArray(v) ? v.slice() : v;
    return d;
  }

  function apply() {
    if (!loaded) return;
    const shown = query(items, state) || [];
    clear(results);
    if (!shown.length) {
      results.appendChild(el('div', { class: 'empty', style: { gridColumn: '1 / -1' } }, [
        el('p', {}, [emptyMessage]),
        el('button', { class: 'btn btn--ghost', type: 'button', onClick: () => update(cloneDefaults()) }, ['Clear filters']),
      ]));
    } else {
      for (const item of shown) results.appendChild(renderItem(item, state));
    }
    countLine.textContent = typeof count === 'function'
      ? count(shown, state)
      : shown.length + ' ' + (shown.length === 1 ? 'result' : 'results');
    syncControls();
  }

  function update(partial) {
    state = { ...state, ...partial };
    if (urlSync) writeUrlState(state, baseDefaults);
    apply();
  }

  function skeleton() {
    clear(results);
    results.appendChild(el('div', { class: 'skeleton', style: { gridColumn: '1 / -1' } }, [
      el('div', { class: 'skeleton-line skeleton-line--title' }),
      el('div', { class: 'skeleton-line' }),
      el('div', { class: 'skeleton-line' }),
      el('div', { class: 'skeleton-line skeleton-line--short' }),
    ]));
    countLine.textContent = 'Loading';
  }

  async function refresh() {
    loaded = false;
    skeleton();
    try {
      items = await loadItems();
      loaded = true;
      buildPills();
      apply();
    } catch (err) {
      clear(results);
      results.appendChild(el('div', { class: 'empty', style: { gridColumn: '1 / -1' } }, [
        el('p', {}, [err && err.message ? err.message : 'The list could not be loaded. Check your connection, then retry.']),
        el('button', { class: 'btn btn--primary', type: 'button', onClick: refresh }, ['Retry']),
      ]));
      countLine.textContent = '';
    }
  }

  const debouncedSearch = debounce((v) => update({ q: v }), 180);
  offs.push(on(searchInput, 'input', (e) => debouncedSearch(e.target.value)));
  if (sortSelect) offs.push(on(sortSelect, 'change', (e) => update({ sort: e.target.value })));
  if (urlSync) {
    offs.push(on(window, 'popstate', () => {
      state = { ...baseDefaults, ...readUrlState(baseDefaults) };
      syncControls();
      apply();
    }));
  }

  buildPills();
  syncControls();
  refresh();

  return {
    update,
    refresh,
    getState: () => ({ ...state }),
    destroy() {
      offs.forEach((off) => off());
      debouncedSearch.cancel();
      root.remove();
    },
  };
}
