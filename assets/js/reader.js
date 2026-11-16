// LegendAlive Studio — the article reader.
// A stub at p/<slug>/index.html sets window.__POST_SLUG__ and loads this
// module. Metadata comes from content/index.json; prose from
// content/posts/<slug> + CONTENT_EXT. Drafts render as noindex previews at
// their own URL and stay out of every listing. Layout and states: page.js.

import { SITE, OWNER, url, CONTENT_EXT } from './config.js';
import { el } from './dom.js';
import { applyMeta, absoluteUrl } from './chrome.js';
import { loadManifest, getPosts, findBySlug, formatDate } from './manifest.js';
import { countWords } from './markdown.js';
import {
  ensureProseStyles, bootSkeleton, copyLinkButton,
  fatalPage, renderLongForm, loadBody,
} from './page.js';

const app = document.getElementById('app');
const slug = String(window.__POST_SLUG__ || '');
const WORDS_PER_MINUTE = 220;

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
    tags.length
      ? el('div', { class: 'post-tags', style: { marginTop: '16px' } },
          tags.map((t) => el('span', { class: 'tag' }, [t])))
      : null,
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
      el('p', {}, [
        'This article is not published. It is absent from the writing index, the home page and the sitemap, and search engines are told not to index it. Review it here, then publish it by clearing the draft flag in the manifest.',
      ]),
    ]),
  ]);
}

function articleNav(post, data) {
  const published = getPosts(data);
  const idx = published.findIndex((p) => p.slug === post.slug);
  const newer = idx > 0 ? published[idx - 1] : null;
  const older = idx >= 0 && idx < published.length - 1 ? published[idx + 1] : null;

  return el('nav', { class: 'case-nav', 'aria-label': 'More writing' }, [
    older
      ? el('a', { class: 'text-link', style: { maxWidth: '34ch' }, href: url('p/' + older.slug + '/') }, ['← ', older.title])
      : el('span'),
    el('a', { class: 'text-link', href: url('writing/') }, ['All writing']),
    newer
      ? el('a', { class: 'text-link', style: { maxWidth: '34ch' }, href: url('p/' + newer.slug + '/') }, [newer.title, ' →'])
      : el('span'),
  ]);
}

function applyArticleMeta(post) {
  const path = 'p/' + post.slug + '/';
  const ld = post.draft ? null : {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.dek || '',
    datePublished: post.date || '',
    dateModified: post.updated || post.date || '',
    inLanguage: 'en',
    keywords: (post.tags || []).join(', '),
    author: { '@type': 'Person', name: OWNER.name, url: absoluteUrl('about/') },
    publisher: { '@type': 'Organization', name: SITE.name, url: absoluteUrl('') },
    mainEntityOfPage: absoluteUrl(path),
  };

  applyMeta({
    title: (post.draft ? 'Draft — ' : '') + post.title + ' — LegendAlive Studio',
    ogTitle: post.title,
    description: post.dek || '',
    path,
    type: 'article',
    robots: post.draft ? 'noindex, nofollow' : 'index, follow',
    published: post.date || '',
    modified: post.updated || post.date || '',
    tags: post.tags || [],
    jsonLd: ld,
  });
}

async function start() {
  ensureProseStyles();
  if (!app) return;

  if (!slug) {
    fatalPage({
      app,
      current: 'writing',
      heading: 'Article',
      message: 'This page did not receive an article slug. Open the writing index and choose an article.',
      backHref: url('writing/'),
      backLabel: 'Back to writing',
    });
    return;
  }

  bootSkeleton(app, 'Loading article');

  let data;
  try {
    data = await loadManifest();
  } catch (err) {
    fatalPage({
      app,
      current: 'writing',
      heading: 'Article',
      message: err && err.message ? err.message : 'The content manifest could not be loaded. Check your connection, then retry.',
      retry: () => start(),
      backHref: url('writing/'),
      backLabel: 'Back to writing',
    });
    return;
  }

  const post = findBySlug(data.posts, slug);
  if (!post) {
    fatalPage({
      app,
      current: 'writing',
      heading: 'Article',
      message: 'No article with slug "' + slug + '" is in the manifest. It may have been renamed. Open the writing index to find it.',
      backHref: url('writing/'),
      backLabel: 'Back to writing',
    });
    return;
  }

  applyArticleMeta(post);

  const readTime = el('span', {}, [(post.minutes || 1) + ' min read']);
  const { prose, rail, grid } = renderLongForm({
    app,
    current: 'writing',
    projects: data.projects,
    head: articleHead(post, readTime),
    notice: post.draft ? draftNotice() : null,
    nav: articleNav(post, data),
  });

  await loadBody({
    path: 'content/posts/' + post.slug + CONTENT_EXT,
    label: 'article',
    prose, rail, grid,
    backHref: url('writing/'),
    backLabel: 'Back to writing',
    onRendered: (text) => {
      const minutes = Math.max(1, Math.round(countWords(text) / WORDS_PER_MINUTE));
      readTime.textContent = minutes + ' min read';
    },
  });
}

start();
