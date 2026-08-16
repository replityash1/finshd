#!/usr/bin/env node
/**
 * scripts/clean_syllabus.js
 *
 * Strips embedded per-user mutable fields (completed, revision, bookmarked,
 * notes, progress) from each syllabus JSON file, keeping only content fields.
 * Then generates js/syllabus_data.js — a single JS file that exposes all
 * cleaned syllabi as a global SYLLABUS_DATA object, so it never drifts from
 * the JSON source of truth.
 *
 * Usage:  node scripts/clean_syllabus.js
 *
 * Reads from:  syllabus/*.json (the raw files with embedded state)
 * Writes to:   syllabus/*.json (overwritten, cleaned)
 *              js/syllabus_data.js (generated bundle)
 */

const fs = require('fs');
const path = require('path');

const SYLLABUS_DIR = path.join(__dirname, '..', 'syllabus');
const OUTPUT_JS = path.join(__dirname, '..', 'js', 'syllabus_data.js');

// Fields to strip — these are per-user mutable state, not content
const STRIP_FIELDS = new Set(['completed', 'revision', 'bookmarked', 'notes', 'progress']);

// Fields to keep on every node
// Required: id, title_hi, title_en, children
// Optional (Paper II Science): level, level_label_en, level_label_hi

/**
 * Recursively strip user-state fields from a topic/subject node.
 * Preserves: id, title_hi, title_en, children, and level/level_label_* if present.
 */
function cleanNode(node) {
  const cleaned = {};

  for (const [key, value] of Object.entries(node)) {
    if (STRIP_FIELDS.has(key)) continue;

    if (key === 'children' || key === 'topics') {
      cleaned[key] = Array.isArray(value) ? value.map(cleanNode) : value;
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

/**
 * Derive a stable examId from the exam title string.
 * Maps known exam names to the IDs used in ARCHITECTURE.md / config.js.
 */
function deriveExamId(examTitle) {
  const lower = examTitle.toLowerCase();
  if (lower.includes('ras pre')) return 'ras_pre_2026';
  if (lower.includes('paper-ii') || lower.includes('paper ii') || lower.includes('paper-2')) return 'rpsc_2nd_grade_paper2_science';
  if (lower.includes('paper-i') || lower.includes('paper i') || lower.includes('paper-1')) return 'rpsc_2nd_grade_paper1';
  // Fallback: slugify
  return examTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
}

// --- Main ---

const jsonFiles = fs.readdirSync(SYLLABUS_DIR).filter(f => f.endsWith('.json'));
const allSyllabi = {};
let totalTopicsBefore = 0;
let totalTopicsAfter = 0;

function countTopics(node) {
  let count = 1;
  const kids = node.children || node.topics || [];
  for (const child of kids) {
    count += countTopics(child);
  }
  return count;
}

console.log(`\nCleaning ${jsonFiles.length} syllabus file(s)...\n`);

for (const file of jsonFiles) {
  const filePath = path.join(SYLLABUS_DIR, file);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);

  const examTitle = data.exam || file;
  const examId = data.examId || deriveExamId(examTitle);

  // Count topics before cleaning
  let beforeCount = 0;
  for (const subj of data.subjects || []) {
    beforeCount += countTopics(subj);
  }
  totalTopicsBefore += beforeCount;

  // Clean the data
  const cleaned = {
    exam: data.exam,
    examId: examId,
    subjects: (data.subjects || []).map(cleanNode)
  };

  // Count topics after cleaning (should be same count, just fewer fields)
  let afterCount = 0;
  for (const subj of cleaned.subjects) {
    afterCount += countTopics(subj);
  }
  totalTopicsAfter += afterCount;

  // Determine output filename per ARCHITECTURE.md naming convention
  const outFileName = examId + '.json';
  const outPath = path.join(SYLLABUS_DIR, outFileName);

  // Write cleaned JSON
  fs.writeFileSync(outPath, JSON.stringify(cleaned, null, 2), 'utf-8');

  // Remove old file if name differs
  if (file !== outFileName) {
    fs.unlinkSync(filePath);
    console.log(`  ✓ ${file} → ${outFileName} (renamed + cleaned)`);
  } else {
    console.log(`  ✓ ${outFileName} (cleaned in place)`);
  }
  console.log(`    ${afterCount} nodes, ${data.subjects.length} subjects`);

  allSyllabi[examId] = cleaned;
}

// Generate syllabus_data.js
const jsContent = `/**
 * js/syllabus_data.js — Auto-generated from syllabus/*.json
 * DO NOT EDIT BY HAND. Run: node scripts/clean_syllabus.js
 * Generated: ${new Date().toISOString()}
 */

const SYLLABUS_DATA = ${JSON.stringify(allSyllabi, null, 2)};
`;

fs.writeFileSync(OUTPUT_JS, jsContent, 'utf-8');

const jsSizeKB = (fs.statSync(OUTPUT_JS).size / 1024).toFixed(1);

console.log(`\n  ✓ js/syllabus_data.js generated (${jsSizeKB} KB)`);
console.log(`\nDone. ${totalTopicsAfter} total nodes across ${jsonFiles.length} exams.`);
console.log(`(Topic count unchanged: ${totalTopicsBefore} → ${totalTopicsAfter})\n`);
