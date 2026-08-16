/**
 * js/export.js — Export/Import JSON with shape validation
 *
 * Export: downloads the full userState + preferences as a timestamped JSON file.
 * Import: validates the shape of imported JSON before merging into state.
 * Never eval()/Function() imported content.
 *
 * Security: imported JSON is validated against expected schema. Unexpected
 * fields are silently dropped (not merged). String fields are length-capped.
 */

// ── Export ───────────────────────────────────────────────────────────────────

/**
 * Export all user data as a downloadable JSON file.
 */
function exportUserData() {
  var data = {
    _format: 'finshd_export_v1',
    _exported_at: new Date().toISOString(),
    activeExamId: appState.activeExamId,
    userState: {
      topics: appState.userState.topics,
      activity: appState.userState.activity
    },
    preferences: appState.preferences
  };

  var json = JSON.stringify(data, null, 2);
  var blob = new Blob([json], { type: 'application/json' });
  var url = URL.createObjectURL(blob);

  var a = document.createElement('a');
  a.href = url;
  a.download = 'finshd-backup-' + getTodayString() + '.json';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  // Cleanup
  setTimeout(function() {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);

  showToast('Data exported successfully', { type: 'success' });
}

// ── Import ──────────────────────────────────────────────────────────────────

/**
 * Trigger the file picker for importing JSON data.
 */
function importUserData() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.style.display = 'none';

  input.addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (!file) return;

    // Size guard: reject files > 5MB (Firestore doc limit is 1MB, this is very generous)
    if (file.size > 5 * 1024 * 1024) {
      showToast('File too large (max 5MB)', { type: 'danger' });
      return;
    }

    var reader = new FileReader();
    reader.onload = function(event) {
      try {
        var raw = JSON.parse(event.target.result);
        _validateAndMerge(raw);
      } catch (err) {
        console.error('[export] Import parse error:', err);
        showToast('Invalid JSON file', { type: 'danger' });
      }
    };
    reader.readAsText(file);
  });

  document.body.appendChild(input);
  input.click();
  document.body.removeChild(input);
}

// ── Validation & Merge ──────────────────────────────────────────────────────

/**
 * Validate imported JSON shape before merging.
 * Only merges recognized fields with correct types.
 * Rejects anything that doesn't match the expected schema.
 */
function _validateAndMerge(raw) {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    showToast('Invalid data format', { type: 'danger' });
    return;
  }

  // Save current state for undo
  var previousTopics = JSON.parse(JSON.stringify(appState.userState.topics));
  var previousActivity = JSON.parse(JSON.stringify(appState.userState.activity));
  var previousPrefs = JSON.parse(JSON.stringify(appState.preferences));

  var mergedTopics = 0;
  var mergedActivity = 0;

  // Merge topics
  if (raw.userState && typeof raw.userState.topics === 'object' && !Array.isArray(raw.userState.topics)) {
    var topics = raw.userState.topics;
    for (var topicId in topics) {
      if (!topics.hasOwnProperty(topicId)) continue;
      var t = topics[topicId];

      // Validate topic shape
      if (typeof t !== 'object' || t === null || Array.isArray(t)) continue;

      var validated = {
        completed: typeof t.completed === 'boolean' ? t.completed : false,
        revision: typeof t.revision === 'boolean' ? t.revision : false,
        bookmarked: typeof t.bookmarked === 'boolean' ? t.bookmarked : false,
        notes: typeof t.notes === 'string' ? t.notes.slice(0, 10000) : '', // Cap notes at 10K chars
        last_touched_at: _isISODate(t.last_touched_at) ? t.last_touched_at : null,
        completed_at: _isISODate(t.completed_at) ? t.completed_at : null
      };

      // Validate topicId format (should be a reasonable string)
      if (typeof topicId !== 'string' || topicId.length > 200 || topicId.length === 0) continue;

      appState.userState.topics[topicId] = validated;
      mergedTopics++;
    }
  }

  // Merge activity data
  if (raw.userState && typeof raw.userState.activity === 'object' && !Array.isArray(raw.userState.activity)) {
    var activity = raw.userState.activity;
    for (var dateKey in activity) {
      if (!activity.hasOwnProperty(dateKey)) continue;
      // Validate date key format (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue;
      var count = activity[dateKey];
      if (typeof count !== 'number' || count < 0 || count > 1000) continue;
      // Take the higher value (don't overwrite higher counts)
      var existing = appState.userState.activity[dateKey] || 0;
      appState.userState.activity[dateKey] = Math.max(existing, Math.floor(count));
      mergedActivity++;
    }
  }

  // Merge preferences (selective — only recognized keys)
  if (raw.preferences && typeof raw.preferences === 'object') {
    var prefs = raw.preferences;
    if (typeof prefs.theme === 'string' && (prefs.theme === 'dark' || prefs.theme === 'light')) {
      appState.preferences.theme = prefs.theme;
    }
    if (typeof prefs.dailyTargetEnabled === 'boolean') {
      appState.preferences.dailyTargetEnabled = prefs.dailyTargetEnabled;
    }
    if (typeof prefs.dailyTargetCount === 'number' && prefs.dailyTargetCount > 0 && prefs.dailyTargetCount <= 100) {
      appState.preferences.dailyTargetCount = prefs.dailyTargetCount;
    }
    if (typeof prefs.examDates === 'object' && !Array.isArray(prefs.examDates)) {
      for (var examId in prefs.examDates) {
        if (!prefs.examDates.hasOwnProperty(examId)) continue;
        var dateVal = prefs.examDates[examId];
        if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
          appState.preferences.examDates[examId] = dateVal;
        }
      }
    }
  }

  // Merge active exam
  if (raw.activeExamId && typeof raw.activeExamId === 'string') {
    var validExam = EXAMS.find(function(e) { return e.id === raw.activeExamId; });
    if (validExam) {
      appState.activeExamId = raw.activeExamId;
    }
  }

  // Save
  saveUserState();

  // Re-render
  if (typeof buildSearchIndex === 'function') buildSearchIndex();
  renderExamTabs();
  if (typeof renderHome === 'function') renderHome();
  if (typeof renderStudy === 'function') renderStudy();
  if (typeof renderProgress === 'function') renderProgress();

  showToast('Imported ' + mergedTopics + ' topics, ' + mergedActivity + ' activity days', {
    type: 'success',
    undoFn: function() {
      appState.userState.topics = previousTopics;
      appState.userState.activity = previousActivity;
      appState.preferences = previousPrefs;
      saveUserState();
      if (typeof renderHome === 'function') renderHome();
      if (typeof renderStudy === 'function') renderStudy();
      if (typeof renderProgress === 'function') renderProgress();
    }
  });
}

/**
 * Validate ISO date string format.
 */
function _isISODate(val) {
  if (typeof val !== 'string') return false;
  // Accept ISO 8601 format
  return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/.test(val);
}

// ── Settings Panel ──────────────────────────────────────────────────────────

/**
 * Open the settings modal (Export/Import + exam dates + daily target).
 */
function openSettings() {
  // Create overlay
  var overlay = $('settings-overlay');
  if (!overlay) {
    overlay = createElement('div', {
      className: 'modal-overlay',
      id: 'settings-overlay'
    });
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeSettings();
    });
    document.body.appendChild(overlay);
  }
  overlay.hidden = false;

  clearElement(overlay);

  var modal = createElement('div', {
    className: 'modal settings-modal',
    attrs: { role: 'dialog', 'aria-label': 'Settings' }
  });

  // Header
  var header = createElement('div', { className: 'modal__header' });
  var title = createElement('h2', {
    className: 'title-card',
    textContent: 'Settings'
  });
  header.appendChild(title);
  var closeBtn = createElement('button', {
    className: 'modal__close',
    textContent: '×',
    attrs: { type: 'button', 'aria-label': 'Close' }
  });
  closeBtn.addEventListener('click', closeSettings);
  header.appendChild(closeBtn);
  modal.appendChild(header);

  // Body
  var body = createElement('div', { className: 'modal__body settings-body' });

  // Section: Data
  body.appendChild(_renderSettingsSection('Data', [
    _renderSettingsRow('Export data', 'Download a JSON backup of all your progress', function() {
      var btn = createElement('button', {
        className: 'btn btn--ghost btn--small',
        textContent: 'Export JSON',
        attrs: { type: 'button' }
      });
      btn.addEventListener('click', exportUserData);
      return btn;
    }),
    _renderSettingsRow('Import data', 'Restore from a previously exported JSON file', function() {
      var btn = createElement('button', {
        className: 'btn btn--ghost btn--small',
        textContent: 'Import JSON',
        attrs: { type: 'button' }
      });
      btn.addEventListener('click', function() {
        closeSettings();
        importUserData();
      });
      return btn;
    })
  ]));

  // Section: Exam Dates
  body.appendChild(_renderSettingsSection('Exam Dates', EXAMS.map(function(exam) {
    return _renderSettingsRow(exam.shortName, 'Set your exam date for pace tracking', function() {
      var input = createElement('input', {
        className: 'settings-date-input',
        attrs: {
          type: 'date',
          value: (appState.preferences.examDates && appState.preferences.examDates[exam.id]) || ''
        }
      });
      input.addEventListener('change', function() {
        if (!appState.preferences.examDates) appState.preferences.examDates = {};
        appState.preferences.examDates[exam.id] = input.value;
        saveUserState();
        showToast('Exam date saved', { type: 'success' });
      });
      return input;
    });
  })));

  // Section: Daily Target
  body.appendChild(_renderSettingsSection('Daily Target', [
    _renderSettingsRow('Enable daily target', 'Show a focus card on the Home screen', function() {
      var toggle = createElement('button', {
        className: 'btn btn--small ' + (appState.preferences.dailyTargetEnabled ? 'btn--primary' : 'btn--ghost'),
        textContent: appState.preferences.dailyTargetEnabled ? 'On' : 'Off',
        attrs: { type: 'button' }
      });
      toggle.addEventListener('click', function() {
        appState.preferences.dailyTargetEnabled = !appState.preferences.dailyTargetEnabled;
        saveUserState();
        openSettings(); // Re-render
      });
      return toggle;
    }),
    _renderSettingsRow('Topics per day', 'Your daily study target', function() {
      var input = createElement('input', {
        className: 'settings-number-input',
        attrs: {
          type: 'number',
          min: '1',
          max: '50',
          value: String(appState.preferences.dailyTargetCount || 5)
        }
      });
      input.addEventListener('change', function() {
        var val = parseInt(input.value, 10);
        if (val > 0 && val <= 50) {
          appState.preferences.dailyTargetCount = val;
          saveUserState();
        }
      });
      return input;
    })
  ]));

  // Section: Print
  body.appendChild(_renderSettingsSection('Print', [
    _renderSettingsRow('Revision sheet', 'Print all flagged topics for offline review', function() {
      var btn = createElement('button', {
        className: 'btn btn--ghost btn--small',
        textContent: 'Print',
        attrs: { type: 'button' }
      });
      btn.addEventListener('click', function() {
        closeSettings();
        _printRevisionSheet();
      });
      return btn;
    })
  ]));

  modal.appendChild(body);
  overlay.appendChild(modal);
}

function closeSettings() {
  var overlay = $('settings-overlay');
  if (overlay) overlay.hidden = true;
}

// Settings UI helpers
function _renderSettingsSection(title, rows) {
  var section = createElement('div', { className: 'settings-section' });
  var heading = createElement('div', {
    className: 'settings-section__title',
    textContent: title
  });
  section.appendChild(heading);
  rows.forEach(function(row) {
    section.appendChild(row);
  });
  return section;
}

function _renderSettingsRow(label, description, controlFn) {
  var row = createElement('div', { className: 'settings-row' });
  var info = createElement('div', { className: 'settings-row__info' });
  var labelEl = createElement('div', {
    className: 'settings-row__label',
    textContent: label
  });
  info.appendChild(labelEl);
  if (description) {
    var desc = createElement('div', {
      className: 'settings-row__desc',
      textContent: description
    });
    info.appendChild(desc);
  }
  row.appendChild(info);
  if (controlFn) row.appendChild(controlFn());
  return row;
}

// ── Print Revision Sheet ────────────────────────────────────────────────────

function _printRevisionSheet() {
  var revisionTopics = [];
  EXAMS.forEach(function(exam) {
    var syllabus = getSyllabus(exam.id);
    if (!syllabus) return;
    syllabus.subjects.forEach(function(subject) {
      var leafIds = collectLeafTopicIds(subject);
      leafIds.forEach(function(topicId) {
        var state = getTopicState(topicId);
        if (!state.revision) return;
        var topicInfo = null;
        // Walk to find title
        function walk(topics) {
          for (var i = 0; i < topics.length; i++) {
            if (topics[i].id === topicId) { topicInfo = topics[i]; return; }
            if (topics[i].children) walk(topics[i].children);
          }
        }
        walk(subject.topics || []);
        revisionTopics.push({
          examName: exam.shortName,
          subjectName: subject.title_en,
          title: topicInfo ? topicInfo.title_en : topicId,
          stalenessDays: staleness(state.last_touched_at)
        });
      });
    });
  });

  // Sort by staleness
  revisionTopics.sort(function(a, b) {
    var sa = a.stalenessDays === null ? 9999 : a.stalenessDays;
    var sb = b.stalenessDays === null ? 9999 : b.stalenessDays;
    return sb - sa;
  });

  // Build printable HTML
  var printHtml = '<!DOCTYPE html><html><head><title>Revision Sheet — finshd</title>' +
    '<style>body{font-family:system-ui,sans-serif;padding:24px;max-width:800px;margin:0 auto;color:#111}' +
    'h1{font-size:18px;margin-bottom:16px}table{width:100%;border-collapse:collapse;font-size:13px}' +
    'th,td{padding:6px 10px;border:1px solid #ddd;text-align:left}th{background:#f5f5f5;font-weight:600}' +
    '.stale{color:#c0392b}.muted{color:#888}@media print{body{padding:0}}</style></head><body>' +
    '<h1>Revision Sheet — ' + escapeHTML(getTodayString()) + '</h1>';

  if (revisionTopics.length === 0) {
    printHtml += '<p>No topics flagged for revision.</p>';
  } else {
    printHtml += '<table><thead><tr><th>Topic</th><th>Subject</th><th>Exam</th><th>Staleness</th></tr></thead><tbody>';
    revisionTopics.forEach(function(t) {
      var stalenessClass = (t.stalenessDays === null || t.stalenessDays > 14) ? 'stale' : 'muted';
      printHtml += '<tr><td>' + escapeHTML(t.title) + '</td><td>' + escapeHTML(t.subjectName) +
        '</td><td>' + escapeHTML(t.examName) + '</td><td class="' + stalenessClass + '">' +
        escapeHTML(formatStaleness(t.stalenessDays)) + '</td></tr>';
    });
    printHtml += '</tbody></table>';
  }

  printHtml += '<p style="margin-top:16px;font-size:11px;color:#888">Generated by finshd</p></body></html>';

  var printWin = window.open('', '_blank');
  if (printWin) {
    printWin.document.write(printHtml);
    printWin.document.close();
    printWin.focus();
    setTimeout(function() { printWin.print(); }, 300);
  }
}
