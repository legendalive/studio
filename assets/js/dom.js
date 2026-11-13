// Repo: studio — assets/js/dom.js — FULL file
// LegendAlive Studio — the single DOM helper module (plan T3).
// Every feature module builds nodes through el()/clear(). Nothing on this
// site assigns innerHTML with untrusted or user-derived strings.
// Phase 1 additions: toast, modal, confirmDialog, copyText (plan 6.7, T7).

const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

// el('a', { class: 'x', href: '#', onClick: fn }, ['label', childNode])
// Special props: class, text, dataset, style (object), on* (listener),
// value/checked/disabled/selected (DOM properties). Everything else is an
// attribute. Children: node, string, array (nested), null/false skipped.
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') { node.className = String(value); continue; }
    if (key === 'text') { node.textContent = String(value); continue; }
    if (key === 'dataset') {
      for (const [k, v] of Object.entries(value)) node.dataset[k] = String(v);
      continue;
    }
    if (key === 'style' && typeof value === 'object') {
      Object.assign(node.style, value);
      continue;
    }
    if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
      continue;
    }
    if (key === 'value' || key === 'checked' || key === 'disabled' || key === 'selected') {
      node[key] = value;
      continue;
    }
    node.setAttribute(key, value === true ? '' : String(value));
  }
  appendChildren(node, children);
  return node;
}

function appendChildren(node, children) {
  if (children == null || children === false) return;
  if (Array.isArray(children)) {
    for (const child of children) appendChildren(node, child);
    return;
  }
  node.appendChild(
    children instanceof Node ? children : document.createTextNode(String(children))
  );
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

// Returns an unsubscribe function.
export function on(target, type, handler, options) {
  target.addEventListener(type, handler, options);
  return () => target.removeEventListener(type, handler, options);
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

// Debounce with a .cancel() method. Default 180ms matches plan 12.1.
export function debounce(fn, wait = 180) {
  let timer = 0;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  wrapped.cancel = () => clearTimeout(timer);
  return wrapped;
}

/* ---------- Toast (plan 6.7) ---------- */

let toastRegion = null;

function ensureToastRegion() {
  if (toastRegion && toastRegion.isConnected) return toastRegion;
  toastRegion = el('div', { class: 'toast-region', role: 'status', 'aria-live': 'polite' });
  document.body.appendChild(toastRegion);
  return toastRegion;
}

// toast('Saved.', 'success') -> returns a dismiss function.
// Kinds: info (default) | success | warn | danger. Max 4 on screen.
export function toast(message, kind = 'info', opts = {}) {
  const region = ensureToastRegion();
  while (region.children.length >= 4) region.removeChild(region.firstChild);
  const k = ['success', 'warn', 'danger'].includes(kind) ? kind : 'info';
  let timer = 0;
  const node = el('div', { class: 'toast' + (k !== 'info' ? ' toast--' + k : '') }, [
    el('span', {}, [String(message)]),
    el('button', {
      class: 'toast-close', type: 'button', 'aria-label': 'Dismiss notification',
      onClick: () => dismiss(),
    }, ['\u00d7']),
  ]);
  function dismiss() {
    clearTimeout(timer);
    if (node.isConnected) node.remove();
  }
  region.appendChild(node);
  const timeout = typeof opts.timeout === 'number' ? opts.timeout : 4200;
  if (timeout > 0) timer = setTimeout(dismiss, timeout);
  return dismiss;
}

/* ---------- Modal (plan 6.7, T7) ---------- */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), ' +
  'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let modalCount = 0;
let modalSeq = 0;

// modal({ title, body, actions: [{ label, kind, onClick(close) }], onClose })
// Focus-trapped, Escape closes, backdrop click closes, focus restored.
export function modal({ title = '', body = '', actions = [], onClose } = {}) {
  const previouslyFocused = document.activeElement;
  const titleId = 'ls-modal-title-' + (++modalSeq);

  const panel = el('div', {
    class: 'modal-panel', role: 'dialog', 'aria-modal': 'true',
    'aria-labelledby': titleId, tabindex: '-1',
  }, [
    el('h2', { class: 'modal-title', id: titleId }, [String(title)]),
    el('div', {}, [body]),
    actions.length
      ? el('div', { class: 'modal-actions' }, actions.map((a) => el('button', {
          class: 'btn ' + (a.kind ? 'btn--' + a.kind : 'btn--ghost'),
          type: 'button',
          onClick: () => { if (typeof a.onClick === 'function') a.onClick(close); else close(); },
        }, [String(a.label)])))
      : null,
  ]);

  const rootEl = el('div', { class: 'modal' }, [
    el('div', { class: 'modal-backdrop', onClick: () => close() }),
    panel,
  ]);

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey, true);
    rootEl.remove();
    modalCount = Math.max(0, modalCount - 1);
    if (modalCount === 0) document.body.classList.remove('no-scroll');
    if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    if (typeof onClose === 'function') onClose();
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const items = qsa(FOCUSABLE, panel);
    if (!items.length) { e.preventDefault(); panel.focus(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }

  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(rootEl);
  modalCount += 1;
  document.body.classList.add('no-scroll');
  panel.focus();
  return { close, panel };
}

// Styled replacement for window.confirm. Resolves true/false.
export function confirmDialog({
  title = 'Are you sure?',
  message = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (v) => { if (!settled) { settled = true; resolve(v); } };
    modal({
      title,
      body: el('p', {}, [String(message)]),
      actions: [
        { label: cancelLabel, kind: 'ghost', onClick: (close) => { settle(false); close(); } },
        { label: confirmLabel, kind: danger ? 'danger' : 'primary', onClick: (close) => { settle(true); close(); } },
      ],
      onClose: () => settle(false),
    });
  });
}

/* ---------- Clipboard ---------- */

// Returns true on success. Falls back to a hidden textarea when the
// async clipboard API is unavailable or denied.
export async function copyText(text) {
  const value = String(text);
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch (err) { /* fall through to the legacy path */ }
  try {
    const ta = el('textarea', {
      style: { position: 'fixed', top: '-1000px', left: '-1000px', opacity: '0' },
    });
    ta.value = value;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (err) {
    return false;
  }
}
