/**
 * Build a self-contained HTML report embedding each GLIE image as base64
 * alongside its T1_glie.csv row, so the photo and its data are viewable
 * together in a browser without any server or image library.
 *
 * Output: data/T1_glie_report.html
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.resolve(__dirname, '../data');
const CSV_PATH = path.join(DATA_DIR, 'T1_glie_dataset.csv');
const OUT = path.join(DATA_DIR, 'T1_glie_report.html');
const IMAGE_DIR = path.resolve(__dirname, '../../../docs/glie-images');

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function mimeFor(file: string): string {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

function main() {
  const raw = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = raw.split('\n').filter((l) => l.trim());
  const headers = parseCSVLine(lines[0]);

  let withImage = 0;
  let missing: string[] = [];
  let agree = 0;

  const records: Array<{
    html: string;
    csv: string;
    formula: string;
    ok: boolean;
    split: string;
  }> = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 2) continue;
    const rec: Record<string, string> = {};
    for (let j = 0; j < headers.length && j < cols.length; j++) {
      rec[headers[j]] = cols[j].replace(/^"|"$/g, '');
    }

    const fileName = rec.image_url || '';
    const imgPath = path.join(IMAGE_DIR, fileName);
    let imgTag = '';
    if (fileName && fs.existsSync(imgPath)) {
      const b64 = fs.readFileSync(imgPath).toString('base64');
      const mime = mimeFor(fileName);
      imgTag = `<img class="photo" src="data:${mime};base64,${b64}" alt="${escapeHtml(fileName)}"/>`;
      withImage++;
    } else {
      missing.push(fileName);
      imgTag = `<div class="noimg">no image: ${escapeHtml(fileName)}</div>`;
    }

    const split = rec.split || '';
    const formula = rec.formula_routing || '';
    const routing = rec.glie_routing || '';
    const ok = !!(formula && routing && formula === routing);
    if (ok) agree++;

    const splitBadge = split === 'test'
      ? '<span class="badge test">TEST</span>'
      : split === 'train'
        ? '<span class="badge train">TRAIN</span>'
        : '';
    const matchBadge = formula && routing
      ? (ok ? '<span class="badge agree">MATCH</span>' : '<span class="badge disagree">MISMATCH</span>')
      : '';

    records.push({
      csv: routing,
      formula,
      ok,
      split,
      html: `
    <tr data-csv="${escapeHtml(routing)}" data-formula="${escapeHtml(formula)}" data-mismatch="${ok ? '0' : '1'}" data-split="${split || 'none'}">
      <td class="photo-cell">${imgTag}</td>
      <td>
        <div class="mono">${escapeHtml(fileName)}</div>
        ${splitBadge} ${matchBadge}
        <table class="fields">
          <tr><td>category</td><td>${escapeHtml(rec.garment_category || '')}</td></tr>
          <tr><td>subcategory</td><td>${escapeHtml(rec.garment_subcategory || '')}</td></tr>
          <tr><td>angle</td><td>${escapeHtml(rec.photo_angle || '')}</td></tr>
          <tr><td>damage_ratio</td><td>${escapeHtml(rec.damage_ratio || '')}</td></tr>
          <tr><td>stain_ratio</td><td>${escapeHtml(rec.stain_ratio || '')}</td></tr>
          <tr><td>wear_zone_ratio</td><td>${escapeHtml(rec.wear_zone_ratio || '')}</td></tr>
          <tr><td>fiber_degradation</td><td>${escapeHtml(rec.fiber_degradation || '')}</td></tr>
          <tr><td>damage_types</td><td>${escapeHtml(rec.damage_types || '')}</td></tr>
          <tr><td>damage_location</td><td>${escapeHtml(rec.damage_location || '')}</td></tr>
          <tr><td>condition_score</td><td><b>${escapeHtml(rec.condition_score || '')}</b></td></tr>
          <tr><td>label</td><td>${escapeHtml(rec.human_condition_label || '')}</td></tr>
          <tr><td>CSV routing</td><td><b>${escapeHtml(routing || '')}</b></td></tr>
          <tr><td>Formula routing</td><td><b>${escapeHtml(formula || '')}</b></td></tr>
          <tr><td>Formula prediction</td><td>${escapeHtml(ok ? '★ agrees with CSV' : (formula === 'RESELL' ? '↑ resell (disagrees)' : formula === 'UPCYCLE' ? '↑ upcycle (disagrees)' : '↓ recycle (disagrees)'))}</td></tr>
        </table>
      </td>
    </tr>`,
    });
  }

  const total = records.length;

  // Group rows by AI (glie_routing) as assumed human routing, preserving category order
  const categoryOrder = ['RESELL', 'UPCYCLE', 'RECYCLE'];
  const grouped = new Map<string, typeof records>();
  for (const rec of records) {
    const key = categoryOrder.includes(rec.csv) ? rec.csv : 'UPCYCLE';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(rec);
  }

  // Confusion matrix: AI (glie_routing = assumed human) rows × formula cols
  const matrix: Record<string, Record<string, number>> = {
    RESELL: { RESELL: 0, UPCYCLE: 0, RECYCLE: 0 },
    UPCYCLE: { RESELL: 0, UPCYCLE: 0, RECYCLE: 0 },
    RECYCLE: { RESELL: 0, UPCYCLE: 0, RECYCLE: 0 },
  };
  const aiCounts: Record<string, number> = { RESELL: 0, UPCYCLE: 0, RECYCLE: 0 };
  for (const rec of records) {
    const ai = categoryOrder.includes(rec.csv) ? rec.csv : 'UPCYCLE';
    const formula = categoryOrder.includes(rec.formula) ? rec.formula : 'UPCYCLE';
    matrix[ai][formula]++;
    aiCounts[ai]++;
  }
  const rowAcc: string[] = [];
  let weightedAgree = 0;
  for (const c of categoryOrder) {
    const agreeCount = matrix[c][c];
    const totalCount = aiCounts[c] || 0;
    weightedAgree += agreeCount;
    rowAcc.push(
      `<tr><td class="cat-lb">${c}</td><td>${agreeCount}/${totalCount}</td>` +
      `<td>${totalCount ? Math.round((agreeCount / totalCount) * 100) : 0}%</td>` +
      `<td class="mm">${matrix[c][categoryOrder[1]]}</td><td class="mm">${matrix[c][categoryOrder[2]]}</td>` +
      `<td class="mm">${matrix[c][categoryOrder[0]]}</td></tr>`
    );
  }
  const summaryBlock = `
<div class="summary">
  <table class="mat">
    <caption>Mismatch accuracy — AI routing = assumed human truth vs formula</caption>
    <thead><tr><th></th><th>agreement</th><th>acc</th><th>mis → ${categoryOrder[1]}</th><th>mis → ${categoryOrder[2]}</th><th>mis → ${categoryOrder[0]}</th></tr></thead>
    <tbody>
      ${rowAcc.join('\n')}
      <tr class="tot"><td class="cat-lb">total</td><td>${weightedAgree}/${total}</td>
        <td>${total ? Math.round((weightedAgree / total) * 100) : 0}%</td><td class="mm"></td><td class="mm"></td><td class="mm"></td></tr>
    </tbody>
  </table>
</div>`;

  const sections = categoryOrder
    .filter((c) => grouped.has(c))
    .map((c) => {
      const group = grouped.get(c)!;
      return `
<section class="cat-section" data-cat="${c}">
  <h2 class="cat-head cat-${c.toLowerCase()}">${c} <span class="cat-cnt">${group.length}</span></h2>
  <table class="main">
${group.map((g) => g.html).join('\n')}
  </table>
</section>`;
    })
    .join('\n');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>GLIE T1 Dataset Report (${total} rows)</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: #141414; color: #F5F1E8; margin: 0; padding: 20px; }
  h1 { color: #F5F1E8; font-size: 20px; }
  .stats { color: #9b9b9b; font-size: 13px; margin-bottom: 18px; }
  table.main { border-collapse: collapse; width: 100%; margin-bottom: 10px; }
  .main td { border: 1px solid #333; vertical-align: top; padding: 10px; }
  .test-row td { background: #1c2a41; }
  .photo-cell { width: 220px; text-align: center; }
  .photo { max-width: 210px; max-height: 280px; border-radius: 4px; }
  .noimg { color: #C81E2C; font-size: 12px; }
  .mono { font-family: Consolas, monospace; font-size: 11px; color: #bdbdbd; word-break: break-all; margin-bottom: 6px; }
  .badge { display: inline-block; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 3px; margin-right: 4px; }
  .train { background: #0F5C46; color: #fff; }
  .test { background: #B8912F; color: #141414; }
  .agree { background: #0F5C46; color: #fff; }
  .disagree { background: #C81E2C; color: #fff; }
  table.fields { border-collapse: collapse; margin-top: 6px; width: 100%; }
  .fields td { border: none; border-bottom: 1px solid #2a2a2a; padding: 3px 4px; font-size: 12px; }
  .fields td:first-child { color: #888; width: 140px; }
  .filters { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
  .fbtn { background: #222; color: #F5F1E8; border: 1px solid #444; border-radius: 6px;
          padding: 6px 14px; font-size: 12px; font-weight: 700; cursor: pointer; }
  .fbtn.active { background: #B8912F; color: #141414; border-color: #B8912F; }
  .fbtn .cnt { opacity: 0.7; font-weight: 400; }
  .cat-section { margin-bottom: 30px; }
  .cat-head { font-size: 15px; letter-spacing: 1px; padding: 8px 12px; border-radius: 5px; margin: 0 0 10px; color: #141414; }
  .cat-head .cat-cnt { opacity: 0.7; font-weight: 400; }
  .cat-resell  { background: #0F5C46; }
  .cat-upcycle { background: #B8912F; }
  .cat-recycle { background: #C81E2C; }
  table.mat { border-collapse: collapse; margin: 6px 0 18px; }
  table.mat th, table.mat td { border: 1px solid #333; padding: 6px 10px; font-size: 12px; text-align: center; }
  table.mat caption { text-align: left; font-size: 13px; color: #9b9b9b; margin-bottom: 6px; }
  table.mat th { color: #888; font-weight: 700; }
  .cat-lb { text-align: left !important; font-weight: 800; }
  td.mm { color: #C81E2C; }
  tr.tot td { font-weight: 800; background: #1a1a1a; }
</style>
</head>
<body>
<h1>GLIE T1 Dataset — photo + row report (assumed human = AI routing)</h1>
${summaryBlock}
<div class="stats">rows=${total} · images embedded=${withImage} · missing=${missing.length} ·
  formula/AI match=${agree}/${total} (${total ? Math.round((agree / total) * 100) : 0}%)</div>
<div class="filters">
  <button class="fbtn active" data-f="all">All <span class="cnt" id="cAll"></span></button>
  <button class="fbtn" data-f="RESELL">RESELL <span class="cnt" id="cRESELL"></span></button>
  <button class="fbtn" data-f="UPCYCLE">UPCYCLE <span class="cnt" id="cUPCYCLE"></span></button>
  <button class="fbtn" data-f="RECYCLE">RECYCLE <span class="cnt" id="cRECYCLE"></span></button>
  <button class="fbtn" data-f="mismatch">Mismatch only <span class="cnt" id="cMismatch"></span></button>
  <button class="fbtn" data-f="match">Match only <span class="cnt" id="cMatch"></span></button>
</div>
${sections}
<script>
  const trs = Array.from(document.querySelectorAll('tr[data-mismatch]'));
  const secs = Array.from(document.querySelectorAll('.cat-section'));
  const counts = { all: trs.length, mismatch: 0, match: 0, RESELL: 0, UPCYCLE: 0, RECYCLE: 0 };
  for (const r of trs) {
    const isMm = r.dataset.mismatch === '1';
    counts[isMm ? 'mismatch' : 'match']++;
    if (r.dataset.csv in counts) counts[r.dataset.csv]++;
  }
  for (const k of Object.keys(counts)) {
    const el = document.getElementById('c' + k);
    if (el) el.textContent = counts[k];
  }

  const buttons = Array.from(document.querySelectorAll('.fbtn'));
  function applyFilter(f) {
    for (const b of buttons) b.classList.toggle('active', b.dataset.f === f);
    for (const s of secs) {
      const cat = s.dataset.cat;
      let anyVisible = false;
      const rows = Array.from(s.querySelectorAll('tr[data-mismatch]'));
      for (const r of rows) {
        if (f === 'all') { r.style.display = ''; anyVisible = true; continue; }
        let show;
        if (f === 'mismatch') show = r.dataset.mismatch === '1';
        else if (f === 'match') show = r.dataset.mismatch === '0';
        else show = r.dataset.csv === f;
        r.style.display = show ? '' : 'none';
        if (show) anyVisible = true;
      }
      s.style.display = anyVisible ? '' : 'none';
    }
  }
  for (const b of buttons) b.addEventListener('click', () => applyFilter(b.dataset.f));
</script>
</body>
</html>`;

  fs.writeFileSync(OUT, html, 'utf-8');
  console.log(`Wrote ${total} rows → ${OUT}`);
  console.log(`Images embedded: ${withImage}, missing: ${missing.length}`);
  if (missing.length) console.log(`Missing: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ' …' : ''}`);
}

main();