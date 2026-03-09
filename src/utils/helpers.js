import { PC, NPC, OOF } from './constants';

const FIXED_COLORS = {
  'Non-product': NPC,
  '휴가(Out of Office)': OOF,
};

export function ymLabel(ym) {
  const p = ym.split("-");
  return "'" + p[0].slice(2) + "." + p[1];
}

export function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function sorted(s) {
  return Array.from(s).sort();
}

export function getWeeksPerMonth(detail) {
  const wpm = {};
  detail.forEach((d) => {
    if (!wpm[d.ym]) wpm[d.ym] = new Set();
    Object.keys(d.wk).forEach((w) => wpm[d.ym].add(w));
  });
  const result = {};
  Object.keys(wpm).forEach((ym) => { result[ym] = wpm[ym].size || 1; });
  return result;
}

export function buildProdColors(detail, productColors) {
  const pm = {};
  detail.forEach((d) => { pm[d.p] = (pm[d.p] || 0) + d.tot; });
  const entries = Object.entries(pm).sort((a, b) => {
    if (a[0] === "Non-product") return 1;
    if (b[0] === "Non-product") return -1;
    return b[1] - a[1];
  });
  const pcMap = productColors || {};
  const cM = {};
  entries.forEach((e) => { cM[e[0]] = { bg: FIXED_COLORS[e[0]] || pcMap[e[0]] || PC[0] }; });
  const topP = entries.map((e) => e[0]);
  // Stack order (bottom→top): products → Non-product → 휴가/Out of Office
  const FIXED_ORDER = ['Non-product', '휴가(Out of Office)'];
  let allP = topP.filter((p) => !FIXED_ORDER.includes(p));
  FIXED_ORDER.forEach((fn) => { if (topP.includes(fn)) allP.push(fn); });
  return { cM, topP, allP };
}

export function buildOrgColors(detail, orgDepth) {
  const om = {};
  detail.forEach((d) => {
    const k = getOrgKey(d, orgDepth);
    om[k] = (om[k] || 0) + d.tot;
  });
  const entries = Object.entries(om).sort((a, b) => b[1] - a[1]);
  const cM = {};
  entries.forEach((e, i) => { cM[e[0]] = { bg: PC[i % PC.length] }; });
  const allO = entries.map((e) => e[0]);
  return { cM, allO };
}

export function getOrgKey(d, key) {
  if (key === "l") return d.b;
  if (key === "d") return d.d === "-" ? d.b + " (Direct)" : d.b + " / " + d.d;
  // key === "t"
  if (d.d === "-" && d.t === "-") return d.b + " (Direct)";
  if (d.d !== "-" && d.t === "-") return d.d + " (Direct)";
  if (d.d === "-") return d.b + " (Direct) / " + d.t;
  return d.d + " / " + d.t;
}

export function getFilteredData(data, range, sLv1, sDept, sTeam, sProd) {
  let d = data.detail.filter((r) => range.indexOf(r.ym) >= 0);
  if (sLv1) d = d.filter((r) => sLv1.has(r.b));
  if (sDept) d = d.filter((r) => {
    if (r.d === "-" && r.t === "-") return false;
    if (r.d === "-") return sDept.has("(Direct)");
    return sDept.has(r.d);
  });
  if (sTeam) d = d.filter((r) => {
    if (r.t === "-") {
      if (sTeam.has("(Direct)") && r.d !== "-") return true;
      return false;
    }
    return sTeam.has(r.t);
  });
  if (sProd) d = d.filter((r) => sProd.has(r.p));
  return d;
}

export function buildPersonData(filtered) {
  const people = {};
  filtered.forEach((r) => {
    if (!people[r.n]) people[r.n] = {};
    Object.entries(r.wk).forEach(([w, v]) => {
      if (!people[r.n][w]) people[r.n][w] = {};
      people[r.n][w][r.p] = (people[r.n][w][r.p] || 0) + v;
    });
  });
  return people;
}

export function buildPersonChartData(people, name) {
  const wd = people[name];
  const weeks = sorted(new Set(Object.keys(wd)));
  const prodMM = {};
  weeks.forEach((w) => {
    Object.entries(wd[w]).forEach(([p, v]) => { prodMM[p] = (prodMM[p] || 0) + v; });
  });
  const ps = Object.entries(prodMM).sort((a, b) => b[1] - a[1]);
  const pCol = {};
  ps.forEach((e, i) => {
    pCol[e[0]] = {
      bg: FIXED_COLORS[e[0]] || PC[i % PC.length]
    };
  });
  const allP = ps.map((e) => e[0]);
  return { weeks, allP, pCol, wd };
}
