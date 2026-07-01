// js/ui/dom.js
// Tiny DOM helpers. NOT a framework — no reactivity, no virtual DOM, no
// component lifecycle. Source: 01-PATTERNS.md §dom.js sketch.
//
// Security: textContent-only (T-07). innerHTML is never assigned anywhere
// in this module — `clear()` uses node.replaceChildren() instead.

/**
 * Create an element. Special prop keys:
 *   - `className` / `textContent` / standard DOM props → direct assignment
 *   - keys starting with `data-` → setAttribute (preserves the data-* contract)
 *   - `onClick` → addEventListener('click', handler)
 *
 * @param {string} tag
 * @param {object} [props]
 * @param {Array<Node|string>} [children]
 * @returns {HTMLElement}
 */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith('data-')) node.setAttribute(key, value);
    else if (key === 'onClick') node.addEventListener('click', value);
    else node[key] = value;
  }
  for (const child of children) {
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

/** Safely clear all children — preferred over `innerHTML = ""`. */
export function clear(node) {
  node.replaceChildren();
}

/** querySelector convenience. */
export function $(selector, root = document) {
  return root.querySelector(selector);
}
