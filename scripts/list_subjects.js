const fs = require('fs');
const path = require('path');

for (const f of ['ras_pre_2026', 'rpsc_2nd_grade_paper1', 'rpsc_2nd_grade_paper2_science']) {
  const d = JSON.parse(fs.readFileSync(path.join('syllabus', f + '.json'), 'utf-8'));
  console.log('\n===', d.exam, '===');
  for (const s of d.subjects) {
    function countLeaves(n) {
      const kids = n.children || n.topics || [];
      if (kids.length === 0) return 1;
      let c = 0;
      for (const ch of kids) c += countLeaves(ch);
      return c;
    }
    console.log('  ' + s.id + ': ' + s.title_en + ' (' + countLeaves(s) + ' leaf topics)');
  }
}
