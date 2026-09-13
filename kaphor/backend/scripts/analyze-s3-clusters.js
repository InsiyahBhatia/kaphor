/**
 * READ-ONLY analysis: clusters the user photos in garments/ into
 * candidate listings by upload-time proximity (multi-photo listings are
 * uploaded seconds apart). Does NOT write to the database.
 * Usage: node scripts/analyze-s3-clusters.js [--gap-minutes 5]
 */
const inv = require('./s3-inventory.json');

const gapFlagIdx = process.argv.indexOf('--gap-seconds');
const gapMin = gapFlagIdx > -1 ? Number(process.argv[gapFlagIdx + 1]) || 3 : 3;
const GROUP_GAP_MS = gapMin * 1000;

const photos = inv.objects
  .filter((o) => o.key.startsWith('garments/') && !o.key.includes('\\'))
  .map((o) => {
    const m = o.key.match(/garments\/([0-9a-f-]{36})-(\d{13})\.jpeg/);
    return m
      ? { uuid: m[1], ts: Number(m[2]), key: o.key, date: new Date(Number(m[2])).toISOString() }
      : { uuid: null, ts: 0, key: o.key, date: '?' };
  });

photos.sort((a, b) => a.ts - b.ts);

console.log(`Total user photos: ${photos.length}`);
console.log(`Unparseable names: ${photos.filter((p) => !p.uuid).length}`);
console.log(`Date range: ${photos[0]?.date} -> ${photos[photos.length - 1]?.date}`);
console.log(`Clustering gap: > ${gapMin} min between consecutive uploads starts a new listing\n`);

const groups = [];
for (const p of photos) {
  const last = groups[groups.length - 1];
  if (last && p.ts - last[last.length - 1].ts < GROUP_GAP_MS) last.push(p);
  else groups.push([p]);
}

const sizeDist = {};
groups.forEach((g) => { sizeDist[g.length] = (sizeDist[g.length] || 0) + 1; });
console.log(`Clustered into ${groups.length} candidate listings`);
console.log(`Photos-per-listing distribution: ${JSON.stringify(sizeDist)}\n`);

console.log('=== CANDIDATE LISTINGS ===');
groups.forEach((g, i) => {
  const when = g[0].date.slice(0, 16).replace('T', ' ');
  console.log(`L${String(i + 1).padStart(3)} | ${when} | ${g.length} photo(s)`);
  g.forEach((p) => console.log(`       ${p.key}`));
});

// CSV for the rebuild script: groupIndex,timestamp,key
const csv = groups
  .map((g, i) => g.map((p) => `${i + 1},${p.ts},${p.key}`).join('\n'))
  .join('\n');
require('fs').writeFileSync(require('path').join(__dirname, 'cluster-map.csv'), csv);
console.log('\nSaved machine-readable map to scripts/cluster-map.csv');
