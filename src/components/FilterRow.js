import React from 'react';
import MultiSelect from './MultiSelect';
import { ymLabel, sorted } from '../utils/helpers';

export default function FilterRow({
  ymList, fromYm, toYm, onFromChange, onToChange,
  orgTree, detail,
  selLv1, selDept, selTeam, selProd,
  onLv1Change, onDeptChange, onTeamChange, onProdChange,
  products, onSearch,
}) {
  const lv1Items = sorted(new Set(Object.keys(orgTree)));

  // Dept options based on selected Lv1
  const activeLv1 = selLv1.size === lv1Items.length ? lv1Items : Array.from(selLv1);
  const deptSet = new Set();
  let hasDirect = false;
  activeLv1.forEach((lv) => {
    if (!orgTree[lv]) return;
    Object.keys(orgTree[lv]).forEach((d) => {
      if (d === "-") { if (orgTree[lv][d].length > 0) hasDirect = true; }
      else deptSet.add(d);
    });
  });
  const deptItems = sorted(deptSet);
  if (hasDirect) deptItems.unshift("(Direct)");

  // Team options based on selected Lv1 + Dept
  const activeDept = selDept.size === deptItems.length ? null : selDept;
  const teamSet = new Set();
  let hasDeptDirect = false;
  activeLv1.forEach((lv) => {
    if (!orgTree[lv]) return;
    Object.keys(orgTree[lv]).forEach((d) => {
      if (activeDept) {
        if (d === "-" && !activeDept.has("(Direct)")) return;
        if (d !== "-" && !activeDept.has(d)) return;
      }
      if (d !== "-") {
        const hasTeamDash = detail.some((r) => r.b === lv && r.d === d && r.t === "-");
        if (hasTeamDash) hasDeptDirect = true;
      }
      orgTree[lv][d].forEach((t) => { if (t !== "-") teamSet.add(t); });
    });
  });
  const teamItems = sorted(teamSet);
  if (hasDeptDirect) teamItems.unshift("(Direct)");

  return (
    <div className="filter-row">
      <span className="frl">Period</span>
      <select className="fi" value={fromYm} onChange={(e) => onFromChange(e.target.value)}>
        {ymList.map((ym) => <option key={ym} value={ym}>{ymLabel(ym)}</option>)}
      </select>
      <span className="sep">~</span>
      <select className="fi" value={toYm} onChange={(e) => onToChange(e.target.value)}>
        {ymList.map((ym) => <option key={ym} value={ym}>{ymLabel(ym)}</option>)}
      </select>

      <span className="frl" style={{ marginLeft: 6 }}>Org</span>
      <MultiSelect
        id="ms-lv1"
        items={lv1Items}
        selected={selLv1}
        onChange={onLv1Change}
        label="All Lv.1"
      />
      <MultiSelect
        id="ms-dept"
        items={deptItems}
        selected={selDept}
        onChange={onDeptChange}
        label="All Dept"
      />
      <MultiSelect
        id="ms-team"
        items={teamItems}
        selected={selTeam}
        onChange={onTeamChange}
        label="All Team"
      />

      <span className="frl" style={{ marginLeft: 6 }}>Product</span>
      <MultiSelect
        id="ms-prod"
        items={products}
        selected={selProd}
        onChange={onProdChange}
        label="All"
      />

      <button className="btn-go" onClick={onSearch}>Search</button>
    </div>
  );
}
