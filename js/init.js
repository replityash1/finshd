/**
 * js/init.js — Bootstrap: auth listener, data load, initial render
 *
 * Loaded last in index.html (depends on all other modules).
 * Wires everything together on DOMContentLoaded.
 */

document.addEventListener('DOMContentLoaded', function() {
  // 1. Load syllabus content data into appState
  loadSyllabusData();

  // 2. Load user state from localStorage (instant, synchronous)
  loadFromLocal();

  // 3. Build search index for the active exam
  if (typeof buildSearchIndex === 'function') buildSearchIndex();

  // 4. Initialize navigation (exam tabs, theme, shortcuts, event listeners)
  initNav();

  // 5. Initialize connectivity listeners for sync status
  initConnectivityListeners();

  // 6. Set up Firebase auth listener
  _initAuth();

  // 7. Render the initial view
  _renderCurrentView();

  console.log('[init] App bootstrapped. Active exam:', appState.activeExamId,
    '| View:', appState.activeView,
    '| Topics with state:', Object.keys(appState.userState.topics).length);
});

/**
 * Set up Firebase auth state listener.
 * On sign-in: load cloud data (may overwrite local), update UI.
 * On sign-out: clear currentUser, update UI.
 */
function _initAuth() {
  if (typeof firebaseAuth === 'undefined') {
    console.warn('[init] Firebase Auth not available — running in guest-only mode.');
    return;
  }

  firebaseAuth.onAuthStateChanged(function(user) {
    var wasSignedIn = !!appState.currentUser;
    appState.currentUser = user || null;

    if (user) {
      console.log('[init] Signed in as:', user.displayName || user.email);
      // Load from Firestore (may overwrite local state)
      loadUserState().then(function() {
        if (typeof buildSearchIndex === 'function') buildSearchIndex();
        updateAuthUI(user);
        renderExamTabs();
        _renderCurrentView();
      });
    } else {
      if (wasSignedIn) {
        console.log('[init] Signed out.');
        showToast('Signed out. Your data is still saved locally.', { type: 'info' });
      }
      updateAuthUI(null);
      updateSyncIndicator('idle');
    }
  });
}

/**
 * Render the current active view.
 */
function _renderCurrentView() {
  // Make sure the correct view container is visible
  ['home', 'study', 'progress'].forEach(function(v) {
    var viewEl = $('view-' + v);
    if (!viewEl) return;
    if (v === appState.activeView) {
      viewEl.classList.add('view--active');
      viewEl.hidden = false;
    } else {
      viewEl.classList.remove('view--active');
      viewEl.hidden = true;
    }
  });

  // Call the view's render function if it exists
  switch (appState.activeView) {
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
