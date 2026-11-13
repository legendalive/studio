// Repo: studio — assets/js/config.js — FULL file
// LegendAlive Studio — single source of constants.
// At domain cutover (Phase 0C) exactly ONE line changes: BASE, below.

export const BASE = '/studio/'; // -> '/' when legendalive.is-a.dev is attached

export const SITE = {
  name: 'LegendAlive Studio',
  shortName: 'LegendAlive',
  tagline: 'We build software and keep it running.',
  description:
    'An independent software studio. Products in production, engineering case studies, technical writing and release notes.',
  domain: 'https://legendalive.is-a.dev',          // canonical, after cutover
  preview: 'https://legendalive.github.io/studio/', // live URL until cutover
  yearStart: 2026,
};

export const OWNER = {
  name: 'Benson Mtsotso',
  email: 'mbenson.mb62@gmail.com',
  github: 'legendalive',
  githubUrl: 'https://github.com/legendalive',
  gumroadUrl: 'https://mbenson62.gumroad.com',
};

export const LINKS = {
  studioRepo: 'https://github.com/legendalive/studio',
  weaver: {
    app: 'https://legendalive.github.io/Weaver/',
    site: 'https://weaver-studio.pages.dev/',
    features: 'https://weaver-studio.pages.dev/features',
    pricing: 'https://weaver-studio.pages.dev/pricing',
    monthly: 'https://mbenson62.gumroad.com/l/weaver-monthly',
    yearly: 'https://mbenson62.gumroad.com/l/weaver-yearly',
    lifetime: 'https://mbenson62.gumroad.com/l/weaver-lifetime',
  },
  repobundle: {
    // Exact casing — GitHub Pages paths are case-sensitive.
    app: 'https://legendalive.github.io/RepoBundle/',
    source: 'https://github.com/legendalive/RepoBundle',
  },
};

// Plan 13.3 fallback: if raw Markdown fetches ever return HTML (Jekyll
// artefact), rename content files to .txt and change this ONE constant.
export const CONTENT_EXT = '.md';

export const MANIFEST_PATH = 'content/index.json';

// Every internal href and fetch is built from BASE through this helper.
// url('work/') -> '/studio/work/'  (and '/work/' after cutover)
export function url(path = '') {
  return BASE + String(path).replace(/^\/+/, '');
}
