/**
 * scripts/test_phase1.js — Quick verification of Phase 1 data layer
 *
 * Run: node scripts/test_phase1.js
 */

const fs = require('fs');
const vm = require('vm');

// Build one big script string: stubs + source files + tests
const stubs = `
var Blob = function(arr) { this.size = arr[0].length; };
var CustomEvent = function() {};
var requestAnimationFrame = function(fn) { fn(); };
var navigator = { onLine: true };
var window = { addEventListener: function() {} };
var document = {
  dispatchEvent: function() {},
  getElementById: function() { return null; },
  createElement: function(tag) {
    return {
      className: '', textContent: '', id: '', parentNode: true,
      appendChild: function(){}, addEventListener: function(){},
      setAttribute: function(){}, remove: function(){},
      classList: { add: function(){} }
    };
  },
  querySelector: function() { return null; },
  body: { appendChild: function(){} }
};
var localStorage = {
  _store: {},
  getItem: function(k) { return this._store[k] || null; },
  setItem: function(k, v) { this._store[k] = v; },
  removeItem: function(k) { delete this._store[k]; }
};
var firebase = {
  initializeApp: function(){},
  auth: function(){ return {}; },
  firestore: function(){ return {}; }
};
firebase.firestore.FieldValue = { serverTimestamp: function() { return 'SERVER_TS'; } };
firebase.auth.GoogleAuthProvider = function(){};
var firebaseAuth = {};
var googleProvider = {};
var firebaseDb = {
  collection: function() {
    return {
      doc: function() {
        return {
          set: function() { return Promise.resolve(); },
          get: function() { return Promise.resolve({ exists: false }); }
        };
      }
    };
  }
};
`;

const sourceFiles = [
  'js/syllabus_data.js',
  'js/config.js',
  'js/state.js',
  'js/utils.js',
  'js/storage.js'
];

const tests = `
var passed = 0;
var failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log('  ✓ ' + label);
    passed++;
  } else {
    console.error('  ✗ FAIL: ' + label);
    failed++;
  }
}

console.log('\\n=== Phase 1 Verification ===\\n');

// Test 1: EXAMS configuration
console.log('Config:');
assert(EXAMS.length === 3, 'EXAMS has 3 entries');
assert(EXAMS[0].id === 'ras_pre_2026', 'First exam is RAS Pre');
assert(getExamConfig('rpsc_2nd_grade_paper1').shortName === '2G Paper I', 'getExamConfig works');
assert(getOverlaps('fairs_and_festivals').length > 0, 'Overlap map has entries');
assert(getOverlaps('nonexistent_topic').length === 0, 'Overlap returns empty for unknown');

// Test 2: Syllabus data loaded
console.log('\\nSyllabus Data:');
loadSyllabusData();
assert(Object.keys(appState.rawSyllabus).length === 3, 'All 3 exams loaded');
assert(appState.rawSyllabus.ras_pre_2026.subjects.length === 11, 'RAS Pre has 11 subjects');
assert(appState.rawSyllabus.rpsc_2nd_grade_paper1.subjects.length === 5, 'Paper I has 5 subjects');
assert(appState.rawSyllabus.rpsc_2nd_grade_paper2_science.subjects.length === 4, 'Paper II has 4 subjects');

// Test 3: State accessors
console.log('\\nState Accessors:');
var ts1 = getTopicState('prehistoric_sites_rajasthan');
assert(ts1.completed === false, 'Default topic state is not completed');
assert(ts1.notes === '', 'Default topic state has empty notes');

var prev = setTopicCompleted('prehistoric_sites_rajasthan', true);
assert(prev.completed === false, 'Previous state was not completed');
var ts2 = getTopicState('prehistoric_sites_rajasthan');
assert(ts2.completed === true, 'Topic is now completed');
assert(ts2.completed_at !== null, 'completed_at is set');
assert(appState.lastTouchedTopicId === 'prehistoric_sites_rajasthan', 'lastTouchedTopicId updated');

// Test undo
restoreTopicState('prehistoric_sites_rajasthan', prev);
assert(getTopicState('prehistoric_sites_rajasthan').completed === false, 'Undo restored previous state');

// Test revision
setTopicRevision('prehistoric_sites_rajasthan', true);
assert(getTopicState('prehistoric_sites_rajasthan').revision === true, 'Revision flag set');

// Test bookmark
setTopicBookmarked('prehistoric_sites_rajasthan', true);
assert(getTopicState('prehistoric_sites_rajasthan').bookmarked === true, 'Bookmark flag set');

// Test notes
setTopicNotes('prehistoric_sites_rajasthan', 'Test note');
assert(getTopicState('prehistoric_sites_rajasthan').notes === 'Test note', 'Notes set');

// Test 4: Completion stats
console.log('\\nCompletion Stats:');
var ras = getActiveSyllabus();
var firstSubject = ras.subjects[0];
var stats1 = computeCompletionStats(firstSubject);
assert(stats1.total === 31, 'RAS first subject has 31 leaf topics');
assert(stats1.completed === 0, 'No topics completed yet (undo restored)');

setTopicCompleted('prehistoric_sites_rajasthan', true);
setTopicCompleted('ancient_rajasthan_society_culture', true);
var stats2 = computeCompletionStats(firstSubject);
assert(stats2.completed === 2, '2 topics now completed');
assert(stats2.percentage === Math.round((2/31)*100), 'Percentage correct');

// Test 5: Utils
console.log('\\nUtils:');
assert(escapeHTML('<script>alert("XSS")</script>') === '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;', 'escapeHTML handles < > "');
assert(escapeHTML("it's") === "it&#39;s", 'escapeHTML handles single quotes');
assert(escapeHTML('&test') === '&amp;test', 'escapeHTML handles &');
assert(escapeHTML('') === '', 'escapeHTML handles empty string');
assert(escapeHTML(null) === '', 'escapeHTML handles null');
assert(daysBetween('2026-08-01', '2026-08-16') === 15, 'daysBetween works');
assert(computeStreak({}) === 0, 'Empty activity = 0 streak');
assert(formatStaleness(0) === 'Today', 'formatStaleness: today');
assert(formatStaleness(1) === '1 day ago', 'formatStaleness: 1 day');
assert(formatStaleness(null) === 'Never touched', 'formatStaleness: null');

// Test 6: Storage round-trip
console.log('\\nStorage:');
saveToLocal();
var savedState = JSON.parse(localStorage.getItem(STORAGE_KEY_USER_STATE));
assert(savedState.topics['prehistoric_sites_rajasthan'].completed === true, 'localStorage has completed topic');

appState.userState = { topics: {}, activity: {} };
var loaded = loadFromLocal();
assert(loaded === true, 'loadFromLocal returns true');
assert(appState.userState.topics['prehistoric_sites_rajasthan'].completed === true, 'State restored from localStorage');

// Test 7: Export/Import
console.log('\\nExport/Import:');
var exported = exportData();
var parsedExport = JSON.parse(exported);
assert(parsedExport.version === 1, 'Export has version 1');
assert(parsedExport.userState.topics['prehistoric_sites_rajasthan'].completed === true, 'Export has topic data');

appState.userState = { topics: {}, activity: {} };
var importResult = importData(exported);
assert(importResult.success === true, 'Import succeeded');
assert(appState.userState.topics['prehistoric_sites_rajasthan'].completed === true, 'Import restored data');

var badResult = importData('not json');
assert(badResult.success === false, 'Bad JSON rejected');
var badShape = importData('{"userState": "not an object"}');
assert(badShape.success === false, 'Bad shape rejected');

// ── Summary ──
console.log('\\n' + '='.repeat(40));
console.log('Passed: ' + passed + '/' + (passed + failed));
if (failed > 0) {
  console.log('FAILED: ' + failed);
} else {
  console.log('All tests passed! ✓');
}
console.log();
`;

// Build combined script
let combined = stubs + '\n';
for (const f of sourceFiles) {
  combined += '\n// === ' + f + ' ===\n';
  combined += fs.readFileSync(f, 'utf-8') + '\n';
}
combined += '\n// === Tests ===\n' + tests;

// Run in a sandboxed context
const ctx = vm.createContext({
  console, Promise, setTimeout, clearTimeout, Math, Date, Object, Array,
  Set, Map, JSON, parseInt, parseFloat, isNaN, isFinite, Number, String,
  Boolean, RegExp, Error, TypeError, ReferenceError, SyntaxError
});

try {
  vm.runInContext(combined, ctx, { filename: 'test_phase1.js' });
} catch (e) {
  console.error('Test execution error:', e.message);
  console.error(e.stack);
  process.exit(1);
}
