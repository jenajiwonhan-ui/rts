import axios from 'axios';

const API_BASE_URL = '';
const API_ENDPOINT = process.env.REACT_APP_RTS_API_DOWNLOAD_END_POINT || '';
const API_KEY = process.env.REACT_APP_RTS_API_KEY || '';

/**
 * Get current ISO week number for a given date.
 */
function getCurrentIsoWeek(date = new Date()) {
  const jan4 = new Date(date.getFullYear(), 0, 4);
  const dow = jan4.getDay() || 7;
  const w01Monday = new Date(jan4);
  w01Monday.setDate(jan4.getDate() - (dow - 1));
  const diff = Math.floor((date - w01Monday) / (7 * 24 * 60 * 60 * 1000));
  return Math.max(1, diff + 1);
}

/**
 * Fetch weeks 1 through (current week + 1), 10 concurrent requests at a time.
 */
export async function fetchAllWeeks(year = 2026) {
  const maxWeek = Math.min(getCurrentIsoWeek() + 1, 52);
  const weeks = Array.from({ length: maxWeek }, (_, i) => i + 1);
  console.log(`[RTS API] fetching weeks 1-${maxWeek}`);
  const headers = { ...(API_KEY ? { 'api-token': API_KEY } : {}) };

  const BATCH = 10;
  let allRecords = [];
  for (let i = 0; i < weeks.length; i += BATCH) {
    const batch = weeks.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map((w) =>
        axios
          .get(`${API_BASE_URL}${API_ENDPOINT}?year=${year}&week=${w}`, { headers })
          .then((res) => {
            const data = res.data?.data || (Array.isArray(res.data) ? res.data : []);
            return data.map((r) => ({ ...r, year, week: r.week ?? w }));
          })
          .catch((err) => {
            console.warn(`[RTS API] week ${w} failed:`, err.message);
            return [];
          })
      )
    );
    allRecords = allRecords.concat(results.flat());
  }

  console.log('[RTS API] total records:', allRecords.length);
  if (allRecords.length > 0) console.log('[RTS API] sample record:', JSON.stringify(allRecords[0]).slice(0, 300));
  return allRecords;
}

/* ── helpers: ISO week → dates ── */

function isoWeekMonday(year, week) {
  // Jan 4 is always in ISO week 1
  const jan4 = new Date(year, 0, 4);
  const dow = jan4.getDay() || 7; // Mon=1..Sun=7
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - (dow - 1));
  const monday = new Date(week1Monday);
  monday.setDate(week1Monday.getDate() + (week - 1) * 7);
  return monday;
}

function pad2(n) { return String(n).padStart(2, '0'); }

function weekCode(year, week) {
  return `${year}W${pad2(week)}`;
}

function mondayLabel(date) {
  const y = String(date.getFullYear()).slice(2);
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `'${y}.${m}.${d}`;
}

function weekToYm(year, week) {
  const monday = isoWeekMonday(year, week);
  // Majority days rule: count which month owns 4+ of the 7 days (Mon~Sun)
  const count = {};
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const key = `${day.getFullYear()}-${pad2(day.getMonth() + 1)}`;
    count[key] = (count[key] || 0) + 1;
  }
  // Pick the month with the most days
  let best = null;
  let bestN = 0;
  Object.entries(count).forEach(([ym, n]) => {
    if (n > bestN) { best = ym; bestN = n; }
  });
  return best;
}

/* ── orgLinePath parsing ── */

const LV1 = [
  ['East Publishing Services Div.', 'EPS'],
  ['NA Publishing Services Div.', 'NAPS'],
  ['West Publishing Services Dept', 'WPS'],
  ['Publishing Services Management Div.', 'PSM'],
  ['Global Creative Div.', 'GCD'],
];

function getLv1(orgPath) {
  if (!orgPath) return { code: null, name: null };
  for (const [fullName, code] of LV1) {
    if (orgPath.includes(fullName)) return { code, name: fullName };
  }
  return { code: null, name: null };
}

function classify(levelName) {
  const name = levelName.trim();
  if (!name || name === '.') return { tag: null, name };
  if (name.includes('Dept')) return { tag: 'D', name };
  if (name.includes('Team')) return { tag: 'T', name };
  if (name.includes('Part')) return { tag: 'P', name };
  return { tag: '?', name };
}

function parseOrgFull(orgPath, lv1Name, lv1Code) {
  if (!orgPath || !lv1Name) return { dept: '-', team: '-', part: '-' };

  const i = orgPath.indexOf(lv1Name) + lv1Name.length;
  let tail = orgPath.slice(i).trim();
  if (tail.startsWith('>')) tail = tail.slice(1).trim();

  const levels = tail.split('>').map((x) => x.trim()).filter((x) => x && x !== '.');

  let dept = '-', team = '-', part = '-';
  for (const lv of levels) {
    const c = classify(lv);
    if (c.tag === 'D') dept = c.name;
    else if (c.tag === 'T') team = c.name;
    else if (c.tag === 'P') part = c.name;
  }

  // WPS special rule: flatten Dept layer
  if (lv1Code === 'WPS') {
    if (team !== '-') {
      dept = '-';
    } else if (dept !== '-') {
      team = dept.replace(/ Dept\./g, '').replace(/ Dept/g, '').trim() + ' Team';
      dept = '-';
    }
  }

  return { dept, team, part };
}

/* ── transform API records → rawdata.json format ── */

export function transformApiData(records) {
  const year = records.length > 0 ? records[0].year : 2026;

  // Build week_mondays
  const weekMondays = {};
  const weeksInData = new Set();
  records.forEach((r) => weeksInData.add(r.week));
  for (let w = 1; w <= 52; w++) {
    const wc = weekCode(year, w);
    weekMondays[wc] = mondayLabel(isoWeekMonday(year, w));
  }

  // Group records: key = name + product + ym + dept + team
  const detailMap = {};
  const productSet = new Set();
  const ymSet = new Set();
  const orgTree = {}; // { lv1Code: { dept: [teams] } }

  records.forEach((r) => {
    // Filter: 주직 only (primaryPos=1), skip 겸직 (primaryPos=0)
    if (r.primaryPos !== undefined && r.primaryPos !== 1) return;

    // Identify Lv.1
    const { code: lv1Code, name: lv1Name } = getLv1(r.orgLinePath);
    if (!lv1Code) return; // Not in target orgs

    const ym = weekToYm(r.year, r.week);
    const wc = weekCode(r.year, r.week);
    const { dept, team, part } = parseOrgFull(r.orgLinePath, lv1Name, lv1Code);
    const name = r.displayName || 'Unknown';
    const product = r.productName || 'Non-product';

    productSet.add(product);
    ymSet.add(ym);

    // Build org_tree (display tree): lv1 → dept → [teams]
    if (!orgTree[lv1Code]) orgTree[lv1Code] = {};
    if (!orgTree[lv1Code][dept]) orgTree[lv1Code][dept] = [];
    if (team !== '-' && !orgTree[lv1Code][dept].includes(team)) {
      orgTree[lv1Code][dept].push(team);
    }

    // Build detail record
    const detailKey = `${name}|||${product}|||${ym}|||${lv1Code}|||${dept}|||${team}`;
    if (!detailMap[detailKey]) {
      detailMap[detailKey] = {
        n: name,
        p: product,
        ym,
        b: lv1Code,
        d: dept,
        t: team,
        pt: part,
        wk: {},
        tot: 0,
      };
    }
    const rate = r.participationRate || 0;
    detailMap[detailKey].wk[wc] = (detailMap[detailKey].wk[wc] || 0) + rate;
    detailMap[detailKey].tot += rate;
  });

  // Sort org_tree teams
  Object.keys(orgTree).forEach((b) => {
    Object.keys(orgTree[b]).forEach((d) => {
      orgTree[b][d].sort();
    });
  });

  const detail = Object.values(detailMap);
  const ymList = Array.from(ymSet).sort();
  const products = Array.from(productSet).sort();
  console.log('[RTS transform] ymList:', ymList, 'products:', products.length, 'orgTree keys:', Object.keys(orgTree), 'detail count:', detail.length);

  // Build product_colors (assign from palette)
  const PC = [
    '#7c6dd8','#4ecdc4','#f0c75e','#f78da7','#45b7c5',
    '#e8856c','#5a9fd4','#7cb5e8','#f5d76e','#d980b0',
    '#8cc5f0','#a8a0d6','#f5b79e','#8cd9d5','#8e9aaf',
    '#d4605b','#7db87a','#f2c14e','#c27a8e','#7ec8c8',
  ];
  const productColors = {};
  products.forEach((p, i) => {
    productColors[p] = PC[i % PC.length];
  });

  return {
    filters: { ym_list: ymList, products },
    org_tree: orgTree,
    product_colors: productColors,
    detail,
    week_mondays: weekMondays,
  };
}
