/**
 * js/nav.js — Tab switching, keyboard shortcuts, theme toggle
 *
 * Handles:
 * - View switching (Home / Study / Progress) via nav buttons
 * - Exam tab switching
 * - Theme toggle (dark ↔ light), persisted in preferences
 * - Keyboard shortcut scaffolding (/, Cmd/Ctrl+K, Esc)
 * - Sync status indicator updates
 * - Auth modal open/close
 */

// ── View Switching ──────────────────────────────────────────────────────────

/**
 * Switch the active view. Updates nav buttons, view visibility, and appState.
 */
function switchView(viewName) {
  if (viewName === appState.activeView) return;

  const validViews = ['home', 'study', 'progress'];
  if (!validViews.includes(viewName)) return;

  setActiveView(viewName);

  // Update view containers
  validViews.forEach(function(v) {
    const viewEl = $('view-' + v);
    if (!viewEl) return;

    if (v === viewName) {
      viewEl.classList.add('view--active');
      viewEl.hidden = false;
      viewEl.removeAttribute('hidden');
    } else {
      viewEl.classList.remove('view--active');
      viewEl.hidden = true;
    }
  });

  // Update nav buttons (both mobile and desktop)
  _updateNavButtons(viewName);

  // Trigger view-specific render
  _onViewEnter(viewName);
}

/**
 * Update active state on all nav buttons for the given view.
 */
function _updateNavButtons(viewName) {
  // Desktop rail
  document.querySelectorAll('.nav-item[data-view]').forEach(function(btn) {
    if (btn.dataset.view === viewName) {
      btn.classList.add('nav-item--active');
      btn.setAttribute('aria-current', 'page');
    } else {
      btn.classList.remove('nav-item--active');
      btn.removeAttribute('aria-current');
    }
  });

  // Mobile bottom nav
  document.querySelectorAll('.nav-bottom__item[data-view]').forEach(function(btn) {
    if (btn.dataset.view === viewName) {
      btn.classList.add('nav-bottom__item--active');
      btn.setAttribute('aria-current', 'page');
    } else {
      btn.classList.remove('nav-bottom__item--active');
      btn.removeAttribute('aria-current');
    }
  });
}

/**
 * Called when a view becomes active. Renders view content if the
 * render function exists (built in later phases).
 */
function _onViewEnter(viewName) {
  switch (viewName) {
    case 'home':
      if (typeof renderHome === 'function') renderHome();
      break;
    case 'study':
      if (typeof renderStudy === 'function') renderStudy();
      break;
    case 'progress':
      if (typeof renderProgress === 'function') renderProgress();
      break;
  }
}

// ── Exam Tab Switching ──────────────────────────────────────────────────────

/**
 * Render the exam selector tabs in the exam bar.
 */
function renderExamTabs() {
  const container = document.querySelector('.exam-bar__tabs');
  if (!container) return;

  clearElement(container);

  EXAMS.forEach(function(exam) {
    var tab = createElement('button', {
      className: 'exam-tab' + (exam.id === appState.activeExamId ? ' exam-tab--active' : ''),
      attrs: {
        'data-exam': exam.id,
        'role': 'tab',
        'aria-selected': exam.id === appState.activeExamId ? 'true' : 'false',
        'type': 'button'
      }
    });

    // Accent dot
    var dot = createElement('span', { className: 'exam-tab__dot' });
    dot.style.backgroundColor = 'var(' + exam.accentVar + ')';
    tab.appendChild(dot);

    // Label
    var label = createElement('span', { textContent: exam.shortName });
    tab.appendChild(label);

    tab.addEventListener('click', function() {
      _switchExam(exam.id);
    });

    container.appendChild(tab);
  });
}

/**
 * Switch the active exam. Re-renders exam tabs and triggers view re-render.
 */
function _switchExam(examId) {
  if (examId === appState.activeExamId) return;

  setActiveExam(examId);
  renderExamTabs();
  saveUserState();

  // Re-render the current view with the new exam's data
  _onViewEnter(appState.activeView);
}

// ── Theme Toggle ────────────────────────────────────────────────────────────

/**
 * Toggle between dark and light themes.
 * Updates the HTML attribute, appState, and persists the preference.
 */
function toggleTheme() {
  var newTheme = appState.preferences.theme === 'dark' ? 'light' : 'dark';
  _applyTheme(newTheme);
  appState.preferences.theme = newTheme;
  saveUserState();
}

/**
 * Apply a theme without saving (used on initial load).
 */
function _applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  // Update meta theme-color for mobile browser chrome
  var metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', theme === 'dark' ? '#7c6df0' : '#6c5ce7');
  }
}

// ── Sync Status ─────────────────────────────────────────────────────────────

/**
 * Update the sync status indicator in the UI.
 */
function updateSyncIndicator(status) {
  var indicators = document.querySelectorAll('.sync-indicator');
  indicators.forEach(function(el) {
    el.setAttribute('data-status', status);

    // Update tooltip
    var titles = {
      idle: 'No pending changes',
      saving: 'Saving…',
      synced: 'All changes synced',
      offline: 'Offline — changes saved locally'
    };
    el.setAttribute('title', titles[status] || status);
  });
}

// ── Auth Modal ──────────────────────────────────────────────────────────────

function openAuthModal() {
  var overlay = $('auth-modal-overlay');
  if (overlay) overlay.hidden = false;
}

function closeAuthModal() {
  var overlay = $('auth-modal-overlay');
  if (overlay) overlay.hidden = true;
}

/**
 * Update the auth button to show signed-in state.
 */
function updateAuthUI(user) {
  var desktopBtn = $('nav-auth-desktop');
  if (!desktopBtn) return;

  if (user) {
    // Show user photo or initial
    if (user.photoURL) {
      desktopBtn.innerHTML = '';
      var img = createElement('img', {
        className: 'nav-auth-btn__photo',
        attrs: { src: user.photoURL, alt: '', referrerpolicy: 'no-referrer' }
      });
      desktopBtn.appendChild(img);
    }
    desktopBtn.setAttribute('aria-label', 'Signed in as ' + (user.displayName || user.email || 'user'));
  } else {
    desktopBtn.setAttribute('aria-label', 'Sign in');
    desktopBtn.innerHTML = '<svg class="nav-item__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  }
}

// ── Keyboard Shortcuts ──────────────────────────────────────────────────────

function _initKeyboardShortcuts() {
  document.addEventListener('keydown', function(e) {
    // Don't capture if user is typing in an input/textarea
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;

    // Cmd/Ctrl+K — open command palette
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (typeof openCommandPalette === 'function') {
        openCommandPalette();
      }
      return;
    }

    // "/" — focus search (same as Cmd+K)
    if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      if (typeof openCommandPalette === 'function') {
        openCommandPalette();
      }
      return;
    }

    // Escape — close any open overlay
    if (e.key === 'Escape') {
      // Close command palette if open
      var cmdOverlay = $('cmd-palette-overlay');
      if (cmdOverlay && !cmdOverlay.hidden) {
        if (typeof closeCommandPalette === 'function') {
          closeCommandPalette();
        } else {
          cmdOverlay.hidden = true;
        }
        return;
      }

      // Close auth modal if open
      var authOverlay = $('auth-modal-overlay');
      if (authOverlay && !authOverlay.hidden) {
        closeAuthModal();
        return;
      }
    }

    // Number keys 1-3 to switch views (desktop convenience)
    if (e.key === '1' && !e.metaKey && !e.ctrlKey) { switchView('home'); return; }
    if (e.key === '2' && !e.metaKey && !e.ctrlKey) { switchView('study'); return; }
    if (e.key === '3' && !e.metaKey && !e.ctrlKey) { switchView('progress'); return; }
  });
}

// ── Event Binding ───────────────────────────────────────────────────────────

/**
 * Initialize all nav event listeners. Called once from init.js.
 */
function initNav() {
  // View switching — desktop rail
  document.querySelectorAll('.nav-item[data-view]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      switchView(btn.dataset.view);
    });
  });

  // View switching — mobile bottom nav
  document.querySelectorAll('.nav-bottom__item[data-view]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      switchView(btn.dataset.view);
    });
  });

  // Theme toggle — both desktop and mobile triggers
  var themeDesktop = $('nav-theme-desktop');
  if (themeDesktop) themeDesktop.addEventListener('click', toggleTheme);

  // Search triggers
  var searchDesktop = $('nav-search-desktop');
  var searchMobile = $('nav-search-mobile');
  if (searchDesktop) {
    searchDesktop.addEventListener('click', function() {
      if (typeof openCommandPalette === 'function') openCommandPalette();
    });
  }
  if (searchMobile) {
    searchMobile.addEventListener('click', function() {
      if (typeof openCommandPalette === 'function') openCommandPalette();
    });
  }

  // Auth button
  var authDesktop = $('nav-auth-desktop');
  if (authDesktop) {
    authDesktop.addEventListener('click', function() {
      if (appState.currentUser) {
        // Already signed in — could show profile menu later
        // For now, sign out
        if (typeof firebaseAuth !== 'undefined') {
          firebaseAuth.signOut();
        }
      } else {
        openAuthModal();
      }
    });
  }

  // Auth modal buttons
  var googleBtn = $('btn-google-signin');
  if (googleBtn) {
    googleBtn.addEventListener('click', function() {
      if (typeof firebaseAuth !== 'undefined' && typeof googleProvider !== 'undefined') {
        firebaseAuth.signInWithPopup(googleProvider)
          .then(function() {
            closeAuthModal();
          })
          .catch(function(err) {
            console.error('Sign in failed:', err);
            showToast('Sign in failed. Try again.', { type: 'danger' });
          });
      }
    });
  }

  var guestBtn = $('btn-continue-guest');
  if (guestBtn) guestBtn.addEventListener('click', closeAuthModal);

  var closeBtn = $('auth-modal-close');
  if (closeBtn) closeBtn.addEventListener('click', closeAuthModal);

  // Sync status listener
  document.addEventListener('syncStatusChange', function(e) {
    updateSyncIndicator(e.detail.status);
  });

  // Keyboard shortcuts
  _initKeyboardShortcuts();

  // Render exam tabs
  renderExamTabs();

  // Apply saved theme
  _applyTheme(appState.preferences.theme || 'dark');
}
