/**
 * js/state.js — Single mutable app state object + accessors
 *
 * The single source of truth for all runtime state. Other modules read/write
 * through the accessors here, not through scattered globals or direct
 * localStorage/Firestore access.
 *
 * See ARCHITECTURE.md §3 for the canonical state shape.
 */

// ── App State ───────────────────────────────────────────────────────────────

const appState = {
  currentUser: null,            // Firebase User object or null (guest)
  activeExamId: 'ras_pre_2026', // default exam
  activeView: 'home',           // 'home' | 'study' | 'progress'
  syncStatus: 'idle',           // 'idle' | 'saving' | 'synced' | 'offline'

  // Static syllabus content, keyed by examId. Loaded from SYLLABUS_DATA on init.
  // Immutable after load — never write user state into this.
  rawSyllabus: {},

  // Per-user mutable progress, keyed by topic ID (flat, not nested).
  // See DATA_MODEL.md §2 for the shape.
  userState: {
    topics: {},
    // activity: date string → count, drives heatmap/streak
    activity: {}
  },

  // User preferences (persisted alongside userState)
  preferences: {
    theme: 'dark',
    language: 'en',
    dailyTargetEnabled: false,
    dailyTargetCount: 5,
    examDates: {}               // { examId: 'YYYY-MM-DD' } — user-settable only
  },

  // Runtime-only (not persisted)
  searchIndex: {},              // { examId: flattenedArray } — built on exam load
  lastTouchedTopicId: null,     // for the "Continue" card on Home
  lastTouchedExamId: null       // which exam the last action was in
};

// ── State Accessors ─────────────────────────────────────────────────────────
// Prefer these over direct appState mutation so we can add change-tracking later.

/**
 * Get the topic state for a given topic ID.
 * Returns the state object, or a default "not started" shape if none exists.
 * Does NOT create an entry — only getOrCreateTopicState does that.
 */
function getTopicState(topicId) {
  return appState.userState.topics[topicId] || {
    completed: false,
    revision: false,
    bookmarked: false,
    notes: '',
    last_touched_at: null,
    completed_at: null
  };
}

/**
 * Get or create the topic state entry. Use this before mutating —
 * it ensures the entry exists in userState.topics.
 */
function getOrCreateTopicState(topicId) {
  if (!appState.userState.topics[topicId]) {
    appState.userState.topics[topicId] = {
      completed: false,
      revision: false,
      bookmarked: false,
      notes: '',
      last_touched_at: null,
      completed_at: null
    };
  }
  return appState.userState.topics[topicId];
}

/**
 * Mark a topic as completed (or uncompleted).
 * Updates last_touched_at, completed_at, and activity count.
 * Returns the previous state for undo support.
 */
function setTopicCompleted(topicId, completed) {
  const state = getOrCreateTopicState(topicId);
  const previous = { ...state };
  const now = new Date().toISOString();

  state.completed = completed;
  state.last_touched_at = now;
  state.completed_at = completed ? now : null;

  // Track the last touched topic for the "Continue" card
  appState.lastTouchedTopicId = topicId;
  appState.lastTouchedExamId = appState.activeExamId;

  // Update activity count for today
  if (completed) {
    _incrementActivity();
  }

  return previous;
}

/**
 * Toggle revision flag on a topic.
 * Returns the previous state for undo support.
 */
function setTopicRevision(topicId, revision) {
  const state = getOrCreateTopicState(topicId);
  const previous = { ...state };
  const now = new Date().toISOString();

  state.revision = revision;
  state.last_touched_at = now;

  appState.lastTouchedTopicId = topicId;
  appState.lastTouchedExamId = appState.activeExamId;

  return previous;
}

/**
 * Toggle bookmark on a topic.
 * Returns the previous state for undo support.
 */
function setTopicBookmarked(topicId, bookmarked) {
  const state = getOrCreateTopicState(topicId);
  const previous = { ...state };

  state.bookmarked = bookmarked;
  // Bookmarking doesn't update last_touched_at — it's not a study action

  return previous;
}

/**
 * Set notes for a topic.
 * Returns the previous state for undo support.
 */
function setTopicNotes(topicId, notes) {
  const state = getOrCreateTopicState(topicId);
  const previous = { ...state };

  state.notes = notes;

  return previous;
}

/**
 * Restore a topic to a previous state (for undo).
 */
function restoreTopicState(topicId, previousState) {
  if (previousState) {
    appState.userState.topics[topicId] = { ...previousState };
  }
}

/**
 * Set the active exam. Returns the previous examId.
 */
function setActiveExam(examId) {
  const prev = appState.activeExamId;
  appState.activeExamId = examId;
  return prev;
}

/**
 * Set the active view. Returns the previous view.
 */
function setActiveView(view) {
  const prev = appState.activeView;
  appState.activeView = view;
  return prev;
}

/**
 * Get the syllabus content for the currently active exam.
 */
function getActiveSyllabus() {
  return appState.rawSyllabus[appState.activeExamId] || null;
}

/**
 * Get the syllabus content for a specific exam.
 */
function getSyllabus(examId) {
  return appState.rawSyllabus[examId] || null;
}

/**
 * Load all syllabus data from SYLLABUS_DATA global (generated bundle).
 */
function loadSyllabusData() {
  if (typeof SYLLABUS_DATA !== 'undefined') {
    appState.rawSyllabus = SYLLABUS_DATA;
  }
}

/**
 * Count leaf topics in a subject or topic node (recursive).
 * Works on the content tree, not userState.
 */
function countLeafTopics(node) {
  const kids = node.children || node.topics || [];
  if (kids.length === 0) return 1;
  let count = 0;
  for (const child of kids) {
    count += countLeafTopics(child);
  }
  return count;
}

/**
 * Collect all leaf topic IDs from a node (recursive).
 */
function collectLeafTopicIds(node, result) {
  result = result || [];
  const kids = node.children || node.topics || [];
  if (kids.length === 0) {
    if (node.id) result.push(node.id);
    return result;
  }
  for (const child of kids) {
    collectLeafTopicIds(child, result);
  }
  return result;
}

/**
 * Compute completion stats for a subject or entire exam.
 * Returns { total, completed, percentage }.
 */
function computeCompletionStats(node) {
  const leafIds = collectLeafTopicIds(node);
  const total = leafIds.length;
  let completed = 0;
  for (const id of leafIds) {
    if (appState.userState.topics[id] && appState.userState.topics[id].completed) {
      completed++;
    }
  }
  return {
    total,
    completed,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0
  };
}

// ── Private Helpers ─────────────────────────────────────────────────────────

/**
 * Increment today's activity count.
 */
function _incrementActivity() {
  const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
  if (!appState.userState.activity) {
    appState.userState.activity = {};
  }
  appState.userState.activity[today] = (appState.userState.activity[today] || 0) + 1;
}
