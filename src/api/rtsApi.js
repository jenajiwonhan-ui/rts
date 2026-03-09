import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_RTS_API_BASE_URL || '';
const API_ENDPOINT = process.env.REACT_APP_RTS_API_DOWNLOAD_END_POINT || '';
const API_KEY = process.env.REACT_APP_RTS_API_KEY || '';

/**
 * Fetch all 52 weeks in a single request.
 * GET {BASE_URL}{ENDPOINT}?year=2026&week=1&week=2&...&week=52
 */
export async function fetchAllWeeks(year = 2026) {
  const weeks = Array.from({ length: 52 }, (_, i) => i + 1);
  const weekParams = weeks.map((w) => `week=${w}`).join('&');
  const url = `${API_BASE_URL}${API_ENDPOINT}?year=${year}&${weekParams}`;
  console.log('2020dd2', API_KEY);
  const res = await axios.get(url, {
    headers: {
      ...(API_KEY ? { 'api-token': API_KEY } : {}),
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  const records = res.data?.data || [];
  return records.map((r) => ({ ...r, year }));
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

function parseOrgPath(orgLinePath, orgName) {
  if (!orgLinePath) return { b: orgName || 'Unknown', d: '-', t: '-' };
  const parts = orgLinePath.split('>').map((s) => s.trim());

  // Skip common prefix: "KRAFTON HQ" and the second level (e.g. "KRAFTON Publisher")
  // Adjust skip count based on actual data
  let skipCount = 0;
  if (parts[0] === 'KRAFTON HQ') skipCount = 1;
  if (parts.length > 1 && parts[1].includes('Publisher')) skipCount = 2;
  if (parts.length > 1 && parts[1].includes('Platform')) skipCount = 2;

  const orgParts = parts.slice(skipCount);

  if (orgParts.length === 0) return { b: orgName || 'Unknown', d: '-', t: '-' };
  if (orgParts.length === 1) return { b: orgParts[0], d: '-', t: '-' };
  if (orgParts.length === 2) return { b: orgParts[0], d: orgParts[1], t: '-' };
  // 3+ parts: first is division, second is dept, last is team
  return { b: orgParts[0], d: orgParts[1], t: orgParts[orgParts.length - 1] };
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

  // Group records: key = name + product + ym
  const detailMap = {};
  const productSet = new Set();
  const ymSet = new Set();
  const orgTree = {};

  records.forEach((r) => {
    const ym = weekToYm(r.year, r.week);
    const wc = weekCode(r.year, r.week);
    const { b, d, t } = parseOrgPath(r.orgLinePath, r.orgName);
    const name = r.displayName || 'Unknown';
    const product = r.productName || 'Non-product';

    productSet.add(product);
    ymSet.add(ym);

    // Build org_tree: b → d → [teams]
    if (!orgTree[b]) orgTree[b] = {};
    const dKey = d;
    if (!orgTree[b][dKey]) orgTree[b][dKey] = [];
    if (t !== '-' && !orgTree[b][dKey].includes(t)) {
      orgTree[b][dKey].push(t);
    }

    // Build detail record
    const detailKey = `${name}|||${product}|||${ym}|||${b}|||${d}|||${t}`;
    if (!detailMap[detailKey]) {
      detailMap[detailKey] = {
        n: name,
        p: product,
        ym,
        b,
        d: d === '-' ? '-' : d,
        t: t === '-' ? '-' : t,
        pt: r.orgName || '',
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
