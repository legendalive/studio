// Repo: studio — assets/js/dom.js — FULL file
// LegendAlive Studio — the single DOM helper module (plan T3).
// Every feature module builds nodes through el()/clear(). Nothing on this
// site assigns innerHTML with untrusted or user-derived strings.

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
