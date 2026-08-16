const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf-8');

// Check scripts in order
const scripts = [];
const re = /<script src="([^"]+)"/g;
let m;
while ((m = re.exec(html)) !== null) scripts.push(m[1]);
console.log('Scripts in load order:');
scripts.forEach(function(s, i) { console.log('  ' + (i + 1) + '. ' + s); });

// Check CSS files
console.log('\nCSS files:');
const cssRe = /<link rel="stylesheet" href="([^"]+)"/g;
while ((m = cssRe.exec(html)) !== null) console.log('  ' + m[1]);

// Check structure
console.log('\nNav buttons (data-view):', (html.match(/data-view=/g) || []).length);
console.log('View containers:', (html.match(/id="view-/g) || []).length);
console.log('Has manifest:', html.includes('manifest.json'));
console.log('Has favicon:', html.includes('favicon.svg'));
console.log('aria-label count:', (html.match(/aria-label/g) || []).length);
console.log('Real <button> elements:', (html.match(/<button /g) || []).length);

// Verify script order matches ARCHITECTURE.md
const expectedOrder = [
  'js/firebase-config.js', 'js/syllabus_data.js', 'js/config.js', 'js/state.js',
  'js/storage.js', 'js/utils.js', 'js/search.js', 'js/export.js',
  'js/home.js', 'js/study.js', 'js/progress.js', 'js/studyhub.js',
  'js/nav.js', 'js/init.js'
];
const appScripts = scripts.filter(function(s) { return s.startsWith('js/'); });
console.log('\nScript order matches ARCHITECTURE.md:', JSON.stringify(appScripts) === JSON.stringify(expectedOrder));

// Verify no duplicate IDs
const idRe = /id="([^"]+)"/g;
const ids = {};
let dupes = 0;
while ((m = idRe.exec(html)) !== null) {
  if (ids[m[1]]) { console.log('DUPLICATE ID:', m[1]); dupes++; }
  ids[m[1]] = true;
}
console.log('Duplicate IDs found:', dupes);
