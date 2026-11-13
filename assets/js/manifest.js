// Repo: studio — assets/js/manifest.js — FULL file
// Fetch + cache + query for content/index.json (plan 8, 12.1, 13.3).
// One in-flight promise per page load; every query is a pure function over
// the manifest, so listings, the system map and the desk share one source.
// Dormant until Phase 2 creates content/index.json.

import { url, MANIFEST_PATH } from './config.js';

let inflight = null;

// loadManifest() resolves the parsed, normalized manifest.
// { force: true } bypasses the in-memory cache (the Desk uses this).
export function loadManifest({ force = false } = {}) {
  if (force) inflight = null;
  if (!inflight) {
    inflight = fetchManifest().catch((err) => { inflight = null; throw err; });
  }
  return inflight;
}

async function fetchManifest() {
  let res;
  try {
    // no-cache: revalidate with the server every load, so a fresh publish
    // is visible immediately after the Pages deploy (S4, S5).
    res = await fetch(url(MANIFEST_PATH), {
      cache: 'no-cache',
      headers: { accept: 'application/json' },
    });
  } catch (err) {
    throw new Error('Could not reach the content manifest. Check your connection, then retry.');
  }
  if (!res.ok) {
    throw new Error(
      'The content manifest returned HTTP ' + res.status +
      '. Confirm content/index.json exists on main and the Pages deploy is green, then retry.'
    );
  }
  const text = await res.text();
  const head = text.trimStart().slice(0, 200).toLowerCase();
  if (head.startsWith('<!doctype') || head.startsWith('<html')) {
    throw new Error(
      'The manifest came back as HTML instead of JSON. Check the latest Pages deploy, then retry. ' +
      'If it persists, rename content files to .txt and update CONTENT_EXT in config.js.'
    );
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error(
      'The content manifest is not valid JSON. Open content/index.json in the GitHub editor, ' +
      'check the last edit for a missing comma or quote, and commit again.'
    );
  }
  return normalize(data);
}

/* ---------- Normalization ---------- */

const SLUG_RE = /^[a-z0-9-]+$/;

function arr(v) { return Array.isArray(v) ? v : []; }

function validSlug(entry, label) {
  const ok = entry && typeof entry.slug === 'string' && SLUG_RE.test(entry.slug);
  if (!ok) console.warn('Manifest: skipped an entry in "' + label + '" with a missing or invalid slug.', entry);
  return ok;
}

function normalize(data) {
  const m = data && typeof data === 'object' ? data : {};
  return {
    version: Number(m.version) || 1,
    updated: typeof m.updated === 'string' ? m.updated : '',
    projects: arr(m.projects).filter((p) => validSlug(p, 'projects')),
    posts: arr(m.posts).filter((p) => validSlug(p, 'posts')),
    releases: arr(m.releases).filter((r) => r && typeof r.product === 'string' && typeof r.version === 'string'),
    capabilities: arr(m.capabilities).filter((c) => c && typeof c.id === 'string'),
  };
}

/* ---------- Shared query helpers ---------- */

function contains(haystack, q) { return String(haystack || '').toLowerCase().includes(q); }

function matchesQuery(fields, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => (Array.isArray(f) ? f.some((x) => contains(x, q)) : contains(f, q)));
}

const byName = (a, b) => String(a.name || a.title || '').localeCompare(String(b.name || b.title || ''));
const byDateDesc = (a, b) => String(b.date || '').localeCompare(String(a.date || ''));
const byDateAsc = (a, b) => String(a.date || '').localeCompare(String(b.date || ''));

function compareVersions(a, b) {
  const pa = String(a || '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

/* ---------- Projects ---------- */

// sort: 'featured' (default) | 'newest' | 'az'
export function getProjects(manifest, { status = '', category = '', query = '', sort = 'featured' } = {}) {
  let list = arr(manifest && manifest.projects);
  if (status) list = list.filter((p) => p.status === status);
  if (category) list = list.filter((p) => p.category === category);
  if (query) list = list.filter((p) => matchesQuery([p.name, p.tagline, p.stack], query));
  const sorted = list.slice();
  if (sort === 'newest') {
    sorted.sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0) || byName(a, b));
  } else if (sort === 'az') {
    sorted.sort(byName);
  } else {
    sorted.sort((a, b) =>
      Number(Boolean(b.featured)) - Number(Boolean(a.featured)) ||
      (Number(a.order) || 999) - (Number(b.order) || 999) ||
      (Number(b.year) || 0) - (Number(a.year) || 0) ||
      byName(a, b)
    );
  }
  return sorted;
}

/* ---------- Posts ---------- */

// Drafts hidden unless includeDrafts (Desk only). Multiple selected tags
// narrow the list: every selected tag must be present on the post.
// sort: 'newest' (default) | 'oldest' | 'az'
export function getPosts(manifest, { query = '', tags = [], kind = '', sort = 'newest', includeDrafts = false } = {}) {
  let list = arr(manifest && manifest.posts);
  if (!includeDrafts) list = list.filter((p) => p.draft !== true);
  if (kind) list = list.filter((p) => p.kind === kind);
  const wanted = arr(tags).map((t) => String(t).toLowerCase());
  if (wanted.length) {
    list = list.filter((p) => {
      const have = arr(p.tags).map((t) => String(t).toLowerCase());
      return wanted.every((t) => have.includes(t));
    });
  }
  if (query) list = list.filter((p) => matchesQuery([p.title, p.dek, p.tags], query));
  const sorted = list.slice();
  if (sort === 'oldest') sorted.sort((a, b) => byDateAsc(a, b) || byName(a, b));
  else if (sort === 'az') sorted.sort(byName);
  else sorted.sort((a, b) => byDateDesc(a, b) || byName(a, b));
  return sorted;
}

/* ---------- Releases ---------- */

export function getReleases(manifest, { product = '', tag = '', query = '' } = {}) {
  let list = arr(manifest && manifest.releases);
  if (product) list = list.filter((r) => r.product === product);
  if (tag) list = list.filter((r) => arr(r.tags).includes(tag));
  if (query) list = list.filter((r) => matchesQuery([r.title, r.summary, r.version, r.product], query));
  return list.slice().sort((a, b) => byDateDesc(a, b) || compareVersions(b.version, a.version));
}

/* ---------- Lookups, tags, dates ---------- */

export function getCapabilities(manifest) { return arr(manifest && manifest.capabilities); }

export function capabilityById(manifest, id) {
  return getCapabilities(manifest).find((c) => c.id === id) || null;
}

export function findBySlug(list, slug) {
  return arr(list).find((x) => x && x.slug === slug) || null;
}

// Tag pills with counts, derived at runtime (plan 12.2). Drafts excluded.
export function allTags(posts) {
  const counts = new Map();
  arr(posts).forEach((p) => {
    if (p && p.draft === true) return;
    arr(p.tags).forEach((t) => {
      const tag = String(t);
      counts.set(tag, (counts.get(tag) || 0) + 1);
    });
  });
  return Array.from(counts, ([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

// '2026-11-13' -> '13 Nov 2026'. Empty string for missing/invalid input.
export function formatDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return '';
  const d = new Date(String(iso) + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}
