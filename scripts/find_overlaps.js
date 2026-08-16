/**
 * Quick analysis script to find overlapping topic IDs across all 3 exams.
 * Run: node scripts/find_overlaps.js
 */
const fs = require('fs');
const path = require('path');

const SYLLABUS_DIR = path.join(__dirname, '..', 'syllabus');

function collectIds(node, examId, map) {
  const id = node.id;
  if (id) {
    if (!map[id]) map[id] = [];
    map[id].push(examId);
  }
  const kids = node.children || node.topics || [];
  for (const child of kids) {
    collectIds(child, examId, map);
  }
}

const idMap = {};
const files = fs.readdirSync(SYLLABUS_DIR).filter(f => f.endsWith('.json'));

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(SYLLABUS_DIR, file), 'utf-8'));
  const examId = data.examId;
  for (const subj of data.subjects) {
    collectIds(subj, examId, idMap);
  }
}

// Find IDs that appear in more than one exam
const overlaps = {};
for (const [id, exams] of Object.entries(idMap)) {
  if (exams.length > 1) {
    const key = [...new Set(exams)].sort().join(' + ');
    if (!overlaps[key]) overlaps[key] = [];
    overlaps[key].push(id);
  }
}

console.log('\n=== Cross-Exam Overlap Analysis ===\n');

if (Object.keys(overlaps).length === 0) {
  console.log('No overlapping topic IDs found across exams.');
  console.log('(Topics may overlap in substance but use different IDs — this would need manual mapping.)');
} else {
  for (const [pair, ids] of Object.entries(overlaps)) {
    console.log(`${pair}: ${ids.length} shared IDs`);
    for (const id of ids) {
      console.log(`  - ${id}`);
    }
    console.log();
  }
}

// Also print summary stats per exam
console.log('=== Per-Exam Stats ===\n');
const examCounts = {};
for (const [id, exams] of Object.entries(idMap)) {
  for (const e of new Set(exams)) {
    examCounts[e] = (examCounts[e] || 0) + 1;
  }
}
for (const [exam, count] of Object.entries(examCounts)) {
  console.log(`${exam}: ${count} unique topic IDs`);
}
console.log(`\nTotal unique IDs across all exams: ${Object.keys(idMap).length}`);
