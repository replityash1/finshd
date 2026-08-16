const fs = require('fs');
const path = require('path');

// Print leaf topic IDs + English titles for the overlapping subjects
const ras = JSON.parse(fs.readFileSync('syllabus/ras_pre_2026.json', 'utf-8'));
const p1 = JSON.parse(fs.readFileSync('syllabus/rpsc_2nd_grade_paper1.json', 'utf-8'));

// Subjects that likely overlap: Rajasthan history/culture, Rajasthan polity, current affairs, geography
const rasSubjects = ['rajasthan_history_culture', 'rajasthan_geography', 'rajasthan_political_administrative_system', 'current_affairs_rajasthan_context'];
const p1Subjects = ['rajasthan_geo_history_cultural_gk', 'rajasthan_political_administrative_system_2g', 'current_affairs_rajasthan_2g'];

function printLeaves(node, depth) {
  const kids = node.children || node.topics || [];
  if (kids.length === 0) {
    console.log('  '.repeat(depth) + node.id + ' | ' + node.title_en);
    return;
  }
  if (node.id && depth > 0) {
    console.log('  '.repeat(depth) + '[parent] ' + node.id + ' | ' + node.title_en);
  }
  for (const ch of kids) printLeaves(ch, depth + 1);
}

console.log('\n=== RAS Pre — Overlapping Subjects ===');
for (const s of ras.subjects.filter(s => rasSubjects.includes(s.id))) {
  console.log('\n--- ' + s.title_en + ' ---');
  printLeaves(s, 0);
}

console.log('\n\n=== 2nd Grade Paper I — Overlapping Subjects ===');
for (const s of p1.subjects.filter(s => p1Subjects.includes(s.id))) {
  console.log('\n--- ' + s.title_en + ' ---');
  printLeaves(s, 0);
}
