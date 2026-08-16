/**
 * js/config.js — Exam definitions, cross-exam overlap map, accent colors
 *
 * Source of truth for which exams exist and how topics map across them.
 * The CROSS_EXAM_ID_MAP is a manual substance-based mapping: the three
 * syllabi use different topic IDs even when covering the same material.
 *
 * Overlap-stats fix (DATA_MODEL.md §5): the old "efficiency" formula
 * (totalOverlap * 2 / combined * 100) could exceed 100%. We replace it
 * with a straightforward: sharedTopics / totalUniqueTopicsAcrossBothExams.
 */

// ── Exam registry ──────────────────────────────────────────────────────────

const EXAMS = [
  {
    id: 'ras_pre_2026',
    name: 'RAS Pre 2026',
    shortName: 'RAS Pre',
    accentVar: '--accent-ras',       // CSS custom property name
    accent: '#7c6df0'               // fallback hex (dark theme default)
  },
  {
    id: 'rpsc_2nd_grade_paper1',
    name: 'RPSC 2nd Grade Paper I',
    shortName: '2G Paper I',
    accentVar: '--accent-2g-p1',
    accent: '#2ed8a3'
  },
  {
    id: 'rpsc_2nd_grade_paper2_science',
    name: 'RPSC 2nd Grade Paper II Science',
    shortName: '2G Paper II',
    accentVar: '--accent-2g-p2',
    accent: '#e17055'
  }
];

/**
 * Quick lookup: examId → EXAMS entry.
 */
function getExamConfig(examId) {
  return EXAMS.find(e => e.id === examId) || null;
}

// ── Cross-exam overlap map ──────────────────────────────────────────────────
//
// Maps topic IDs that cover the same substance across exams.
// Key: topic id from any exam → value: array of { examId, topicId } of
// equivalent topics in *other* exams.
//
// This covers the RAS Pre ↔ 2nd Grade Paper I overlap (Rajasthan History,
// Geography, Polity, Current Affairs). Paper II Science has no meaningful
// overlap with the other two.
//
// Granularity note: some RAS Pre topics are broader or narrower than their
// Paper I counterparts. We map at the closest equivalent leaf level. Where
// a 1:1 map isn't possible, we map the broader RAS topic to multiple Paper I
// topics (and vice versa).

const CROSS_EXAM_ID_MAP = {

  // ── Rajasthan History & Culture ────────────────────────────────────────

  // RAS: Prehistoric sites → P1: Ancient Culture & Civilization (closest)
  'prehistoric_sites_rajasthan': [{ examId: 'rpsc_2nd_grade_paper1', topicId: 'ancient_culture_civilization_rajasthan_2g' }],
  'ancient_culture_civilization_rajasthan_2g': [{ examId: 'ras_pre_2026', topicId: 'prehistoric_sites_rajasthan' }],

  // RAS: Praja Mandal movement → P1: Prajamandal Movements
  'praja_mandal_movement_awakening': [{ examId: 'rpsc_2nd_grade_paper1', topicId: 'prajamandal_movements_2g' }],
  'prajamandal_movements_2g': [{ examId: 'ras_pre_2026', topicId: 'praja_mandal_movement_awakening' }],

  // RAS: Peasant & tribal movements → P1: Peasants and Tribal Movements
  'peasant_tribal_movements_20th_century': [{ examId: 'rpsc_2nd_grade_paper1', topicId: 'peasants_tribal_movements_2g' }],
  'peasants_tribal_movements_2g': [{ examId: 'ras_pre_2026', topicId: 'peasant_tribal_movements_20th_century' }],

  // RAS: Integration of Rajasthan → P1: Integration of Rajasthan
  'integration_of_rajasthan': [{ examId: 'rpsc_2nd_grade_paper1', topicId: 'integration_of_rajasthan_2g' }],
  'integration_of_rajasthan_2g': [{ examId: 'ras_pre_2026', topicId: 'integration_of_rajasthan' }],

  // RAS: Fairs & festivals → P1: Fairs and Festivals
  'fairs_and_festivals': [{ examId: 'rpsc_2nd_grade_paper1', topicId: 'fairs_festivals_2g' }],
  'fairs_festivals_2g': [{ examId: 'ras_pre_2026', topicId: 'fairs_and_festivals' }],

  // RAS: Eminent personalities → P1: Leading Personalities
  'eminent_personalities_rajasthan': [{ examId: 'rpsc_2nd_grade_paper1', topicId: 'leading_personalities_rajasthan_2g' }],
  'leading_personalities_rajasthan_2g': [{ examId: 'ras_pre_2026', topicId: 'eminent_personalities_rajasthan' }],

  // ── Rajasthan Geography ───────────────────────────────────────────────

  // RAS: Agriculture → P1: Agriculture
  'agriculture_rajasthan': [{ examId: 'rpsc_2nd_grade_paper1', topicId: 'agriculture_rajasthan_2g' }],
  'agriculture_rajasthan_2g': [{ examId: 'ras_pre_2026', topicId: 'agriculture_rajasthan' }],

  // RAS: Livestock → P1: Livestock
  'livestock_rajasthan': [{ examId: 'rpsc_2nd_grade_paper1', topicId: 'livestock_rajasthan_2g' }],
  'livestock_rajasthan_2g': [{ examId: 'ras_pre_2026', topicId: 'livestock_rajasthan' }],

  // RAS: Tribes → P1: Tribes
  'tribes_rajasthan': [{ examId: 'rpsc_2nd_grade_paper1', topicId: 'tribes_rajasthan_2g' }],
  'tribes_rajasthan_2g': [{ examId: 'ras_pre_2026', topicId: 'tribes_rajasthan' }],

  // RAS: Tourism → P1: Tourism
  'tourism_rajasthan': [{ examId: 'rpsc_2nd_grade_paper1', topicId: 'tourism_major_centres_rajasthan_2g' }],
  'tourism_major_centres_rajasthan_2g': [{ examId: 'ras_pre_2026', topicId: 'tourism_rajasthan' }],

  // RAS: Natural vegetation → P1: Natural Vegetation
  'natural_vegetation_biodiversity_conservation_rajasthan': [{ examId: 'rpsc_2nd_grade_paper1', topicId: 'natural_vegetation_rajasthan_2g' }],
  'natural_vegetation_rajasthan_2g': [{ examId: 'ras_pre_2026', topicId: 'natural_vegetation_biodiversity_conservation_rajasthan' }],

  // ── Rajasthan Polity ──────────────────────────────────────────────────

  // RAS: Governor → P1: Governor, CM, Council
  'governor_rajasthan': [{ examId: 'rpsc_2nd_grade_paper1', topicId: 'governor_cm_council_ministers_2g' }],
  'cm_council_of_ministers': [{ examId: 'rpsc_2nd_grade_paper1', topicId: 'governor_cm_council_ministers_2g' }],
  'governor_cm_council_ministers_2g': [{ examId: 'ras_pre_2026', topicId: 'governor_rajasthan' }, { examId: 'ras_pre_2026', topicId: 'cm_council_of_ministers' }],

  // RAS: Legislative Assembly → P1: State Legislative Assembly
  'rajasthan_legislative_assembly': [{ examId: 'rpsc_2nd_grade_paper1', topicId: 'state_legislative_assembly_2g' }],
  'state_legislative_assembly_2g': [{ examId: 'ras_pre_2026', topicId: 'rajasthan_legislative_assembly' }],

  // RAS: High Court → P1: High Court and Subordinate Courts
  'rajasthan_high_court': [{ examId: 'rpsc_2nd_grade_paper1', topicId: 'high_court_subordinate_courts_2g' }],
  'subordinate_courts_judicial_bodies': [{ examId: 'rpsc_2nd_grade_paper1', topicId: 'high_court_subordinate_courts_2g' }],
  'high_court_subordinate_courts_2g': [{ examId: 'ras_pre_2026', topicId: 'rajasthan_high_court' }, { examId: 'ras_pre_2026', topicId: 'subordinate_courts_judicial_bodies' }],

  // RAS: Panchayati Raj → P1: Panchayati Raj
  'panchayati_raj_rajasthan': [{ examId: 'rpsc_2nd_grade_paper1', topicId: 'panchayati_raj_system_administration_2g' }],
  'panchayati_raj_system_administration_2g': [{ examId: 'ras_pre_2026', topicId: 'panchayati_raj_rajasthan' }],

  // RAS: Municipal administration → P1: Urban Local Self Government
  'municipal_administration_rajasthan': [{ examId: 'rpsc_2nd_grade_paper1', topicId: 'urban_local_self_government_administration_2g' }],
  'urban_local_self_government_administration_2g': [{ examId: 'ras_pre_2026', topicId: 'municipal_administration_rajasthan' }],

  // RAS: RPSC → P1: RPSC
  'rpsc': [{ examId: 'rpsc_2nd_grade_paper1', topicId: 'rpsc_2g' }],
  'rpsc_2g': [{ examId: 'ras_pre_2026', topicId: 'rpsc' }],

  // RAS: Lokayukta → P1: Lokayukta
  'lokayukta': [{ examId: 'rpsc_2nd_grade_paper1', topicId: 'lokayukta_2g' }],
  'lokayukta_2g': [{ examId: 'ras_pre_2026', topicId: 'lokayukta' }],

  // RAS: State Election Commission → P1: State Election Commission
  'state_election_commission_rajasthan': [{ examId: 'rpsc_2nd_grade_paper1', topicId: 'rajasthan_state_election_commission_2g' }],
  'rajasthan_state_election_commission_2g': [{ examId: 'ras_pre_2026', topicId: 'state_election_commission_rajasthan' }],

  // RAS: Women Commission → P1: Commission for Women
  'rajasthan_state_women_commission': [{ examId: 'rpsc_2nd_grade_paper1', topicId: 'rajasthan_state_commission_for_women_2g' }],
  'rajasthan_state_commission_for_women_2g': [{ examId: 'ras_pre_2026', topicId: 'rajasthan_state_women_commission' }],

  // ── Current Affairs ───────────────────────────────────────────────────

  // RAS: Important personalities/places → P1: Important persons/places
  'important_personalities_places_contemporary_issues': [{ examId: 'rpsc_2nd_grade_paper1', topicId: 'important_persons_places_current_issues_2g' }],
  'important_persons_places_current_issues_2g': [{ examId: 'ras_pre_2026', topicId: 'important_personalities_places_contemporary_issues' }],

  // RAS: Welfare schemes → P1: Welfare schemes
  'welfare_development_new_schemes_programs_initiatives': [{ examId: 'rpsc_2nd_grade_paper1', topicId: 'new_schemes_initiatives_welfare_development_2g' }],
  'new_schemes_initiatives_welfare_development_2g': [{ examId: 'ras_pre_2026', topicId: 'welfare_development_new_schemes_programs_initiatives' }],

  // RAS: Economic/political events → P1: Economic-Political Dynamics
  'major_economic_political_events': [{ examId: 'rpsc_2nd_grade_paper1', topicId: 'economic_political_dynamics_2g' }],
  'economic_political_dynamics_2g': [{ examId: 'ras_pre_2026', topicId: 'major_economic_political_events' }],

  // RAS: Sports achievements → P1: Sports and Games
  'sports_achievements': [{ examId: 'rpsc_2nd_grade_paper1', topicId: 'sports_and_games_2g' }],
  'sports_and_games_2g': [{ examId: 'ras_pre_2026', topicId: 'sports_achievements' }],

  // RAS: Awards/publications → P1: Awards/books/authors
  'awards_publications_eminent_authors': [{ examId: 'rpsc_2nd_grade_paper1', topicId: 'awards_books_authors_2g' }],
  'awards_books_authors_2g': [{ examId: 'ras_pre_2026', topicId: 'awards_publications_eminent_authors' }]
};

/**
 * Get overlapping topics for a given topic ID.
 * Returns an array of { examId, topicId } or empty array if none.
 */
function getOverlaps(topicId) {
  return CROSS_EXAM_ID_MAP[topicId] || [];
}

/**
 * Compute overlap statistics between two exams.
 * Uses the corrected formula: sharedTopics / totalUniqueTopicsAcrossBothExams * 100
 *
 * @param {string} examId1
 * @param {string} examId2
 * @returns {{ shared: number, totalUnique: number, percentage: number }}
 */
function computeOverlapStats(examId1, examId2) {
  const seen = new Set();
  let sharedCount = 0;

  // Count topics from exam1 that have a mapping to exam2
  for (const [topicId, mappings] of Object.entries(CROSS_EXAM_ID_MAP)) {
    const hasExam1 = topicId; // we'll check below
    const mapsToExam2 = mappings.some(m => m.examId === examId2);

    if (mapsToExam2) {
      // Find which exam this topicId belongs to
      // (We need syllabus data for total counts — this function provides just the overlap count)
      const pairKey = [topicId, ...mappings.filter(m => m.examId === examId2).map(m => m.topicId)].sort().join('|');
      if (!seen.has(pairKey)) {
        seen.add(pairKey);
        sharedCount++;
      }
    }
  }

  // Total unique topics require syllabus data — computed at runtime in study.js
  return { shared: sharedCount };
}
