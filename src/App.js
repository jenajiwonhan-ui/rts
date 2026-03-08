import React, { useState, useMemo, useCallback, useEffect } from 'react';
import './App.css';
import Header from './components/Header';
import FilterRow from './components/FilterRow';
import ChartBlock from './components/ChartBlock';
import DetailsSection from './components/DetailsSection';
import { sorted, getFilteredData } from './utils/helpers';
import { fetchAllWeeks, transformApiData } from './api/rtsApi';

// Pre-compute initial item lists so we can initialize state with full sets
function calcDeptItemsStatic(orgTree, lv1Items, activeLv1Set) {
  const active = activeLv1Set.size === lv1Items.length ? lv1Items : Array.from(activeLv1Set);
  const deptSet = new Set();
  let hasDirect = false;
  active.forEach((lv) => {
    if (!orgTree[lv]) return;
    Object.keys(orgTree[lv]).forEach((d) => {
      if (d === '-') { if (orgTree[lv][d].length > 0) hasDirect = true; }
      else deptSet.add(d);
    });
  });
  const items = sorted(deptSet);
  if (hasDirect) items.unshift('(Direct)');
  return items;
}

function calcTeamItemsStatic(orgTree, detail, lv1Items, activeLv1Set, activeDeptSet, deptItemsList) {
  const activeLv1 = activeLv1Set.size === lv1Items.length ? lv1Items : Array.from(activeLv1Set);
  const isAllDept = activeDeptSet.size === deptItemsList.length;
  const teamSet = new Set();
  let hasDeptDirect = false;
  activeLv1.forEach((lv) => {
    if (!orgTree[lv]) return;
    Object.keys(orgTree[lv]).forEach((d) => {
      if (!isAllDept) {
        if (d === '-' && !activeDeptSet.has('(Direct)')) return;
        if (d !== '-' && !activeDeptSet.has(d)) return;
      }
      if (d !== '-') {
        const hasTeamDash = detail.some((r) => r.b === lv && r.d === d && r.t === '-');
        if (hasTeamDash) hasDeptDirect = true;
      }
      orgTree[lv][d].forEach((t) => { if (t !== '-') teamSet.add(t); });
    });
  });
  const items = sorted(teamSet);
  if (hasDeptDirect) items.unshift('(Direct)');
  return items;
}

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [loadProgress, setLoadProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        setLoading(true);
        setLoadError(null);
        setLoadProgress(0);
        const records = await fetchAllWeeks(2026);
        if (cancelled) return;
        setLoadProgress(100);
        const transformed = transformApiData(records);
        setData(transformed);
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'Failed to load data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div>
        <Header />
        <div className="content">
          <div className="loading-container">
            <div className="loading-spinner" />
            <p>Loading data from API... {loadProgress > 0 ? `${loadProgress}%` : ''}</p>
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <Header />
        <div className="content">
          <div className="loading-container error">
            <p>Error: {loadError}</p>
            <button onClick={() => window.location.reload()}>Retry</button>
          </div>
        </div>
      </div>
    );
  }

  return <Dashboard data={data} />;
}

function Dashboard({ data }) {
  const ymList = data.filters.ym_list;
  const products = data.filters.products;
  const orgTree = data.org_tree;
  const weekMondays = data.week_mondays;
  const productColors = data.product_colors;

  const [fromYm, setFromYm] = useState(ymList[0]);
  const [toYm, setToYm] = useState(ymList[ymList.length - 1]);

  const lv1Items = useMemo(() => sorted(new Set(Object.keys(orgTree))), [orgTree]);

  const [selLv1, setSelLv1] = useState(() => new Set(lv1Items));
  const [selDept, setSelDept] = useState(() => {
    const items = calcDeptItemsStatic(orgTree, lv1Items, new Set(lv1Items));
    return new Set(items);
  });
  const [selTeam, setSelTeam] = useState(() => {
    const dItems = calcDeptItemsStatic(orgTree, lv1Items, new Set(lv1Items));
    const tItems = calcTeamItemsStatic(orgTree, data.detail, lv1Items, new Set(lv1Items), new Set(dItems), dItems);
    return new Set(tItems);
  });
  const [selProd, setSelProd] = useState(() => new Set(products));

  const deptItems = useMemo(
    () => calcDeptItemsStatic(orgTree, lv1Items, selLv1),
    [orgTree, lv1Items, selLv1]
  );
  const teamItems = useMemo(
    () => calcTeamItemsStatic(orgTree, data.detail, lv1Items, selLv1, selDept, deptItems),
    [orgTree, data.detail, lv1Items, selLv1, selDept, deptItems]
  );

  const handleLv1Change = useCallback((next) => {
    setSelLv1(next);
    const newDeptItems = calcDeptItemsStatic(orgTree, lv1Items, next);
    setSelDept(new Set(newDeptItems));
    const newTeamItems = calcTeamItemsStatic(orgTree, data.detail, lv1Items, next, new Set(newDeptItems), newDeptItems);
    setSelTeam(new Set(newTeamItems));
  }, [orgTree, lv1Items, data.detail]);

  const handleDeptChange = useCallback((next) => {
    setSelDept(next);
    const newTeamItems = calcTeamItemsStatic(orgTree, data.detail, lv1Items, selLv1, next, deptItems);
    setSelTeam(new Set(newTeamItems));
  }, [orgTree, data.detail, lv1Items, selLv1, deptItems]);

  const [queryResult, setQueryResult] = useState(null);

  const handleSearch = useCallback(() => {
    const range = ymList.filter((ym) => ym >= fromYm && ym <= toYm);
    const sLv1 = selLv1.size === lv1Items.length ? null : selLv1;
    const sDept = selDept.size === deptItems.length ? null : selDept;
    const sTeam = selTeam.size === teamItems.length ? null : selTeam;
    const sProd = selProd.size === products.length ? null : selProd;

    const filtered = getFilteredData(data, range, sLv1, sDept, sTeam, sProd);
    setQueryResult({ detail: filtered, range });
  }, [ymList, fromYm, toYm, selLv1, lv1Items, selDept, deptItems, selTeam, teamItems, selProd, products, data]);

  return (
    <div>
      <Header />
      <div className="content">
        <FilterRow
          ymList={ymList}
          fromYm={fromYm}
          toYm={toYm}
          onFromChange={setFromYm}
          onToChange={setToYm}
          orgTree={orgTree}
          detail={data.detail}
          selLv1={selLv1}
          selDept={selDept}
          selTeam={selTeam}
          selProd={selProd}
          onLv1Change={handleLv1Change}
          onDeptChange={handleDeptChange}
          onTeamChange={setSelTeam}
          onProdChange={setSelProd}
          products={products}
          onSearch={handleSearch}
        />

        <div className="sec">
          <div className="sec-title">
            <span className="sec-num">1</span>Overview
          </div>
          {queryResult ? (
            <ChartBlock
              detail={queryResult.detail}
              range={queryResult.range}
              weekMondays={weekMondays}
              productColors={productColors}
            />
          ) : (
            <div className="placeholder">Please set filters and click [Search]</div>
          )}
        </div>

        {queryResult && (
          <DetailsSection
            detail={queryResult.detail}
            weekMondays={weekMondays}
          />
        )}
      </div>
    </div>
  );
}

export default App;
