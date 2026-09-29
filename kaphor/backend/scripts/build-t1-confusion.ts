/**
 * Build a standalone 3x3 confusion-matrix HTML heatmap for the T1 GLIE dataset.
 * Truth  = AI routing (glie_routing, assumed human truth)
 * Pred   = formula routing (formula_routing)
 *
 * Output: data/T1_glie_confusion.html
 */
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.resolve(__dirname, '../data');
const CSV_PATH = path.join(DATA_DIR, 'T1_glie_dataset.csv');
const OUT = path.join(DATA_DIR, 'T1_glie_confusion.html');

const CLASSES = ['RESELL', 'UPCYCLE', 'RECYCLE'];

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; continue; }
    if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
    current += char;
  }
  result.push(current.trim());
  return result;
}

function main() {
  const raw = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = raw.split('\n').filter((l) => l.trim());
  const headers = parseCSVLine(lines[0]);

  const matrix: Record<string, Record<string, number>> = {
    RESELL: { RESELL: 0, UPCYCLE: 0, RECYCLE: 0 },
    UPCYCLE: { RESELL: 0, UPCYCLE: 0, RECYCLE: 0 },
    RECYCLE: { RESELL: 0, UPCYCLE: 0, RECYCLE: 0 },
  };
  const truthCounts: Record<string, number> = { RESELL: 0, UPCYCLE: 0, RECYCLE: 0 };
  let total = 0;
  let correct = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 2) continue;
    const rec: Record<string, string> = {};
    for (let j = 0; j < headers.length && j < cols.length; j++) rec[headers[j]] = cols[j].replace(/^"|"$/g, '');

    const truth = (rec.glie_routing || '').toUpperCase();
    const pred = (rec.formula_routing || '').toUpperCase();
    if (!CLASSES.includes(truth) || !CLASSES.includes(pred)) continue;

    matrix[truth][pred]++;
    truthCounts[truth]++;
    total++;
    if (truth === pred) correct++;
  }

  const overallAcc = total ? (correct / total) * 100 : 0;
  let maxCount = 0;
  for (const t of CLASSES) for (const p of CLASSES) maxCount = Math.max(maxCount, matrix[t][p]);

  const intensity = (count: number) =>
    count === 0 ? 0 : 35 + Math.round((count / maxCount) * 65);

  const cells = CLASSES.map((truth) => {
    const tCount = truthCounts[truth];
    const acc = tCount ? matrix[truth][truth] / tCount : 0;
    const tds = CLASSES.map((pred) => {
      const c = matrix[truth][pred];
      const isCorrect = truth === pred;
      const red = isCorrect ? 15 : Math.round(90 - (c / maxCount) * 90);
      const green = isCorrect ? Math.round(70 + (c / maxCount) * 30) : Math.round(40 - (c / maxCount) * 40);
      const blue = isCorrect ? Math.round(50 - (c / maxCount) * 40) : Math.round(40 - (c / maxCount) * 30);
      return `      <td class="${isCorrect ? 'ok' : 'bad'}" style="background:rgba(${red},${green},${blue},0.${intensity(c)})" title="truth=${truth} pred=${pred}">
        <span class="cnt">${c}</span><span class="pct">${tCount ? Math.round((c / tCount) * 100) : 0}%</span>
      </td>`;
    }).join('\n');
    return `<tr>
      <th class="truth">${truth}</th>
${tds}
      <td class="acc">${acc ? (acc * 100).toFixed(1) : '0.0'}%</td>
    </tr>`;
  }).join('\n\n');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>GLIE T1 Confusion Matrix</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: #141414; color: #F5F1E8; padding: 30px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #9b9b9b; font-size: 13px; margin-bottom: 22px; }
  table.cm { border-collapse: collapse; }
  table.cm th, table.cm td { border: 1px solid #333; padding: 16px 18px; text-align: center; font-size: 14px; }
  table.cm th { color: #888; font-weight: 700; }
  th.truth { color: #F5F1E8; background: #1e1e1e; }
  td.ok, td.bad { color: #fff; }
  .cnt { display: block; font-size: 16px; font-weight: 800; }
  .pct { font-size: 10px; opacity: 0.85; }
  td.acc { font-weight: 800; color: #F5F1E8; background: #1e1e1e; }
  .legend { margin-top: 20px; color: #9b9b9b; font-size: 13px; }
  .badge { display:inline-block; width:14px; height:14px; border:1px solid #333; margin-right:6px; vertical-align:middle; }
</style>
</head>
<body>
<h1>GLIE T1 Confusion Matrix</h1>
<div class="sub">rows (AI truth) = ${CLASSES.join(' / ')} · columns (formula pred) = ${CLASSES.join(' / ')} · n=${total} ·
overall accuracy = ${overallAcc.toFixed(1)}% · correct=${correct}, errors=${total - correct}</div>
<table class="cm">
  <thead>
    <tr><th rowspan="2" class="truth">truth \\ pred</th><th colspan="3">formula prediction</th><th rowspan="2">recall</th></tr>
    <tr>
      ${CLASSES.map((c) => `<th>${c}</th>`).join('\n      ')}
    </tr>
  </thead>
  <tbody>
${cells}
  </tbody>
</table>
<div class="legend">
  <span style="margin-right:16px"><span class="badge" style="background:#14523a"></span> correct (diagonal)</span>
  <span><span class="badge" style="background:#7a2a2a"></span> misclassification (off-diagonal)</span>
</div>
</body>
</html>`;

  fs.writeFileSync(OUT, html, 'utf-8');
  console.log(`Wrote confusion matrix → ${OUT}`);
  console.log(`n=${total} · correct=${correct} · errors=${total - correct} · overall accuracy=${overallAcc.toFixed(1)}%`);
  console.log('\nRows=AI truth (assumed human), Cols=formula pred:');
  console.log('              ' + CLASSES.map((c) => c.padStart(10)).join(''));
  for (const t of CLASSES) {
    console.log(t.padEnd(10) + '  ' + CLASSES.map((p) => String(matrix[t][p]).padStart(10)).join(''));
  }
  console.log('Total per truth: ' + CLASSES.map((t) => `${t}=${truthCounts[t]}`).join(', '));
}

main();