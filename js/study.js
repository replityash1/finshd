/**
 * js/study.js — Syllabus tree render, mark/flag/bookmark, overlap filter
 *
 * Subject cards render collapsed by default with compact progress rings.
 * Topic rows are only built and inserted into the DOM when a subject is
 * expanded (lazy render) to keep initial paint fast on large syllabi.
 *
 * Every state-changing action writes through state.js → storage.js and
 * shows an Undo toast.
 */

// ── State for the Study view ────────────────────────────────────────────────

var _studyState = {
  expandedSubjects: new Set(),   // subject IDs currently expanded
  overlapFilterActive: false,    // whether the overlap filter chip is on
  focusedTopicIndex: -1,         // for keyboard navigation (j/k)
  focusedTopicIds: [],           // flat list of visible topic IDs for keyboard nav
  bulkMenuTarget: null           // subject ID the bulk menu is open for
};

// ── Main Render ─────────────────────────────────────────────────────────────

/**
 * Render (or re-render) the entire Study view.
 */
function renderStudy() {
  var container = $('view-study');
  if (!container) return;

  var syllabus = getActiveSyllabus();
  if (!syllabus) {
    container.innerHTML = '';
    var emptyDiv = createElement('div', { className: 'study-empty' });
    var emptyIcon = createElement('div', { className: 'study-empty__icon', textContent: '📚' });
    var emptyText = createElement('p', { className: 'study-empty__text', textContent: 'No syllabus data loaded for this exam.' });
    emptyDiv.appendChild(emptyIcon);
    emptyDiv.appendChild(emptyText);
    container.appendChild(emptyDiv);
    return;
  }

  clearElement(container);

  // Header with exam name and filter chips
  var header = _renderStudyHeader(syllabus);
  container.appendChild(header);

  // Subject cards
  var exam = getExamConfig(appState.activeExamId);
  var accentClass = exam ? 'subject-card--accent-' + exam.accentVar.replace('--accent-', '') : '';

  syllabus.subjects.forEach(function(subject) {
    var card = _renderSubjectCard(subject, accentClass);
    container.appendChild(card);
  });
}

// ── Study Header ────────────────────────────────────────────────────────────

function _renderStudyHeader(syllabus) {
  var header = createElement('div', { className: 'study-header' });

  // Left: exam name
  var title = createElement('h1', {
    className: 'study-header__title',
    textContent: syllabus.exam
  });
  header.appendChild(title);

  // Right: filter chips
  var filters = createElement('div', { className: 'study-header__filters' });

  // Overlap filter chip — only show if this exam has overlapping topics
  var overlapCount = _countOverlappingTopics(syllabus);
  if (overlapCount > 0) {
    var overlapChip = createElement('button', {
      className: 'filter-chip' + (_studyState.overlapFilterActive ? ' filter-chip--active' : ''),
      id: 'filter-overlap',
      attrs: { type: 'button' }
    });
    overlapChip.textContent = 'Shared topics ';
    var chipCount = createElement('span', {
      className: 'filter-chip__count',
      textContent: '(' + overlapCount + ')'
    });
    overlapChip.appendChild(chipCount);
    overlapChip.addEventListener('click', function() {
      _studyState.overlapFilterActive = !_studyState.overlapFilterActive;
      renderStudy();
    });
    filters.appendChild(overlapChip);
  }

  header.appendChild(filters);
  return header;
}

// ── Subject Card ────────────────────────────────────────────────────────────

function _renderSubjectCard(subject, accentClass) {
  var isExpanded = _studyState.expandedSubjects.has(subject.id);
  var stats = computeCompletionStats(subject);

  var card = createElement('div', {
    className: 'subject-card ' + accentClass + (isExpanded ? ' subject-card--expanded' : ''),
    id: 'subject-' + subject.id
  });

  // Header (always visible)
  var headerBtn = createElement('div', {
    className: 'subject-header',
    attrs: { role: 'button', tabindex: '0', 'aria-expanded': isExpanded ? 'true' : 'false' }
  });

  // Chevron
  var chevron = createElement('span', { className: 'subject-header__chevron' });
  chevron.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
  headerBtn.appendChild(chevron);

  // Progress ring
  var ring = _renderProgressRing(stats.percentage);
  headerBtn.appendChild(ring);

  // Title and meta
  var info = createElement('div', { className: 'subject-header__info' });
  var titleEl = createElement('div', { className: 'subject-header__title' });
  titleEl.textContent = subject.title_en;
  info.appendChild(titleEl);

  var meta = createElement('div', { className: 'subject-header__meta' });
  meta.textContent = stats.completed + ' / ' + stats.total + ' topics';
  info.appendChild(meta);
  headerBtn.appendChild(info);

  // Percentage
  var pct = createElement('span', {
    className: 'subject-header__pct',
    textContent: stats.percentage + '%'
  });
  headerBtn.appendChild(pct);

  // Bulk action button (three dots)
  var actionsDiv = createElement('div', { className: 'subject-header__actions' });
  var bulkBtn = createElement('button', {
    className: 'subject-action-btn',
    attrs: { type: 'button', 'aria-label': 'Bulk actions for ' + subject.title_en, title: 'Bulk actions' }
  });
  bulkBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';
  bulkBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    _showBulkMenu(subject, bulkBtn);
  });
  actionsDiv.appendChild(bulkBtn);
  headerBtn.appendChild(actionsDiv);

  // Click to expand/collapse
  headerBtn.addEventListener('click', function() {
    _toggleSubject(subject.id);
  });
  headerBtn.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      _toggleSubject(subject.id);
    }
  });

  card.appendChild(headerBtn);

  // Topic list container (lazy rendered on expand)
  var topicsContainer = createElement('div', {
    className: 'subject-topics',
    id: 'topics-' + subject.id
  });

  if (isExpanded) {
    _renderTopicsInto(topicsContainer, subject.topics || [], subject, 1);
  }

  card.appendChild(topicsContainer);

  return card;
}

// ── Progress Ring ───────────────────────────────────────────────────────────

function _renderProgressRing(percentage) {
  var size = 32;
  var strokeWidth = 3;
  var radius = (size - strokeWidth) / 2;
  var circumference = 2 * Math.PI * radius;
  var offset = circumference - (percentage / 100) * circumference;

  var exam = getExamConfig(appState.activeExamId);
  var strokeColor = exam ? 'var(' + exam.accentVar + ')' : 'var(--success)';

  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'subject-header__ring');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);

  var track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  track.setAttribute('class', 'subject-ring__track');
  track.setAttribute('cx', size / 2);
  track.setAttribute('cy', size / 2);
  track.setAttribute('r', radius);

  var fill = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  fill.setAttribute('class', 'subject-ring__fill');
  fill.setAttribute('cx', size / 2);
  fill.setAttribute('cy', size / 2);
  fill.setAttribute('r', radius);
  fill.setAttribute('stroke', strokeColor);
  fill.setAttribute('stroke-dasharray', circumference);
  fill.setAttribute('stroke-dashoffset', offset);
  fill.setAttribute('transform', 'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')');

  svg.appendChild(track);
  svg.appendChild(fill);

  return svg;
}

// ── Topic Rows (lazy rendered) ──────────────────────────────────────────────

function _renderTopicsInto(container, topics, subject, depth) {
  topics.forEach(function(topic) {
    // Overlap filter: if active, only show topics that have overlaps
    if (_studyState.overlapFilterActive) {
      var overlaps = getOverlaps(topic.id);
      var hasOverlappingChildren = _hasOverlappingDescendant(topic);
      if (overlaps.length === 0 && !hasOverlappingChildren) return;
    }

    var hasChildren = topic.children && topic.children.length > 0;

    if (hasChildren) {
      // Parent topic — render as a section header, then its children
      var parentRow = _renderParentTopicRow(topic, depth);
      container.appendChild(parentRow);
      _renderTopicsInto(container, topic.children, subject, depth + 1);
    } else {
      // Leaf topic — render as interactive row
      var row = _renderTopicRow(topic, subject, depth);
      container.appendChild(row);
    }
  });
}

function _renderParentTopicRow(topic, depth) {
  var depthClass = depth <= 3 ? ' topic-row--depth-' + depth : ' topic-row--depth-3';
  var row = createElement('div', {
    className: 'topic-row topic-row--parent' + depthClass,
    id: 'topic-' + topic.id
  });

  // Empty status slot (parents aren't individually completable)
  var spacer = createElement('span');
  spacer.style.width = '22px';
  spacer.style.flexShrink = '0';
  row.appendChild(spacer);

  var titleEl = createElement('span', {
    className: 'topic-title',
    textContent: topic.title_en
  });
  row.appendChild(titleEl);

  return row;
}

function _renderTopicRow(topic, subject, depth) {
  var state = getTopicState(topic.id);
  var depthClass = depth <= 3 ? ' topic-row--depth-' + depth : ' topic-row--depth-3';

  var row = createElement('div', {
    className: 'topic-row' + depthClass,
    id: 'topic-' + topic.id,
    attrs: { 'data-topic-id': topic.id }
  });

  // Status icon (checkbox)
  var statusBtn = createElement('button', {
    className: 'topic-status' +
      (state.completed && state.revision ? ' topic-status--revision' :
       state.completed ? ' topic-status--done' : ''),
    attrs: {
      type: 'button',
      'aria-label': state.completed ? 'Mark incomplete' : 'Mark complete',
      title: state.completed ? 'Completed' + (state.revision ? ' (revision)' : '') : 'Not started'
    }
  });

  // Check/flag icon inside
  if (state.completed) {
    var checkIcon = createElement('span', { className: 'topic-status__icon' });
    if (state.revision) {
      checkIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v4l9 5 9-5V7"/></svg>';
    } else {
      checkIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    }
    statusBtn.appendChild(checkIcon);
  }

  statusBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    _toggleComplete(topic.id, subject.id);
  });
  row.appendChild(statusBtn);

  // Title
  var titleEl = createElement('span', {
    className: 'topic-title' + (state.completed ? ' topic-title--completed' : ''),
    textContent: topic.title_en
  });
  row.appendChild(titleEl);

  // Level badge (Paper II Science)
  if (topic.level) {
    var levelBadge = createElement('span', {
      className: 'level-badge',
      textContent: topic.level === 'sr_sec' ? '10+2' :
                   topic.level === 'graduation' ? 'GRAD' :
                   topic.level === 'teaching' ? 'TEACH' : topic.level
    });
    row.appendChild(levelBadge);
  }

  // Overlap badge
  var overlaps = getOverlaps(topic.id);
  if (overlaps.length > 0) {
    var overlapBadge = createElement('span', {
      className: 'overlap-badge',
      textContent: '↔ ' + overlaps.map(function(o) {
        var ex = getExamConfig(o.examId);
        return ex ? ex.shortName : o.examId;
      }).join(', ')
    });
    row.appendChild(overlapBadge);
  }

  // Action buttons (hover/touch reveal)
  var actions = createElement('div', { className: 'topic-actions' });

  // Revision toggle
  var revBtn = createElement('button', {
    className: 'topic-action-btn' + (state.revision ? ' topic-action-btn--revision-active' : ''),
    attrs: {
      type: 'button',
      'aria-label': state.revision ? 'Remove revision flag' : 'Flag for revision',
      title: state.revision ? 'Flagged for revision' : 'Flag for revision'
    }
  });
  revBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="' + (state.revision ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>';
  revBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    _toggleRevision(topic.id, subject.id);
  });
  actions.appendChild(revBtn);

  // Bookmark toggle
  var bmkBtn = createElement('button', {
    className: 'topic-action-btn' + (state.bookmarked ? ' topic-action-btn--bookmark-active' : ''),
    attrs: {
      type: 'button',
      'aria-label': state.bookmarked ? 'Remove bookmark' : 'Bookmark',
      title: state.bookmarked ? 'Bookmarked' : 'Bookmark'
    }
  });
  bmkBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="' + (state.bookmarked ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>';
  bmkBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    _toggleBookmark(topic.id, subject.id);
  });
  actions.appendChild(bmkBtn);

  // Notes button
  var notesBtn = createElement('button', {
    className: 'topic-action-btn' + (state.notes ? ' topic-action-btn--has-notes' : ''),
    attrs: {
      type: 'button',
      'aria-label': 'Notes',
      title: state.notes ? 'Has notes' : 'Add notes'
    }
  });
  notesBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
  notesBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    if (typeof openStudyHub === 'function') {
      openStudyHub(topic.id, topic.title_en);
    }
  });
  actions.appendChild(notesBtn);

  row.appendChild(actions);

  return row;
}

// ── Topic Actions ───────────────────────────────────────────────────────────

function _toggleComplete(topicId, subjectId) {
  var current = getTopicState(topicId);
  var newVal = !current.completed;
  var previous = setTopicCompleted(topicId, newVal);
  saveUserState();

  var msg = newVal ? 'Marked complete' : 'Marked incomplete';
  showToast(msg, {
    type: 'success',
    undoFn: function() {
      restoreTopicState(topicId, previous);
      saveUserState();
      _refreshSubjectCard(subjectId);
    }
  });

  _refreshSubjectCard(subjectId);
}

function _toggleRevision(topicId, subjectId) {
  var current = getTopicState(topicId);
  var newVal = !current.revision;
  var previous = setTopicRevision(topicId, newVal);
  saveUserState();

  var msg = newVal ? 'Flagged for revision' : 'Revision flag removed';
  showToast(msg, {
    type: 'info',
    undoFn: function() {
      restoreTopicState(topicId, previous);
      saveUserState();
      _refreshSubjectCard(subjectId);
    }
  });

  _refreshSubjectCard(subjectId);
}

function _toggleBookmark(topicId, subjectId) {
  var current = getTopicState(topicId);
  var newVal = !current.bookmarked;
  var previous = setTopicBookmarked(topicId, newVal);
  saveUserState();

  var msg = newVal ? 'Bookmarked' : 'Bookmark removed';
  showToast(msg, {
    type: 'info',
    undoFn: function() {
      restoreTopicState(topicId, previous);
      saveUserState();
      _refreshSubjectCard(subjectId);
    }
  });

  _refreshSubjectCard(subjectId);
}

// ── Subject Expand/Collapse ─────────────────────────────────────────────────

function _toggleSubject(subjectId) {
  if (_studyState.expandedSubjects.has(subjectId)) {
    _studyState.expandedSubjects.delete(subjectId);
  } else {
    _studyState.expandedSubjects.add(subjectId);
  }
  _refreshSubjectCard(subjectId);
}

/**
 * Expand a specific subject (used by search jump-to).
 */
function expandSubject(subjectId) {
  _studyState.expandedSubjects.add(subjectId);
  _refreshSubjectCard(subjectId);
}

/**
 * Re-render a single subject card in-place (avoids full re-render).
 */
function _refreshSubjectCard(subjectId) {
  var syllabus = getActiveSyllabus();
  if (!syllabus) return;

  var subject = syllabus.subjects.find(function(s) { return s.id === subjectId; });
  if (!subject) return;

  var oldCard = $('subject-' + subjectId);
  if (!oldCard) return;

  var exam = getExamConfig(appState.activeExamId);
  var accentClass = exam ? 'subject-card--accent-' + exam.accentVar.replace('--accent-', '') : '';

  var newCard = _renderSubjectCard(subject, accentClass);
  oldCard.replaceWith(newCard);
}

// ── Bulk Actions ────────────────────────────────────────────────────────────

function _showBulkMenu(subject, anchorEl) {
  // Remove any existing bulk menu
  _closeBulkMenu();

  var menu = createElement('div', {
    className: 'bulk-menu',
    id: 'bulk-menu'
  });

  // Mark all complete
  var markAllBtn = createElement('button', {
    className: 'bulk-menu__item',
    attrs: { type: 'button' },
    textContent: 'Mark all complete'
  });
  markAllBtn.addEventListener('click', function() {
    _bulkMarkAll(subject, true);
    _closeBulkMenu();
  });
  menu.appendChild(markAllBtn);

  // Mark all incomplete
  var clearAllBtn = createElement('button', {
    className: 'bulk-menu__item',
    attrs: { type: 'button' },
    textContent: 'Mark all incomplete'
  });
  clearAllBtn.addEventListener('click', function() {
    _bulkMarkAll(subject, false);
    _closeBulkMenu();
  });
  menu.appendChild(clearAllBtn);

  // Clear all revision flags
  var clearRevBtn = createElement('button', {
    className: 'bulk-menu__item',
    attrs: { type: 'button' },
    textContent: 'Clear all revision flags'
  });
  clearRevBtn.addEventListener('click', function() {
    _bulkClearRevision(subject);
    _closeBulkMenu();
  });
  menu.appendChild(clearRevBtn);

  // Position near the anchor
  var rect = anchorEl.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top = rect.bottom + 4 + 'px';
  menu.style.right = (window.innerWidth - rect.right) + 'px';

  document.body.appendChild(menu);
  _studyState.bulkMenuTarget = subject.id;

  // Close on outside click
  setTimeout(function() {
    document.addEventListener('click', _closeBulkMenuOnOutsideClick);
  }, 0);
}

function _closeBulkMenu() {
  var menu = $('bulk-menu');
  if (menu) menu.remove();
  _studyState.bulkMenuTarget = null;
  document.removeEventListener('click', _closeBulkMenuOnOutsideClick);
}

function _closeBulkMenuOnOutsideClick(e) {
  var menu = $('bulk-menu');
  if (menu && !menu.contains(e.target)) {
    _closeBulkMenu();
  }
}

function _bulkMarkAll(subject, completed) {
  var leafIds = collectLeafTopicIds(subject);
  var previousStates = {};

  leafIds.forEach(function(id) {
    previousStates[id] = { ...getTopicState(id) };
    setTopicCompleted(id, completed);
  });

  saveUserState();

  var msg = completed
    ? 'Marked ' + leafIds.length + ' topics complete'
    : 'Cleared ' + leafIds.length + ' topics';

  showToast(msg, {
    type: 'success',
    undoFn: function() {
      leafIds.forEach(function(id) {
        restoreTopicState(id, previousStates[id]);
      });
      saveUserState();
      _refreshSubjectCard(subject.id);
    }
  });

  _refreshSubjectCard(subject.id);
}

function _bulkClearRevision(subject) {
  var leafIds = collectLeafTopicIds(subject);
  var previousStates = {};
  var count = 0;

  leafIds.forEach(function(id) {
    var state = getTopicState(id);
    if (state.revision) {
      previousStates[id] = { ...state };
      setTopicRevision(id, false);
      count++;
    }
  });

  saveUserState();

  showToast('Cleared ' + count + ' revision flags', {
    type: 'info',
    undoFn: function() {
      Object.keys(previousStates).forEach(function(id) {
        restoreTopicState(id, previousStates[id]);
      });
      saveUserState();
      _refreshSubjectCard(subject.id);
    }
  });

  _refreshSubjectCard(subject.id);
}

// ── Overlap Helpers ─────────────────────────────────────────────────────────

function _countOverlappingTopics(syllabus) {
  var count = 0;
  function walk(node) {
    if (getOverlaps(node.id).length > 0) count++;
    var kids = node.children || node.topics || [];
    kids.forEach(walk);
  }
  syllabus.subjects.forEach(walk);
  return count;
}

function _hasOverlappingDescendant(node) {
  var kids = node.children || [];
  for (var i = 0; i < kids.length; i++) {
    if (getOverlaps(kids[i].id).length > 0) return true;
    if (_hasOverlappingDescendant(kids[i])) return true;
  }
  return false;
}

// ── Keyboard Navigation for Study View ──────────────────────────────────────

document.addEventListener('keydown', function(e) {
  if (appState.activeView !== 'study') return;
  var tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;

  // j/k to move through topic list
  if (e.key === 'j' || e.key === 'k') {
    e.preventDefault();
    _navigateTopics(e.key === 'j' ? 1 : -1);
    return;
  }

  // Space to toggle complete on focused topic
  if (e.key === ' ' && _studyState.focusedTopicIndex >= 0) {
    e.preventDefault();
    var focusedId = _studyState.focusedTopicIds[_studyState.focusedTopicIndex];
    if (focusedId) {
      // Find the subject this topic belongs to
      var syllabus = getActiveSyllabus();
      if (syllabus) {
        var subjectId = _findSubjectForTopic(focusedId, syllabus);
        if (subjectId) _toggleComplete(focusedId, subjectId);
      }
    }
    return;
  }
});

function _navigateTopics(direction) {
  // Build flat list of visible topic IDs
  var rows = document.querySelectorAll('#view-study .topic-row[data-topic-id]');
  _studyState.focusedTopicIds = Array.from(rows).map(function(r) { return r.dataset.topicId; });

  if (_studyState.focusedTopicIds.length === 0) return;

  // Remove old focus
  if (_studyState.focusedTopicIndex >= 0) {
    var oldRow = document.querySelector('.topic-row--focused');
    if (oldRow) oldRow.classList.remove('topic-row--focused');
  }

  // Move index
  _studyState.focusedTopicIndex += direction;
  if (_studyState.focusedTopicIndex < 0) _studyState.focusedTopicIndex = 0;
  if (_studyState.focusedTopicIndex >= _studyState.focusedTopicIds.length) {
    _studyState.focusedTopicIndex = _studyState.focusedTopicIds.length - 1;
  }

  // Apply focus
  var topicId = _studyState.focusedTopicIds[_studyState.focusedTopicIndex];
  var newRow = document.querySelector('[data-topic-id="' + topicId + '"]');
  if (newRow) {
    newRow.classList.add('topic-row--focused');
    newRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function _findSubjectForTopic(topicId, syllabus) {
  for (var i = 0; i < syllabus.subjects.length; i++) {
    var ids = collectLeafTopicIds(syllabus.subjects[i]);
    if (ids.indexOf(topicId) >= 0) return syllabus.subjects[i].id;
  }
  return null;
}
