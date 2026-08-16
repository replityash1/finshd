/**
 * js/home.js — Home view: greeting, continue card, revision strip, stats
 *
 * PRD §4: This view answers "what do I study right now?"
 * - Greeting strip: time-aware, factual, not fake-cheerful
 * - Continue card: last topic touched, one-tap mark complete + open
 * - Due-for-revision: staleness-sorted, capped at 6, "see all" into Study
 * - Today's focus: optional, off by default, dismissible
 * - Quiet stats row: overall %, streak, days-to-exam. Max 3 numbers.
 * - Empty state for new accounts.
 */

// ── Main Render ─────────────────────────────────────────────────────────────

function renderHome() {
  var container = $('view-home');
  if (!container) return;

  clearElement(container);

  var content = createElement('div', { className: 'home-content' });

  // Check if user has any progress at all
  var topicCount = Object.keys(appState.userState.topics).length;

  if (topicCount === 0 && !appState.lastTouchedTopicId) {
    // Empty state for brand new accounts
    content.appendChild(_renderEmptyState());
  } else {
    // Greeting strip
    content.appendChild(_renderGreeting());

    // Continue card (if there's a last-touched topic)
    var continueCard = _renderContinueCard();
    if (continueCard) content.appendChild(continueCard);

    // Due-for-revision strip
    var revisionStrip = _renderRevisionStrip();
    if (revisionStrip) content.appendChild(revisionStrip);

    // Today's focus card (if enabled in preferences)
    if (appState.preferences.dailyTargetEnabled) {
      content.appendChild(_renderFocusCard());
    }

    // Quiet stats row
    content.appendChild(_renderStatsRow());
  }

  container.appendChild(content);
}

// ── Greeting Strip ──────────────────────────────────────────────────────────

function _renderGreeting() {
  var greeting = createElement('div', { className: 'greeting' });

  var timeText = createElement('div', {
    className: 'greeting__time',
    textContent: getTimeGreeting()
  });
  greeting.appendChild(timeText);

  // Subtitle: factual, day-aware
  var exam = getExamConfig(appState.activeExamId);
  var syllabus = getActiveSyllabus();
  var subText = getDayName();

  if (syllabus) {
    var stats = _getOverallStats();
    var remaining = stats.total - stats.completed;
    if (remaining > 0) {
      subText += ' · ' + remaining + ' topics remaining';
    } else {
      subText += ' · All topics completed!';
    }
  }

  var sub = createElement('div', {
    className: 'greeting__sub',
    textContent: subText
  });
  greeting.appendChild(sub);

  return greeting;
}

// ── Continue Card ───────────────────────────────────────────────────────────

function _renderContinueCard() {
  var topicId = appState.lastTouchedTopicId;
  var examId = appState.lastTouchedExamId || appState.activeExamId;
  if (!topicId) return null;

  // Find the topic in the syllabus
  var topicInfo = _findTopicById(topicId, examId);
  if (!topicInfo) return null;

  var state = getTopicState(topicId);
  var exam = getExamConfig(examId);

  var card = createElement('div', { className: 'continue-card' });

  // Label
  var label = createElement('div', {
    className: 'continue-card__label',
    textContent: 'Continue where you left off'
  });
  card.appendChild(label);

  // Topic title
  var title = createElement('div', {
    className: 'continue-card__topic',
    textContent: topicInfo.title
  });
  card.appendChild(title);

  // Meta: exam name + subject + staleness
  var meta = createElement('div', { className: 'continue-card__meta' });

  if (exam) {
    var dot = createElement('span', { className: 'continue-card__exam-dot' });
    dot.style.backgroundColor = 'var(' + exam.accentVar + ')';
    meta.appendChild(dot);

    var examLabel = createElement('span', { textContent: exam.shortName });
    meta.appendChild(examLabel);
  }

  if (topicInfo.subjectTitle) {
    var sep = createElement('span', { textContent: '·' });
    meta.appendChild(sep);
    var subjLabel = createElement('span', { textContent: topicInfo.subjectTitle });
    meta.appendChild(subjLabel);
  }

  if (state.last_touched_at) {
    var stalenessDays = staleness(state.last_touched_at);
    var sep2 = createElement('span', { textContent: '·' });
    meta.appendChild(sep2);
    var stalenessLabel = createElement('span', { textContent: formatStaleness(stalenessDays) });
    meta.appendChild(stalenessLabel);
  }

  card.appendChild(meta);

  // Actions
  var actions = createElement('div', { className: 'continue-card__actions' });

  // "Open in Study" button
  var openBtn = createElement('button', {
    className: 'btn btn--ghost btn--small',
    textContent: 'Open',
    attrs: { type: 'button' }
  });
  openBtn.addEventListener('click', function() {
    // Switch to the right exam if needed
    if (examId !== appState.activeExamId) {
      setActiveExam(examId);
      if (typeof buildSearchIndex === 'function') buildSearchIndex();
      renderExamTabs();
    }
    switchView('study');
    // Expand the subject and scroll to the topic
    if (topicInfo.subjectId) {
      expandSubject(topicInfo.subjectId);
      setTimeout(function() {
        var el = $('topic-' + topicId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('topic-row--focused');
          setTimeout(function() { el.classList.remove('topic-row--focused'); }, 2000);
        }
      }, 150);
    }
  });
  actions.appendChild(openBtn);

  // "Mark complete" button (only if not already completed)
  if (!state.completed) {
    var markBtn = createElement('button', {
      className: 'btn btn--primary btn--small',
      textContent: 'Mark complete',
      attrs: { type: 'button' }
    });
    markBtn.addEventListener('click', function() {
      var prev = setTopicCompleted(topicId, true);
      saveUserState();
      showToast('Marked complete', {
        type: 'success',
        undoFn: function() {
          restoreTopicState(topicId, prev);
          saveUserState();
          renderHome();
        }
      });
      renderHome();
    });
    actions.appendChild(markBtn);
  } else {
    var doneLabel = createElement('span', {
      className: 'text-secondary',
      textContent: '✓ Completed'
    });
    doneLabel.style.fontSize = 'var(--size-caption)';
    doneLabel.style.padding = 'var(--sp-2)';
    actions.appendChild(doneLabel);
  }

  card.appendChild(actions);

  return card;
}

// ── Due-for-Revision Strip ──────────────────────────────────────────────────

function _renderRevisionStrip() {
  var revisionTopics = _getRevisionTopics();
  if (revisionTopics.length === 0) return null;

  var section = createElement('div');

  // Header
  var header = createElement('div', { className: 'home-section__header' });
  var title = createElement('div', {
    className: 'home-section__title',
    textContent: 'Due for revision'
  });
  header.appendChild(title);

  if (revisionTopics.length > 6) {
    var seeAll = createElement('button', {
      className: 'home-section__link',
      textContent: 'See all ' + revisionTopics.length,
      attrs: { type: 'button' }
    });
    seeAll.addEventListener('click', function() {
      // Switch to study view — user can use the search to filter
      switchView('study');
    });
    header.appendChild(seeAll);
  }

  section.appendChild(header);

  // Strip (capped at 6)
  var strip = createElement('div', { className: 'revision-strip' });
  var capped = revisionTopics.slice(0, 6);

  capped.forEach(function(item) {
    var row = _renderRevisionItem(item);
    strip.appendChild(row);
  });

  section.appendChild(strip);
  return section;
}

function _renderRevisionItem(item) {
  var row = createElement('div', { className: 'revision-item' });

  // Urgency dot
  var urgencyClass = 'revision-item__status';
  if (item.stalenessDays === null || item.stalenessDays > 14) {
    urgencyClass += ' revision-item__status--urgent';
  } else if (item.stalenessDays > 7) {
    urgencyClass += ' revision-item__status--stale';
  } else {
    urgencyClass += ' revision-item__status--recent';
  }
  var dot = createElement('span', { className: urgencyClass });
  row.appendChild(dot);

  // Info
  var info = createElement('div', { className: 'revision-item__info' });
  var titleEl = createElement('div', {
    className: 'revision-item__title',
    textContent: item.title
  });
  info.appendChild(titleEl);

  var meta = createElement('div', {
    className: 'revision-item__meta',
    textContent: formatStaleness(item.stalenessDays)
  });
  if (item.examShortName) {
    meta.textContent += ' · ' + item.examShortName;
  }
  info.appendChild(meta);
  row.appendChild(info);

  // Quick complete action
  var actionBtn = createElement('button', {
    className: 'revision-item__action',
    attrs: { type: 'button', 'aria-label': 'Mark revision done', title: 'Clear revision flag' }
  });
  actionBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  actionBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    var prev = setTopicRevision(item.topicId, false);
    saveUserState();
    showToast('Revision cleared', {
      type: 'info',
      undoFn: function() {
        restoreTopicState(item.topicId, prev);
        saveUserState();
        renderHome();
      }
    });
    renderHome();
  });
  row.appendChild(actionBtn);

  // Click row to navigate to topic
  row.addEventListener('click', function() {
    if (item.examId !== appState.activeExamId) {
      setActiveExam(item.examId);
      if (typeof buildSearchIndex === 'function') buildSearchIndex();
      renderExamTabs();
    }
    switchView('study');
    if (item.subjectId) {
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
  });

  return row;
}

/**
 * Get all revision-flagged topics across all exams, sorted by staleness (most stale first).
 */
function _getRevisionTopics() {
  var results = [];

  EXAMS.forEach(function(exam) {
    var syllabus = getSyllabus(exam.id);
    if (!syllabus) return;

    syllabus.subjects.forEach(function(subject) {
      var leafIds = collectLeafTopicIds(subject);
      leafIds.forEach(function(topicId) {
        var state = getTopicState(topicId);
        if (!state.revision) return;

        var topicInfo = _findTopicById(topicId, exam.id);
        var stalenessDays = staleness(state.last_touched_at);

        results.push({
          topicId: topicId,
          title: topicInfo ? topicInfo.title : topicId,
          examId: exam.id,
          examShortName: exam.shortName,
          subjectId: subject.id,
          stalenessDays: stalenessDays
        });
      });
    });
  });

  // Sort: most stale first (null = never touched = most urgent)
  results.sort(function(a, b) {
    var sa = a.stalenessDays === null ? 9999 : a.stalenessDays;
    var sb = b.stalenessDays === null ? 9999 : b.stalenessDays;
    return sb - sa;
  });

  return results;
}

// ── Today's Focus ───────────────────────────────────────────────────────────

function _renderFocusCard() {
  var section = createElement('div');

  var header = createElement('div', { className: 'home-section__header' });
  var title = createElement('div', {
    className: 'home-section__title',
    textContent: "Today's focus"
  });
  header.appendChild(title);
  section.appendChild(header);

  // Count topics completed today
  var today = getTodayString();
  var todayCount = appState.userState.activity[today] || 0;
  var target = appState.preferences.dailyTargetCount || 5;

  var card = createElement('div', { className: 'focus-card' });

  // Progress ring
  var pct = Math.min(100, Math.round((todayCount / target) * 100));
  var ring = _renderFocusRing(pct, todayCount, target);
  card.appendChild(ring);

  // Info
  var info = createElement('div', { className: 'focus-card__info' });
  var countEl = createElement('div', {
    className: 'focus-card__count',
    textContent: todayCount + ' / ' + target
  });
  info.appendChild(countEl);

  var label = createElement('div', {
    className: 'focus-card__label',
    textContent: pct >= 100 ? 'Target reached!' : 'topics today'
  });
  info.appendChild(label);

  card.appendChild(info);

  // Dismiss button
  var dismiss = createElement('button', {
    className: 'focus-card__dismiss',
    textContent: 'Turn off',
    attrs: { type: 'button' }
  });
  dismiss.addEventListener('click', function() {
    appState.preferences.dailyTargetEnabled = false;
    saveUserState();
    renderHome();
  });
  card.appendChild(dismiss);

  section.appendChild(card);
  return section;
}

function _renderFocusRing(percentage, current, target) {
  var size = 48;
  var strokeWidth = 4;
  var radius = (size - strokeWidth) / 2;
  var circumference = 2 * Math.PI * radius;
  var offset = circumference - (percentage / 100) * circumference;

  var color = percentage >= 100 ? 'var(--success)' : 'var(--accent-ras)';

  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'focus-card__ring');
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
  fill.setAttribute('stroke', color);
  fill.setAttribute('stroke-dasharray', circumference);
  fill.setAttribute('stroke-dashoffset', offset);
  fill.setAttribute('transform', 'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')');

  svg.appendChild(track);
  svg.appendChild(fill);
  return svg;
}

// ── Quiet Stats Row ─────────────────────────────────────────────────────────

function _renderStatsRow() {
  var section = createElement('div');

  var header = createElement('div', { className: 'home-section__header' });
  var title = createElement('div', {
    className: 'home-section__title',
    textContent: 'At a glance'
  });
  header.appendChild(title);
  section.appendChild(header);

  var row = createElement('div', { className: 'stats-row' });

  // Stat 1: Overall completion %
  var stats = _getOverallStats();
  row.appendChild(_renderStatCard(stats.percentage + '%', 'Completed'));

  // Stat 2: Current streak
  var streak = computeStreak(appState.userState.activity);
  row.appendChild(_renderStatCard(
    streak.toString(),
    streak === 1 ? 'day streak' : 'day streak'
  ));

  // Stat 3: Days to exam (if user set a date), else total topics done
  var examDate = appState.preferences.examDates
    ? appState.preferences.examDates[appState.activeExamId]
    : null;

  if (examDate) {
    var daysLeft = daysUntil(examDate);
    if (daysLeft !== null && daysLeft >= 0) {
      row.appendChild(_renderStatCard(daysLeft.toString(), 'days left'));
    } else if (daysLeft !== null && daysLeft < 0) {
      row.appendChild(_renderStatCard('Past', 'exam date'));
    } else {
      row.appendChild(_renderStatCard(stats.completed.toString(), 'topics done'));
    }
  } else {
    row.appendChild(_renderStatCard(stats.completed.toString(), 'topics done'));
  }

  section.appendChild(row);
  return section;
}

function _renderStatCard(value, label) {
  var card = createElement('div', { className: 'stat-card' });
  var valEl = createElement('div', {
    className: 'stat-card__value',
    textContent: value
  });
  card.appendChild(valEl);
  var labelEl = createElement('div', {
    className: 'stat-card__label',
    textContent: label
  });
  card.appendChild(labelEl);
  return card;
}

// ── Empty State ─────────────────────────────────────────────────────────────

function _renderEmptyState() {
  var empty = createElement('div', { className: 'home-empty' });

  var icon = createElement('div', {
    className: 'home-empty__icon',
    textContent: '📖'
  });
  empty.appendChild(icon);

  var title = createElement('div', {
    className: 'home-empty__title',
    textContent: 'Ready to start tracking'
  });
  empty.appendChild(title);

  var text = createElement('p', {
    className: 'home-empty__text',
    textContent: 'Head to the Study tab to browse the syllabus and start marking topics as you complete them. Your progress saves automatically.'
  });
  empty.appendChild(text);

  var btn = createElement('button', {
    className: 'btn btn--primary',
    textContent: 'Go to Study',
    attrs: { type: 'button' }
  });
  btn.addEventListener('click', function() {
    switchView('study');
  });
  empty.appendChild(btn);

  return empty;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Get overall stats for the active exam.
 */
function _getOverallStats() {
  var syllabus = getActiveSyllabus();
  if (!syllabus) return { total: 0, completed: 0, percentage: 0 };

  var total = 0;
  var completed = 0;

  syllabus.subjects.forEach(function(subject) {
    var s = computeCompletionStats(subject);
    total += s.total;
    completed += s.completed;
  });

  return {
    total: total,
    completed: completed,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0
  };
}

/**
 * Find a topic by ID in a specific exam's syllabus.
 * Returns { title, subjectId, subjectTitle } or null.
 */
function _findTopicById(topicId, examId) {
  var syllabus = getSyllabus(examId);
  if (!syllabus) return null;

  for (var i = 0; i < syllabus.subjects.length; i++) {
    var subject = syllabus.subjects[i];
    var found = _walkFindTopic(topicId, subject.topics || []);
    if (found) {
      return {
        title: found.title_en,
        subjectId: subject.id,
        subjectTitle: subject.title_en
      };
    }
  }
  return null;
}

function _walkFindTopic(topicId, topics) {
  for (var i = 0; i < topics.length; i++) {
    if (topics[i].id === topicId) return topics[i];
    if (topics[i].children) {
      var found = _walkFindTopic(topicId, topics[i].children);
      if (found) return found;
    }
  }
  return null;
}
