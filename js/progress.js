/**
 * js/progress.js — Progress view: 5 sections per PRD §6
 *
 * 1. Pace — completion % vs. days-to-exam, projected finish date
 * 2. Streak + activity heatmap (merged into one section)
 * 3. Per-exam breakdown — horizontal bars across active exams
 * 4. Weak spots — subjects with most stale/never-touched topics
 * 5. Notes & bookmarks library — browsing view for saved content
 *
 * No two sections restate the same number in a different chart type.
 */

// ── State for Progress view ─────────────────────────────────────────────────

var _progressState = {
  libraryTab: 'bookmarks' // 'bookmarks' | 'notes'
};

// ── Main Render ─────────────────────────────────────────────────────────────

function renderProgress() {
  var container = $('view-progress');
  if (!container) return;

  clearElement(container);

  var content = createElement('div', { className: 'progress-content' });

  // Section 1: Pace
  content.appendChild(_renderPaceSection());

  // Section 2: Streak + Heatmap
  content.appendChild(_renderStreakSection());

  // Section 3: Per-exam breakdown
  content.appendChild(_renderBreakdownSection());

  // Section 4: Weak spots
  var weakSpots = _renderWeakSpotsSection();
  if (weakSpots) content.appendChild(weakSpots);

  // Section 5: Notes & bookmarks library
  content.appendChild(_renderLibrarySection());

  container.appendChild(content);
}

// ── 1. Pace ─────────────────────────────────────────────────────────────────

function _renderPaceSection() {
  var section = createElement('div', { className: 'progress-section' });

  var title = createElement('div', { className: 'progress-section__title' });
  title.textContent = '📈 Pace';
  section.appendChild(title);

  var syllabus = getActiveSyllabus();
  if (!syllabus) {
    section.appendChild(createElement('p', {
      className: 'pace-message',
      textContent: 'No syllabus loaded.'
    }));
    return section;
  }

  // Compute stats
  var total = 0, completed = 0;
  syllabus.subjects.forEach(function(s) {
    var st = computeCompletionStats(s);
    total += st.total;
    completed += st.completed;
  });
  var pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  var remaining = total - completed;

  // Compute pace message
  var msg = createElement('div', { className: 'pace-message' });
  var examDateStr = appState.preferences.examDates
    ? appState.preferences.examDates[appState.activeExamId]
    : null;

  if (examDateStr && remaining > 0) {
    var daysLeft = daysUntil(examDateStr);
    if (daysLeft !== null && daysLeft > 0) {
      var topicsPerDay = (remaining / daysLeft).toFixed(1);
      msg.innerHTML = '<strong>' + escapeHTML(String(completed)) + '</strong> of <strong>' +
        escapeHTML(String(total)) + '</strong> topics done. ' +
        'At <strong>' + escapeHTML(topicsPerDay) + '</strong> topics/day, you\'ll finish in time.';

      // Projected finish date based on current rate
      var activity = appState.userState.activity || {};
      var recentRate = _getRecentDailyRate(activity, 14);
      if (recentRate > 0) {
        var projectedDays = Math.ceil(remaining / recentRate);
        var projectedDate = new Date();
        projectedDate.setDate(projectedDate.getDate() + projectedDays);
        msg.innerHTML += ' At your recent pace (' + escapeHTML(recentRate.toFixed(1)) +
          '/day), you\'ll finish by <strong>' + escapeHTML(formatDate(projectedDate.toISOString())) + '</strong>.';
      }
    } else if (daysLeft !== null && daysLeft <= 0) {
      msg.innerHTML = '<strong>' + escapeHTML(String(completed)) + '</strong> of <strong>' +
        escapeHTML(String(total)) + '</strong> topics done. Exam date has passed.';
    }
  } else {
    msg.innerHTML = '<strong>' + escapeHTML(String(completed)) + '</strong> of <strong>' +
      escapeHTML(String(total)) + '</strong> topics completed (' +
      escapeHTML(String(pct)) + '%).';
    if (remaining > 0) {
      msg.innerHTML += ' <strong>' + escapeHTML(String(remaining)) + '</strong> remaining.';
    }
  }
  section.appendChild(msg);

  // Progress bar
  var exam = getExamConfig(appState.activeExamId);
  var barColor = exam ? 'var(' + exam.accentVar + ')' : 'var(--success)';

  var bar = createElement('div', { className: 'pace-bar' });
  var fill = createElement('div', { className: 'pace-bar__fill' });
  fill.style.width = pct + '%';
  fill.style.backgroundColor = barColor;
  bar.appendChild(fill);
  section.appendChild(bar);

  var stats = createElement('div', { className: 'pace-stats' });
  var leftLabel = createElement('span', { textContent: completed + ' done' });
  var rightLabel = createElement('span', { textContent: remaining + ' left' });
  stats.appendChild(leftLabel);
  stats.appendChild(rightLabel);
  section.appendChild(stats);

  return section;
}

/**
 * Get the average daily rate over the last N days from activity data.
 */
function _getRecentDailyRate(activity, days) {
  var total = 0;
  var counted = 0;
  var today = new Date();
  for (var i = 0; i < days; i++) {
    var d = new Date(today);
    d.setDate(d.getDate() - i);
    var key = d.toISOString().slice(0, 10);
    if (activity[key]) {
      total += activity[key];
      counted++;
    }
  }
  // Use counted days (not total window) to avoid penalizing days off
  // but cap at minimum 3 days for stability
  var divisor = Math.max(counted, 3);
  return counted > 0 ? total / divisor : 0;
}

// ── 2. Streak + Activity Heatmap ────────────────────────────────────────────

function _renderStreakSection() {
  var section = createElement('div', { className: 'progress-section' });

  var title = createElement('div', { className: 'progress-section__title' });
  title.textContent = '🔥 Streak & Activity';
  section.appendChild(title);

  // Streak number
  var streak = computeStreak(appState.userState.activity);
  var header = createElement('div', { className: 'streak-header' });
  var num = createElement('span', {
    className: 'streak-number',
    textContent: String(streak)
  });
  header.appendChild(num);
  var label = createElement('span', {
    className: 'streak-label',
    textContent: streak === 1 ? 'day streak' : 'day streak'
  });
  header.appendChild(label);
  section.appendChild(header);

  // Heatmap — last 12 weeks (84 days)
  var heatmap = createElement('div', { className: 'heatmap' });
  var activity = appState.userState.activity || {};
  var today = new Date();

  // Find the Monday of the week 12 weeks ago
  var startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 83);
  // Align to Monday
  var dayOfWeek = startDate.getDay();
  var alignOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  startDate.setDate(startDate.getDate() + alignOffset);

  // Compute max for scaling
  var maxCount = 1;
  for (var key in activity) {
    if (activity[key] > maxCount) maxCount = activity[key];
  }

  // Build weeks (columns)
  var d = new Date(startDate);
  while (d <= today) {
    var week = createElement('div', { className: 'heatmap-week' });
    for (var dow = 0; dow < 7; dow++) {
      var dateKey = d.toISOString().slice(0, 10);
      var count = activity[dateKey] || 0;
      var cell = createElement('div', { className: 'heatmap-cell' });

      if (d > today) {
        // Future dates — empty
      } else if (count > 0) {
        var ratio = count / maxCount;
        if (ratio >= 0.75) cell.classList.add('heatmap-cell--l4');
        else if (ratio >= 0.5) cell.classList.add('heatmap-cell--l3');
        else if (ratio >= 0.25) cell.classList.add('heatmap-cell--l2');
        else cell.classList.add('heatmap-cell--l1');
      }

      cell.setAttribute('title', dateKey + ': ' + count + ' topics');
      week.appendChild(cell);
      d.setDate(d.getDate() + 1);
    }
    heatmap.appendChild(week);
  }

  section.appendChild(heatmap);

  // Legend
  var legend = createElement('div', { className: 'heatmap-legend' });
  var lessLabel = createElement('span', { textContent: 'Less' });
  legend.appendChild(lessLabel);

  var cells = createElement('div', { className: 'heatmap-legend__cells' });
  ['', 'heatmap-cell--l1', 'heatmap-cell--l2', 'heatmap-cell--l3', 'heatmap-cell--l4'].forEach(function(cls) {
    var c = createElement('div', { className: 'heatmap-cell ' + cls });
    cells.appendChild(c);
  });
  legend.appendChild(cells);

  var moreLabel = createElement('span', { textContent: 'More' });
  legend.appendChild(moreLabel);
  section.appendChild(legend);

  return section;
}

// ── 3. Per-Exam Breakdown ───────────────────────────────────────────────────

function _renderBreakdownSection() {
  var section = createElement('div', { className: 'progress-section' });

  var title = createElement('div', { className: 'progress-section__title' });
  title.textContent = '📊 Per-Exam Breakdown';
  section.appendChild(title);

  var list = createElement('div', { className: 'breakdown-list' });

  EXAMS.forEach(function(exam) {
    var syllabus = getSyllabus(exam.id);
    if (!syllabus) return;

    var total = 0, completed = 0;
    syllabus.subjects.forEach(function(s) {
      var st = computeCompletionStats(s);
      total += st.total;
      completed += st.completed;
    });
    var pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    var item = createElement('div', { className: 'breakdown-item' });

    // Header: name + percentage
    var header = createElement('div', { className: 'breakdown-item__header' });
    var name = createElement('div', { className: 'breakdown-item__name' });
    var dot = createElement('span', { className: 'breakdown-item__dot' });
    dot.style.backgroundColor = 'var(' + exam.accentVar + ')';
    name.appendChild(dot);
    var nameText = createElement('span', { textContent: exam.shortName });
    name.appendChild(nameText);
    header.appendChild(name);

    var pctLabel = createElement('span', {
      className: 'breakdown-item__pct',
      textContent: completed + '/' + total + ' (' + pct + '%)'
    });
    header.appendChild(pctLabel);
    item.appendChild(header);

    // Bar
    var bar = createElement('div', { className: 'breakdown-bar' });
    var fill = createElement('div', { className: 'breakdown-bar__fill' });
    fill.style.width = pct + '%';
    fill.style.backgroundColor = 'var(' + exam.accentVar + ')';
    bar.appendChild(fill);
    item.appendChild(bar);

    list.appendChild(item);
  });

  section.appendChild(list);
  return section;
}

// ── 4. Weak Spots ───────────────────────────────────────────────────────────

function _renderWeakSpotsSection() {
  var syllabus = getActiveSyllabus();
  if (!syllabus) return null;

  // Rank subjects by staleness score (most stale first)
  var subjects = syllabus.subjects.map(function(subject) {
    var leafIds = collectLeafTopicIds(subject);
    var totalLeaves = leafIds.length;
    var neverTouched = 0;
    var totalStaleness = 0;
    var touchedCount = 0;

    leafIds.forEach(function(id) {
      var state = getTopicState(id);
      if (!state.completed && !state.last_touched_at) {
        neverTouched++;
      }
      if (state.last_touched_at) {
        totalStaleness += staleness(state.last_touched_at);
        touchedCount++;
      }
    });

    var stats = computeCompletionStats(subject);
    var avgStaleness = touchedCount > 0 ? Math.round(totalStaleness / touchedCount) : null;
    // Score: higher = weaker. Weight never-touched heavily.
    var score = neverTouched * 10 + (avgStaleness || 0);

    return {
      id: subject.id,
      title: subject.title_en,
      neverTouched: neverTouched,
      avgStaleness: avgStaleness,
      pct: stats.percentage,
      total: stats.total,
      completed: stats.completed,
      score: score
    };
  });

  // Sort by score descending, take top 5
  subjects.sort(function(a, b) { return b.score - a.score; });
  var top = subjects.filter(function(s) { return s.pct < 100; }).slice(0, 5);

  if (top.length === 0) return null;

  var section = createElement('div', { className: 'progress-section' });

  var title = createElement('div', { className: 'progress-section__title' });
  title.textContent = '⚠️ Weak Spots';
  section.appendChild(title);

  var list = createElement('div', { className: 'weak-spots-list' });

  top.forEach(function(item, idx) {
    var row = createElement('div', { className: 'weak-spot' });

    var rank = createElement('div', {
      className: 'weak-spot__rank',
      textContent: String(idx + 1)
    });
    row.appendChild(rank);

    var info = createElement('div', { className: 'weak-spot__info' });
    var titleEl = createElement('div', {
      className: 'weak-spot__title',
      textContent: item.title
    });
    info.appendChild(titleEl);

    var meta = createElement('div', { className: 'weak-spot__meta' });
    var parts = [];
    if (item.neverTouched > 0) parts.push(item.neverTouched + ' never touched');
    if (item.avgStaleness !== null) parts.push('avg ' + item.avgStaleness + ' days stale');
    meta.textContent = parts.join(' · ') || item.completed + '/' + item.total + ' done';
    info.appendChild(meta);
    row.appendChild(info);

    var pctEl = createElement('span', {
      className: 'weak-spot__pct',
      textContent: item.pct + '%'
    });
    row.appendChild(pctEl);

    // Click to go to this subject in Study view
    row.style.cursor = 'pointer';
    row.addEventListener('click', function() {
      switchView('study');
      expandSubject(item.id);
      setTimeout(function() {
        var el = $('subject-' + item.id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    });

    list.appendChild(row);
  });

  section.appendChild(list);
  return section;
}

// ── 5. Notes & Bookmarks Library ────────────────────────────────────────────

function _renderLibrarySection() {
  var section = createElement('div', { className: 'progress-section' });

  var title = createElement('div', { className: 'progress-section__title' });
  title.textContent = '📚 Notes & Bookmarks';
  section.appendChild(title);

  // Tabs
  var tabs = createElement('div', { className: 'library-tabs' });
  var bookmarksTab = createElement('button', {
    className: 'library-tab' + (_progressState.libraryTab === 'bookmarks' ? ' library-tab--active' : ''),
    textContent: 'Bookmarks',
    attrs: { type: 'button' }
  });
  bookmarksTab.addEventListener('click', function() {
    _progressState.libraryTab = 'bookmarks';
    renderProgress();
  });
  tabs.appendChild(bookmarksTab);

  var notesTab = createElement('button', {
    className: 'library-tab' + (_progressState.libraryTab === 'notes' ? ' library-tab--active' : ''),
    textContent: 'Notes',
    attrs: { type: 'button' }
  });
  notesTab.addEventListener('click', function() {
    _progressState.libraryTab = 'notes';
    renderProgress();
  });
  tabs.appendChild(notesTab);

  section.appendChild(tabs);

  // Content
  var list = createElement('div', { className: 'library-list' });

  if (_progressState.libraryTab === 'bookmarks') {
    _renderBookmarksList(list);
  } else {
    _renderNotesList(list);
  }

  section.appendChild(list);
  return section;
}

function _renderBookmarksList(container) {
  var items = _collectBookmarkedTopics();

  if (items.length === 0) {
    container.appendChild(createElement('div', {
      className: 'library-empty',
      textContent: 'No bookmarked topics yet. Bookmark topics in the Study view to see them here.'
    }));
    return;
  }

  items.forEach(function(item) {
    var row = createElement('div', { className: 'library-item' });

    var icon = createElement('span', { className: 'library-item__icon', textContent: '🔖' });
    row.appendChild(icon);

    var info = createElement('div', { className: 'library-item__info' });
    var titleEl = createElement('div', {
      className: 'library-item__title',
      textContent: item.title
    });
    info.appendChild(titleEl);

    var meta = createElement('div', {
      className: 'library-item__meta',
      textContent: item.examShortName + ' · ' + item.subjectTitle
    });
    info.appendChild(meta);
    row.appendChild(info);

    row.addEventListener('click', function() {
      _navigateToTopic(item);
    });

    container.appendChild(row);
  });
}

function _renderNotesList(container) {
  var items = _collectNotesTopics();

  if (items.length === 0) {
    container.appendChild(createElement('div', {
      className: 'library-empty',
      textContent: 'No notes yet. Add notes to topics in the Study view to see them here.'
    }));
    return;
  }

  items.forEach(function(item) {
    var row = createElement('div', { className: 'library-item' });

    var icon = createElement('span', { className: 'library-item__icon', textContent: '📝' });
    row.appendChild(icon);

    var info = createElement('div', { className: 'library-item__info' });
    var titleEl = createElement('div', {
      className: 'library-item__title',
      textContent: item.title
    });
    info.appendChild(titleEl);

    // Preview of notes (first 80 chars)
    var preview = createElement('div', {
      className: 'library-item__preview',
      textContent: item.notes.slice(0, 80) + (item.notes.length > 80 ? '…' : '')
    });
    info.appendChild(preview);

    var meta = createElement('div', {
      className: 'library-item__meta',
      textContent: item.examShortName + ' · ' + item.subjectTitle
    });
    info.appendChild(meta);
    row.appendChild(info);

    row.addEventListener('click', function() {
      _navigateToTopic(item);
    });

    container.appendChild(row);
  });
}

// ── Library Helpers ─────────────────────────────────────────────────────────

function _collectBookmarkedTopics() {
  var results = [];
  EXAMS.forEach(function(exam) {
    var syllabus = getSyllabus(exam.id);
    if (!syllabus) return;
    syllabus.subjects.forEach(function(subject) {
      var leafIds = collectLeafTopicIds(subject);
      leafIds.forEach(function(topicId) {
        var state = getTopicState(topicId);
        if (!state.bookmarked) return;
        var topicInfo = _findTopicInSyllabus(topicId, syllabus, subject);
        results.push({
          topicId: topicId,
          title: topicInfo ? topicInfo.title : topicId,
          examId: exam.id,
          examShortName: exam.shortName,
          subjectId: subject.id,
          subjectTitle: subject.title_en
        });
      });
    });
  });
  return results;
}

function _collectNotesTopics() {
  var results = [];
  EXAMS.forEach(function(exam) {
    var syllabus = getSyllabus(exam.id);
    if (!syllabus) return;
    syllabus.subjects.forEach(function(subject) {
      var leafIds = collectLeafTopicIds(subject);
      leafIds.forEach(function(topicId) {
        var state = getTopicState(topicId);
        if (!state.notes) return;
        var topicInfo = _findTopicInSyllabus(topicId, syllabus, subject);
        results.push({
          topicId: topicId,
          title: topicInfo ? topicInfo.title : topicId,
          notes: state.notes,
          examId: exam.id,
          examShortName: exam.shortName,
          subjectId: subject.id,
          subjectTitle: subject.title_en
        });
      });
    });
  });
  return results;
}

function _findTopicInSyllabus(topicId, syllabus, subject) {
  function walk(topics) {
    for (var i = 0; i < topics.length; i++) {
      if (topics[i].id === topicId) return { title: topics[i].title_en };
      if (topics[i].children) {
        var found = walk(topics[i].children);
        if (found) return found;
      }
    }
    return null;
  }
  return walk(subject.topics || []);
}

function _navigateToTopic(item) {
  if (item.examId !== appState.activeExamId) {
    setActiveExam(item.examId);
    if (typeof buildSearchIndex === 'function') buildSearchIndex();
    renderExamTabs();
  }
  switchView('study');
  expandSubject(item.subjectId);
  setTimeout(function() {
    var el = $('topic-' + item.topicId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('topic-row--focused');
      setTimeout(function() { el.classList.remove('topic-row--focused'); }, 2000);
    }
  }, 150);
}
