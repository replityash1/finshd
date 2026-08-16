/**
 * js/storage.js — localStorage + Firestore dual persistence
 *
 * The only module that touches localStorage and Firestore directly.
 * Views never read/write persistence themselves — they go through
 * state.js accessors, then call saveUserState() here.
 *
 * Persistence strategy (ARCHITECTURE.md §4):
 * - Guest: localStorage, written immediately on every state change.
 * - Signed-in: Firestore document per user (users/{uid}), debounced
 *   at 1.5s after the last change to avoid write-storming.
 * - On sign-in with existing local data + no cloud doc: migrate once.
 * - Document size guard: warn before exceeding Firestore's 1MB limit.
 */

// ── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY_USER_STATE = 'finshd_userState';
const STORAGE_KEY_PREFERENCES = 'finshd_preferences';
const STORAGE_KEY_LAST_EXAM = 'finshd_lastExam';
const STORAGE_KEY_LAST_TOPIC = 'finshd_lastTopic';
const STORAGE_KEY_LAST_TOPIC_EXAM = 'finshd_lastTopicExam';

// Old app used a different shape — detect and migrate once
const STORAGE_KEY_OLD_FORMAT = 'syllabusTracker_state';

// Firestore document size ceiling (bytes). Warn at 800KB, hard cap at 1MB.
const FIRESTORE_WARN_SIZE = 800 * 1024;
const FIRESTORE_MAX_SIZE = 1024 * 1024;

// Debounce delay for Firestore writes (ms)
const SYNC_DEBOUNCE_MS = 1500;

// ── Local Storage ───────────────────────────────────────────────────────────

/**
 * Save the current userState + preferences to localStorage.
 * Called on every state-changing action — localStorage writes are fast
 * enough that debouncing isn't needed.
 */
function saveToLocal() {
  try {
    localStorage.setItem(STORAGE_KEY_USER_STATE, JSON.stringify(appState.userState));
    localStorage.setItem(STORAGE_KEY_PREFERENCES, JSON.stringify(appState.preferences));
    localStorage.setItem(STORAGE_KEY_LAST_EXAM, appState.activeExamId);
    if (appState.lastTouchedTopicId) {
      localStorage.setItem(STORAGE_KEY_LAST_TOPIC, appState.lastTouchedTopicId);
    }
    if (appState.lastTouchedExamId) {
      localStorage.setItem(STORAGE_KEY_LAST_TOPIC_EXAM, appState.lastTouchedExamId);
    }
  } catch (e) {
    // localStorage full or unavailable — degrade gracefully
    console.warn('localStorage write failed:', e.message);
  }
}

/**
 * Load userState + preferences from localStorage into appState.
 * Returns true if data was found and loaded, false otherwise.
 */
function loadFromLocal() {
  try {
    const stateJson = localStorage.getItem(STORAGE_KEY_USER_STATE);
    const prefsJson = localStorage.getItem(STORAGE_KEY_PREFERENCES);
    const lastExam = localStorage.getItem(STORAGE_KEY_LAST_EXAM);
    const lastTopic = localStorage.getItem(STORAGE_KEY_LAST_TOPIC);
    const lastTopicExam = localStorage.getItem(STORAGE_KEY_LAST_TOPIC_EXAM);

    if (stateJson) {
      const parsed = JSON.parse(stateJson);
      // Validate shape — must have topics and activity
      if (parsed && typeof parsed === 'object') {
        appState.userState = {
          topics: parsed.topics || {},
          activity: parsed.activity || {}
        };
      }
    }

    if (prefsJson) {
      const parsed = JSON.parse(prefsJson);
      if (parsed && typeof parsed === 'object') {
        // Merge into defaults so new preference keys don't break
        appState.preferences = Object.assign({}, appState.preferences, parsed);
      }
    }

    if (lastExam && EXAMS.some(function(e) { return e.id === lastExam; })) {
      appState.activeExamId = lastExam;
    }

    if (lastTopic) {
      appState.lastTouchedTopicId = lastTopic;
    }
    if (lastTopicExam) {
      appState.lastTouchedExamId = lastTopicExam;
    }

    return !!stateJson;
  } catch (e) {
    console.warn('localStorage read failed:', e.message);
    return false;
  }
}

// ── Old Format Migration (DATA_MODEL.md §3.4) ──────────────────────────────

/**
 * Check for old-format data and migrate to new flat shape.
 * The old app embedded completed/revision/bookmarked/notes directly
 * on each topic node in the syllabus tree.
 *
 * Returns true if migration occurred.
 */
function migrateOldFormat() {
  try {
    const oldData = localStorage.getItem(STORAGE_KEY_OLD_FORMAT);
    if (!oldData) return false;

    const parsed = JSON.parse(oldData);
    if (!parsed) return false;

    // Old format might be an object with exam keys containing syllabus trees
    // with embedded state on each node. Walk and extract.
    let migrated = false;

    function extractState(node) {
      if (!node || !node.id) return;

      const hasState = node.completed || node.revision || node.bookmarked || node.notes;
      if (hasState) {
        appState.userState.topics[node.id] = {
          completed: !!node.completed,
          revision: !!node.revision,
          bookmarked: !!node.bookmarked,
          notes: node.notes || '',
          last_touched_at: null,
          completed_at: node.completed ? new Date().toISOString() : null
        };
        migrated = true;
      }

      const kids = node.children || node.topics || [];
      for (const child of kids) {
        extractState(child);
      }
    }

    // Try both shapes: direct syllabus array or keyed by exam
    if (Array.isArray(parsed)) {
      for (const node of parsed) extractState(node);
    } else if (typeof parsed === 'object') {
      for (const key of Object.keys(parsed)) {
        const val = parsed[key];
        if (Array.isArray(val)) {
          for (const node of val) extractState(node);
        } else if (val && val.subjects) {
          for (const subj of val.subjects) extractState(subj);
        }
      }
    }

    if (migrated) {
      // Save the migrated data in new format
      saveToLocal();
      // Remove old key so migration doesn't re-run
      localStorage.removeItem(STORAGE_KEY_OLD_FORMAT);
      console.log('Migrated old-format data to new userState shape.');
    }

    return migrated;
  } catch (e) {
    console.warn('Old format migration failed:', e.message);
    return false;
  }
}

// ── Firestore Sync ──────────────────────────────────────────────────────────

/**
 * Estimate the serialized size of an object in bytes (rough).
 * Used for the document-size guard before Firestore writes.
 */
function estimateSize(obj) {
  try {
    return new Blob([JSON.stringify(obj)]).size;
  } catch (e) {
    // Blob not available — estimate via string length (UTF-8 can be larger)
    return JSON.stringify(obj).length * 2;
  }
}

/**
 * Save userState + preferences to Firestore for the signed-in user.
 * Includes document-size guard.
 */
function saveToFirestore() {
  if (!appState.currentUser) return Promise.resolve();

  const uid = appState.currentUser.uid;
  const docData = {
    userState: appState.userState,
    preferences: appState.preferences,
    lastTouchedTopicId: appState.lastTouchedTopicId,
    lastTouchedExamId: appState.lastTouchedExamId,
    activeExamId: appState.activeExamId,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  // Document-size guard
  const size = estimateSize(docData);
  if (size > FIRESTORE_MAX_SIZE) {
    console.error('Firestore write blocked: document too large (' + Math.round(size / 1024) + 'KB)');
    showToast('Data too large to sync. Consider clearing old notes.', { type: 'danger' });
    return Promise.resolve();
  }
  if (size > FIRESTORE_WARN_SIZE) {
    console.warn('Firestore document approaching size limit: ' + Math.round(size / 1024) + 'KB');
    showToast('Your data is getting large. Consider exporting a backup.', { type: 'warning' });
  }

  _setSyncStatus('saving');

  return firebaseDb.collection('users').doc(uid).set(docData, { merge: true })
    .then(function() {
      _setSyncStatus('synced');
    })
    .catch(function(err) {
      console.error('Firestore write failed:', err);
      _setSyncStatus('offline');
    });
}

/**
 * Load userState + preferences from Firestore for the signed-in user.
 * Returns true if cloud data was found and loaded.
 */
function loadFromFirestore() {
  if (!appState.currentUser) return Promise.resolve(false);

  const uid = appState.currentUser.uid;

  return firebaseDb.collection('users').doc(uid).get()
    .then(function(doc) {
      if (!doc.exists) return false;

      const data = doc.data();
      if (data.userState && typeof data.userState === 'object') {
        appState.userState = {
          topics: data.userState.topics || {},
          activity: data.userState.activity || {}
        };
      }
      if (data.preferences && typeof data.preferences === 'object') {
        appState.preferences = Object.assign({}, appState.preferences, data.preferences);
      }
      if (data.lastTouchedTopicId) {
        appState.lastTouchedTopicId = data.lastTouchedTopicId;
      }
      if (data.lastTouchedExamId) {
        appState.lastTouchedExamId = data.lastTouchedExamId;
      }
      if (data.activeExamId && EXAMS.some(function(e) { return e.id === data.activeExamId; })) {
        appState.activeExamId = data.activeExamId;
      }

      _setSyncStatus('synced');
      return true;
    })
    .catch(function(err) {
      console.error('Firestore read failed:', err);
      _setSyncStatus('offline');
      return false;
    });
}

/**
 * Debounced Firestore sync. Call after every state-changing action
 * when the user is signed in. The actual write fires 1.5s after the
 * last call, avoiding write-storming on rapid clicking.
 */
const debouncedSync = debounce(function() {
  if (appState.currentUser) {
    saveToFirestore();
  }
}, SYNC_DEBOUNCE_MS);

// ── High-Level Save / Load ──────────────────────────────────────────────────

/**
 * Save user state. Call after every state-changing action.
 * - Always writes to localStorage immediately.
 * - If signed in, also triggers a debounced Firestore write.
 */
function saveUserState() {
  saveToLocal();
  if (appState.currentUser) {
    debouncedSync();
  }
}

/**
 * Load user state on app startup.
 * 1. Check for old-format data and migrate if needed.
 * 2. Load from localStorage (instant, local-first).
 * 3. If signed in, load from Firestore (may overwrite local if cloud exists).
 * 4. If signed in with local data but no cloud doc, migrate local → cloud.
 *
 * Returns a Promise that resolves when loading is complete.
 */
function loadUserState() {
  // Step 1: old-format migration
  migrateOldFormat();

  // Step 2: load local (synchronous, instant)
  const hadLocalData = loadFromLocal();

  // Step 3: if signed in, check Firestore
  if (appState.currentUser) {
    return loadFromFirestore().then(function(hadCloudData) {
      if (!hadCloudData && hadLocalData) {
        // Step 4: migrate local → cloud (one-time)
        console.log('Migrating local data to Firestore (first sign-in sync).');
        return saveToFirestore().then(function() {
          return true;
        });
      }
      // If cloud data was loaded, also update local to stay in sync
      if (hadCloudData) {
        saveToLocal();
      }
      return true;
    });
  }

  return Promise.resolve(hadLocalData);
}

// ── Sync Status ─────────────────────────────────────────────────────────────

/**
 * Update the sync status in appState.
 * nav.js listens for this to update the UI indicator.
 */
function _setSyncStatus(status) {
  appState.syncStatus = status;
  // Dispatch a custom event so the UI can react
  if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('syncStatusChange', { detail: { status: status } }));
  }
}

/**
 * Check if we're online or offline and update status accordingly.
 */
function initConnectivityListeners() {
  if (typeof window === 'undefined') return;

  window.addEventListener('online', function() {
    if (appState.syncStatus === 'offline' && appState.currentUser) {
      // Attempt to re-sync
      debouncedSync();
    }
  });

  window.addEventListener('offline', function() {
    _setSyncStatus('offline');
  });

  // Initial check
  if (!navigator.onLine) {
    _setSyncStatus('offline');
  }
}

// ── Data Export / Import Helpers ─────────────────────────────────────────────
// Full export/import UI is in export.js (Phase 7), but the core data
// serialization lives here so storage.js owns all persistence.

/**
 * Export the current userState + preferences as a JSON string.
 */
function exportData() {
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    activeExamId: appState.activeExamId,
    userState: appState.userState,
    preferences: appState.preferences,
    lastTouchedTopicId: appState.lastTouchedTopicId,
    lastTouchedExamId: appState.lastTouchedExamId
  }, null, 2);
}

/**
 * Validate and import a JSON string into userState.
 * Returns { success: boolean, error?: string }.
 *
 * Security: validates shape before merging — rejects anything that
 * doesn't match the expected schema. Never eval/Function() the input.
 */
function importData(jsonString) {
  try {
    const data = JSON.parse(jsonString);

    if (!data || typeof data !== 'object') {
      return { success: false, error: 'Invalid format: not a JSON object.' };
    }

    // Must have userState with topics
    if (!data.userState || typeof data.userState !== 'object') {
      return { success: false, error: 'Missing or invalid userState.' };
    }

    if (!data.userState.topics || typeof data.userState.topics !== 'object') {
      return { success: false, error: 'Missing or invalid userState.topics.' };
    }

    // Validate each topic entry shape
    for (const [id, entry] of Object.entries(data.userState.topics)) {
      if (typeof id !== 'string' || typeof entry !== 'object') {
        return { success: false, error: 'Invalid topic entry for id: ' + id };
      }
      // Only allow known fields
      const allowed = new Set(['completed', 'revision', 'bookmarked', 'notes', 'last_touched_at', 'completed_at']);
      for (const key of Object.keys(entry)) {
        if (!allowed.has(key)) {
          return { success: false, error: 'Unknown field "' + key + '" in topic ' + id };
        }
      }
    }

    // Activity must be an object of date → count if present
    if (data.userState.activity) {
      if (typeof data.userState.activity !== 'object') {
        return { success: false, error: 'Invalid activity data.' };
      }
    }

    // All checks pass — merge into appState
    appState.userState = {
      topics: data.userState.topics,
      activity: data.userState.activity || {}
    };

    if (data.preferences && typeof data.preferences === 'object') {
      appState.preferences = Object.assign({}, appState.preferences, data.preferences);
    }

    if (data.activeExamId && EXAMS.some(function(e) { return e.id === data.activeExamId; })) {
      appState.activeExamId = data.activeExamId;
    }

    if (data.lastTouchedTopicId) {
      appState.lastTouchedTopicId = data.lastTouchedTopicId;
    }
    if (data.lastTouchedExamId) {
      appState.lastTouchedExamId = data.lastTouchedExamId;
    }

    // Persist
    saveUserState();

    return { success: true };
  } catch (e) {
    return { success: false, error: 'JSON parse error: ' + e.message };
  }
}
