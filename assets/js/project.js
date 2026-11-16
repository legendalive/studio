// LegendAlive Studio — reader for Markdown-driven project case studies.
// A stub at work/<slug>/index.html sets window.__PROJECT_SLUG__ and loads
// this module. Metadata comes from content/index.json, prose from the
// project's Markdown body. Weaver keeps its hand-authored page; every
// other project uses this. Layout and states live in page.js.

import { url } from './config.js';
import { el, clear } from './dom.js';
import { applyMeta, absoluteUrl, LABELS } from './chrome.js';
import { loadManifest, findBySlug } from './manifest.js';
import {
  ensureProseStyles, bootSkeleton, copyLinkButton,
  fatalPage, renderLongForm, loadBody,
} from './page.js';

const app = document.getElementById('app');
const slug = String(window.__PROJECT_SLUG__ || '');

function projectHead(project) {
  const links = project.links || {};
  const actions = [];
  if (links.app) {
    actions.push(el('a', { class: 'btn btn--primary', href: links.app, target: '_blank', rel: 'noopener' }, ['Open app']));
  }
  if (links.source) {
    actions.push(el('a', { class: 'btn btn--ghost', href: links.source, target: '_blank', rel: 'noopener' }, ['Source code']));
  }
  if (links.site) {
    actions.push(el('a', { class: 'btn btn--ghost', href: links.site, target: '_blank', rel: 'noopener' }, ['Product site']));
  }
  if (links.pricing) {
    actions.push(el('a', { class: 'btn btn--ghost', href: links.pricing, target: '_blank', rel: 'noopener' }, ['Pricing']));
  }
  actions.push(copyLinkButton());

  const meta = [
    project.year ? String(project.year) : '',
    LABELS.category[project.category] || project.category || '',
    LABELS.status[project.status] || project.status || '',
  ].filter(Boolean);

  const stack = project.stack || [];

  return [
    el('h1', {}, [project.name]),
    el('p', { class: 'lede' }, [project.tagline || '']),
    el('div', { class: 'page-head-meta' }, meta.map((m) => el('span', {}, [m]))),
    stack.length
      ? el('div', { class: 'pill-row', style: { marginTop: '16px' } },
          stack.map((s) => el('span', { class: 'chip-stack' }, [s])))
      : null,
    el('div', { class: 'btn-row', style: { marginTop: '24px' } }, actions),
  ];
}

function projectNav() {
  return el('nav', { class: 'case-nav', 'aria-label': 'More work' }, [
    el('a', { class: 'text-link', href: url('work/') }, ['Back to all work']),
    el('a', { class: 'text-link', href: url('') }, ['Home']),
  ]);
}

function applyProjectMeta(project) {
  const path = 'work/' + project.slug + '/';
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: project.name,
    description: project.tagline || '',
    operatingSystem: 'Any',
    url: (project.links && project.links.app) || absoluteUrl(path),
  };
  if (project.category === 'tool') ld.applicationCategory = 'DeveloperApplication';

  applyMeta({
    title: project.name + ' — Case study — LegendAlive Studio',
    ogTitle: project.name + ' — Case study',
    description: project.tagline || '',
    path,
    type: 'article',
    jsonLd: ld,
  });
}

async function start() {
  ensureProseStyles();
  if (!app) return;

  if (!slug) {
    fatalPage({
      app,
      current: 'work',
      heading: 'Case study',
      message: 'This page did not receive a project slug. Open the work index and choose a project.',
      backHref: url('work/'),
      backLabel: 'Back to work',
    });
    return;
  }

  bootSkeleton(app, 'Loading case study');

  let data;
  try {
    data = await loadManifest();
  } catch (err) {
    fatalPage({
      app,
      current: 'work',
      heading: 'Case study',
      message: err && err.message ? err.message : 'The content manifest could not be loaded. Check your connection, then retry.',
      retry: () => start(),
      backHref: url('work/'),
      backLabel: 'Back to work',
    });
    return;
  }

  const project = findBySlug(data.projects, slug);
  if (!project) {
    fatalPage({
      app,
      current: 'work',
      heading: 'Case study',
      message: 'No project with slug "' + slug + '" is in the manifest. It may have been renamed. Open the work index to find it.',
      backHref: url('work/'),
      backLabel: 'Back to work',
    });
    return;
  }

  applyProjectMeta(project);

  const { prose, rail, grid } = renderLongForm({
    app,
    current: 'work',
    projects: data.projects,
    head: projectHead(project),
    nav: projectNav(),
  });

  if (!project.body) {
    clear(prose);
    grid.classList.add('no-rail');
    prose.appendChild(el('p', {}, [
      project.tagline || 'This project has no long-form body yet.',
    ]));
    return;
  }

  await loadBody({
    path: 'content/' + project.body,
    label: 'case study',
    prose, rail, grid,
    backHref: url('work/'),
    backLabel: 'Back to work',
  });
}

start();
