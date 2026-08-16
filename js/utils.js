/**
 * js/utils.js — escapeHTML, staleness/date helpers, DOM helpers
 *
 * Shared utility functions used across all views.
 * Security: escapeHTML() escapes all five mandatory characters (& < > " ').
 */

// ── Security ────────────────────────────────────────────────────────────────

/**
 * Escape HTML special characters to prevent XSS.
 * Must escape all five: & < > " '
 * Use this before any string goes into innerHTML.
 * Prefer textContent where no markup is needed.
 */
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Date / Staleness Helpers ────────────────────────────────────────────────

/**
 * Get today's date as 'YYYY-MM-DD' string.
 */
function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Compute days between two date strings or Date objects.
 * Returns a positive integer (floor).
 */
function daysBetween(dateA, dateB) {
  const a = dateA instanceof Date ? dateA : new Date(dateA);
  const b = dateB instanceof Date ? dateB : new Date(dateB);
  const diffMs = Math.abs(b.getTime() - a.getTime());
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Compute staleness in days from a last_touched_at ISO timestamp.
 * Returns null if last_touched_at is null/undefined.
 */
function staleness(lastTouchedAt) {
  if (!lastTouchedAt) return null;
  return daysBetween(new Date(lastTouchedAt), new Date());
}

/**
 * Format a staleness value as a human-readable string.
 * e.g. 0 → "Today", 1 → "1 day ago", 14 → "2 weeks ago"
 */
function formatStaleness(days) {
  if (days === null || days === undefined) return 'Never touched';
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 7) return days + ' days ago';
  if (days < 14) return '1 week ago';
  if (days < 30) return Math.floor(days / 7) + ' weeks ago';
  if (days < 60) return '1 month ago';
  return Math.floor(days / 30) + ' months ago';
}

/**
 * Get a time-aware greeting for the Home screen.
 * Returns a short factual string — not fake-cheerful.
 */
function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 5) return 'Late night';
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  if (hour < 21) return 'Evening';
  return 'Night';
}

/**
 * Get the day of the week as a short string (e.g. "Tuesday").
 */
function getDayName() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long' });
}

/**
 * Format a date string for display. Returns e.g. "Aug 16, 2026"
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Compute days remaining until a target date string ('YYYY-MM-DD').
 * Returns a positive number, 0, or negative (past due).
 */
function daysUntil(targetDateStr) {
  if (!targetDateStr) return null;
  const target = new Date(targetDateStr + 'T23:59:59');
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Compute the current streak (consecutive days with activity).
 * Walks backwards from today in activity data.
 */
function computeStreak(activity) {
  if (!activity || Object.keys(activity).length === 0) return 0;

  let streak = 0;
  const today = new Date();
  // Start from today and walk backwards
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (activity[key] && activity[key] > 0) {
      streak++;
    } else {
      // Allow skipping today if the user hasn't studied yet
      if (i === 0) continue;
      break;
    }
  }
  return streak;
}

// ── DOM Helpers ─────────────────────────────────────────────────────────────

/**
 * Shorthand for document.getElementById.
 */
function $(id) {
  return document.getElementById(id);
}

/**
 * Create an element with optional class, attributes, and text content.
 * @param {string} tag - HTML tag name
 * @param {object} opts - { className, attrs: {}, textContent, innerHTML (escaped!) }
 * @returns {HTMLElement}
 */
function createElement(tag, opts) {
  opts = opts || {};
  const el = document.createElement(tag);
  if (opts.className) el.className = opts.className;
  if (opts.textContent) el.textContent = opts.textContent;
  if (opts.id) el.id = opts.id;
  if (opts.attrs) {
    for (const [key, val] of Object.entries(opts.attrs)) {
      el.setAttribute(key, val);
    }
  }
  return el;
}

/**
 * Remove all children from an element.
 */
function clearElement(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

/**
 * Show a toast notification.
 * Uses textContent (never innerHTML) for the message — security requirement.
 *
 * @param {string} message - Plain text message
 * @param {object} opts - { type: 'info'|'success'|'danger'|'warning', duration: ms, undoFn: function }
 */
function showToast(message, opts) {
  opts = opts || {};
  const duration = opts.duration || 5000;
  const type = opts.type || 'info';

  // Remove existing toast if any
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = createElement('div', { className: 'toast toast--' + type });

  const msgSpan = createElement('span', { className: 'toast__message', textContent: message });
  toast.appendChild(msgSpan);

  // Undo button if provided
  if (opts.undoFn && typeof opts.undoFn === 'function') {
    const undoBtn = createElement('button', {
      className: 'toast__undo',
      textContent: 'Undo',
      attrs: { type: 'button' }
    });
    undoBtn.addEventListener('click', function() {
      opts.undoFn();
      toast.remove();
    });
    toast.appendChild(undoBtn);
  }

  // Close button
  const closeBtn = createElement('button', {
    className: 'toast__close',
    textContent: '×',
    attrs: { type: 'button', 'aria-label': 'Dismiss' }
  });
  closeBtn.addEventListener('click', function() {
    toast.remove();
  });
  toast.appendChild(closeBtn);

  document.body.appendChild(toast);

  // Auto-dismiss
  const timer = setTimeout(function() {
    if (toast.parentNode) {
      toast.classList.add('toast--exiting');
      setTimeout(function() { toast.remove(); }, 200);
    }
  }, duration);

  // Animate in
  requestAnimationFrame(function() {
    toast.classList.add('toast--visible');
  });
}

/**
 * Debounce a function. Returns a debounced version.
 * @param {Function} fn
 * @param {number} delayMs
 * @returns {Function}
 */
function debounce(fn, delayMs) {
  let timer = null;
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function() {
      fn.apply(context, args);
    }, delayMs);
  };
}

/**
 * Generate a simple unique-ish ID for DOM elements.
 * Not crypto-secure — just for DOM id uniqueness.
 */
function uid() {
  return 'u' + Math.random().toString(36).slice(2, 9);
}
