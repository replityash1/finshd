/**
 * js/search.js — Search index & command palette
 *
 * Builds a flat search index on exam load/switch.
 * Command palette (Ctrl+K, /) provides:
 * - Jump to topic by typing
 * - Jump to subject
 * - Quick commands: toggle theme, switch exam
 *
 * Security: all rendering uses textContent. Search highlights use
 * escapeHTML + span wrapping.
 */

// ── Search Index ────────────────────────────────────────────────────────────

/**
 * Build the flattened search index for the active exam.
 * Called on exam switch and initial load.
 *
 * Each entry: { id, title, subjectId, subjectTitle, type: 'topic'|'subject' }
 */
function buildSearchIndex() {
  var syllabus = getActiveSyllabus();
  if (!syllabus) {
    appState.searchIndex[appState.activeExamId] = [];
    return;
  }

  var entries = [];

  syllabus.subjects.forEach(function(subject) {
    // Add the subject itself as searchable
    entries.push({
      id: subject.id,
      title: subject.title_en,
      subjectId: subject.id,
      subjectTitle: subject.title_en,
      type: 'subject'
    });

    // Walk all topics recursively
    function walkTopics(topics) {
      topics.forEach(function(topic) {
        entries.push({
          id: topic.id,
          title: topic.title_en,
          subjectId: subject.id,
          subjectTitle: subject.title_en,
          type: 'topic'
        });
        if (topic.children && topic.children.length > 0) {
          walkTopics(topic.children);
        }
      });
    }
    walkTopics(subject.topics || []);
  });

  appState.searchIndex[appState.activeExamId] = entries;
}

/**
 * Search the index. Returns top matches (max 30).
 * Simple substring match, case-insensitive.
 */
function searchTopics(query) {
  var index = appState.searchIndex[appState.activeExamId] || [];
  if (!query || query.trim().length === 0) return [];

  var q = query.toLowerCase().trim();
  var results = [];

  for (var i = 0; i < index.length && results.length < 30; i++) {
    var entry = index[i];
    if (entry.title.toLowerCase().indexOf(q) >= 0) {
      results.push(entry);
    }
  }

  return results;
}

// ── Command Palette ─────────────────────────────────────────────────────────

var _paletteState = {
  isOpen: false,
  selectedIndex: 0,
  results: [],
  query: ''
};

function openCommandPalette() {
  var overlay = $('cmd-palette-overlay');
  if (!overlay) return;

  // Ensure search index is built
  if (!appState.searchIndex[appState.activeExamId]) {
    buildSearchIndex();
  }

  overlay.hidden = false;
  _paletteState.isOpen = true;
  _paletteState.selectedIndex = 0;
  _paletteState.results = [];
  _paletteState.query = '';

  _renderPalette();

  // Focus the input after render
  setTimeout(function() {
    var input = $('cmd-palette-input');
    if (input) input.focus();
  }, 50);
}

function closeCommandPalette() {
  var overlay = $('cmd-palette-overlay');
  if (overlay) overlay.hidden = true;
  _paletteState.isOpen = false;
}

function _renderPalette() {
  var palette = $('cmd-palette');
  if (!palette) return;

  clearElement(palette);

  // Input
  var inputWrap = createElement('div', { className: 'cmd-palette__input-wrap' });
  var searchIcon = createElement('span', { className: 'cmd-palette__search-icon' });
  searchIcon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  inputWrap.appendChild(searchIcon);

  var input = createElement('input', {
    className: 'cmd-palette__input',
    id: 'cmd-palette-input',
    attrs: {
      type: 'text',
      placeholder: 'Search topics, subjects, or commands…',
      autocomplete: 'off',
      spellcheck: 'false'
    }
  });

  input.addEventListener('input', function() {
    _paletteState.query = input.value;
    _paletteState.selectedIndex = 0;
    _updatePaletteResults();
  });

  input.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      _paletteState.selectedIndex = Math.min(_paletteState.selectedIndex + 1, _paletteState.results.length - 1);
      _highlightPaletteItem();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      _paletteState.selectedIndex = Math.max(_paletteState.selectedIndex - 1, 0);
      _highlightPaletteItem();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      _selectPaletteItem(_paletteState.selectedIndex);
    } else if (e.key === 'Escape') {
      closeCommandPalette();
    }
  });

  inputWrap.appendChild(input);

  var shortcut = createElement('span', {
    className: 'cmd-palette__shortcut',
    textContent: 'Esc'
  });
  inputWrap.appendChild(shortcut);

  palette.appendChild(inputWrap);

  // Results container
  var resultsEl = createElement('div', {
    className: 'cmd-palette__results',
    id: 'cmd-palette-results'
  });
  palette.appendChild(resultsEl);

  // Show default items (commands) when no query
  _updatePaletteResults();
}

function _updatePaletteResults() {
  var resultsEl = $('cmd-palette-results');
  if (!resultsEl) return;

  clearElement(resultsEl);

  var query = _paletteState.query;

  if (!query || query.trim().length === 0) {
    // Show quick commands
    _paletteState.results = _getQuickCommands();
  } else {
    // Search topics + append matching commands
    var topicResults = searchTopics(query).map(function(r) {
      return {
        id: r.id,
        title: r.title,
        subtitle: r.type === 'subject' ? 'Subject' : r.subjectTitle,
        type: r.type,
        subjectId: r.subjectId,
        icon: r.type === 'subject' ? '📚' : '📄'
      };
    });

    var cmdResults = _getQuickCommands().filter(function(c) {
      return c.title.toLowerCase().indexOf(query.toLowerCase()) >= 0;
    });

    _paletteState.results = topicResults.concat(cmdResults);
  }

  // Render results
  _paletteState.results.forEach(function(item, idx) {
    var row = createElement('button', {
      className: 'cmd-palette__item' + (idx === _paletteState.selectedIndex ? ' cmd-palette__item--selected' : ''),
      attrs: { type: 'button', 'data-index': String(idx) }
    });

    var iconEl = createElement('span', { className: 'cmd-palette__item-icon', textContent: item.icon || '⚡' });
    row.appendChild(iconEl);

    var textWrap = createElement('div', { className: 'cmd-palette__item-text' });

    var titleEl = createElement('span', { className: 'cmd-palette__item-title' });
    if (query && item.type !== 'command') {
      titleEl.innerHTML = _highlightMatch(item.title, query);
    } else {
      titleEl.textContent = item.title;
    }
    textWrap.appendChild(titleEl);

    if (item.subtitle) {
      var subEl = createElement('span', {
        className: 'cmd-palette__item-sub',
        textContent: item.subtitle
      });
      textWrap.appendChild(subEl);
    }

    row.appendChild(textWrap);

    row.addEventListener('click', function() {
      _selectPaletteItem(idx);
    });

    resultsEl.appendChild(row);
  });
}

function _highlightPaletteItem() {
  var items = document.querySelectorAll('.cmd-palette__item');
  items.forEach(function(el, idx) {
    if (idx === _paletteState.selectedIndex) {
      el.classList.add('cmd-palette__item--selected');
      el.scrollIntoView({ block: 'nearest' });
    } else {
      el.classList.remove('cmd-palette__item--selected');
    }
  });
}

function _selectPaletteItem(index) {
  var item = _paletteState.results[index];
  if (!item) return;

  closeCommandPalette();

  if (item.type === 'command' && item.action) {
    item.action();
    return;
  }

  // Navigate to the topic/subject in the study view
  switchView('study');

  if (item.type === 'subject') {
    // Expand this subject
    expandSubject(item.id);
    // Scroll to it
    setTimeout(function() {
      var el = $('subject-' + item.id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  } else if (item.type === 'topic') {
    // Expand the parent subject, then scroll to the topic
    expandSubject(item.subjectId);
    setTimeout(function() {
      var el = $('topic-' + item.id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('topic-row--focused');
        setTimeout(function() { el.classList.remove('topic-row--focused'); }, 2000);
      }
    }, 150);
  }
}

/**
 * Highlight search matches in text. Uses escapeHTML for safety.
 */
function _highlightMatch(text, query) {
  var escaped = escapeHTML(text);
  var q = escapeHTML(query);
  var regex = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
  return escaped.replace(regex, '<span class="search-highlight">$1</span>');
}

/**
 * Quick commands available in the palette.
 */
function _getQuickCommands() {
  var commands = [];

  commands.push({
    title: 'Toggle theme (dark / light)',
    subtitle: 'Appearance',
    type: 'command',
    icon: '🌓',
    action: toggleTheme
  });

  // Exam switching commands
  EXAMS.forEach(function(exam) {
    if (exam.id !== appState.activeExamId) {
      commands.push({
        title: 'Switch to ' + exam.shortName,
        subtitle: exam.name,
        type: 'command',
        icon: '📋',
        action: function() {
          setActiveExam(exam.id);
          buildSearchIndex();
          renderExamTabs();
          if (typeof renderStudy === 'function') renderStudy();
          if (typeof renderHome === 'function') renderHome();
          saveUserState();
        }
      });
    }
  });

  // View switching commands
  var views = [
    { name: 'Home', view: 'home', icon: '🏠' },
    { name: 'Study', view: 'study', icon: '📖' },
    { name: 'Progress', view: 'progress', icon: '📊' }
  ];
  views.forEach(function(v) {
    if (v.view !== appState.activeView) {
      commands.push({
        title: 'Go to ' + v.name,
        subtitle: 'Navigation',
        type: 'command',
        icon: v.icon,
        action: function() { switchView(v.view); }
      });
    }
  });

  return commands;
}

// ── Close on overlay click ──────────────────────────────────────────────────

document.addEventListener('click', function(e) {
  if (!_paletteState.isOpen) return;
  var overlay = $('cmd-palette-overlay');
  var palette = $('cmd-palette');
  if (overlay && e.target === overlay) {
    closeCommandPalette();
  }
});
