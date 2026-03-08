import React, { useState, useRef, useEffect, useCallback } from 'react';

export default function DataTable({ detail, weekMondays, onFilteredChange }) {
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const tableRef = useRef(null);

  const keys = ['b', 'd', 't', 'n', 'p'];
  const headers = ['Lv.1', 'Dept', 'Team', 'Member', 'Product'];

  const filtered = search
    ? detail.filter((x) => x.n.toLowerCase().includes(search.toLowerCase()))
    : detail.slice();

  let sorted;
  if (sortCol !== null && sortCol < 5) {
    const key = keys[sortCol];
    sorted = [...filtered].sort((a, b) => {
      const va = (a[key] || '-').toLowerCase();
      const vb = (b[key] || '-').toLowerCase();
      return sortDir === 'asc'
        ? va < vb ? -1 : va > vb ? 1 : 0
        : va > vb ? -1 : va < vb ? 1 : 0;
    });
  } else {
    sorted = [...filtered].sort((a, b) => b.tot - a.tot);
  }

  const rows = sorted.slice(0, 500);

  const allWks = new Set();
  filtered.forEach((r) => Object.keys(r.wk).forEach((w) => allWks.add(w)));
  const weeks = Array.from(allWks).sort();

  const handleSort = (col) => {
    if (sortCol === col) {
      if (sortDir === 'asc') setSortDir('desc');
      else { setSortCol(null); setSortDir('asc'); }
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const handleSearch = useCallback(() => {
    // triggers re-render via state
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  useEffect(() => {
    if (onFilteredChange) onFilteredChange(filtered, search);
  }, [search, detail]); // eslint-disable-line react-hooks/exhaustive-deps

  // Column resize
  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;

    const ths = table.querySelectorAll('thead th');
    const cleanups = [];

    ths.forEach((th) => {
      const old = th.querySelector('.resize-handle');
      if (old) old.remove();

      const handle = document.createElement('div');
      handle.className = 'resize-handle';
      th.appendChild(handle);

      const onMouseDown = (e) => {
        e.preventDefault();
        const startX = e.pageX;
        const startW = th.offsetWidth;
        th.classList.add('resizing');

        const onMove = (ev) => {
          const diff = ev.pageX - startX;
          const newW = Math.max(40, startW + diff);
          th.style.width = newW + 'px';
          th.style.minWidth = newW + 'px';
          th.style.maxWidth = newW + 'px';
          const idx = Array.from(th.parentNode.children).indexOf(th);
          table.querySelectorAll('tbody tr').forEach((tr) => {
            const td = tr.children[idx];
            if (td) {
              td.style.width = newW + 'px';
              td.style.minWidth = newW + 'px';
              td.style.maxWidth = newW + 'px';
            }
          });
          updateStickyPositions(table);
          updateScrollbarOffset(table);
        };

        const onUp = () => {
          th.classList.remove('resizing');
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      };

      handle.addEventListener('mousedown', onMouseDown);
      cleanups.push(() => handle.removeEventListener('mousedown', onMouseDown));
    });

    // Set CSS variable for scrollbar track offset based on actual sticky columns width
    updateScrollbarOffset(table);

    return () => cleanups.forEach((fn) => fn());
  }, [rows, weeks]);

  return (
    <>
      <div className="search-row" style={{ marginBottom: 14 }}>
        <label>Member</label>
        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className="btn-go" style={{ marginLeft: 0 }} onClick={handleSearch}>
          Search
        </button>
      </div>

      <div className="tbl" ref={tableRef}>
        <div className="tbl-h">
          <h3>Raw Data</h3>
          <span className="cnt">{filtered.length} rows</span>
        </div>
        <div className="tbl-s">
          <table>
            <thead>
              <tr>
                {headers.map((h, i) => {
                  const icon = sortCol === i ? (sortDir === 'asc' ? '\u2191' : '\u2193') : '\u2195';
                  const cls = sortCol === i ? ' active' : '';
                  return (
                    <th key={h}>
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        {h}
                        <span className={`sort-btn${cls}`} onClick={() => handleSort(i)}>{icon}</span>
                      </span>
                    </th>
                  );
                })}
                {weeks.map((w) => (
                  <th key={w} style={{ textAlign: 'center', fontSize: '8.5px', padding: '6px 2px' }}>
                    {weekMondays[w] || w}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  <td>{r.b || '-'}</td>
                  <td>{r.d || '-'}</td>
                  <td>{r.t || '-'}</td>
                  <td style={{ fontWeight: 500 }}>{r.n}</td>
                  <td style={r.p === 'Non-product' ? { color: 'var(--td)' } : undefined}>{r.p}</td>
                  {weeks.map((w) => {
                    const v = r.wk[w];
                    return (
                      <td key={w} className={`wk-val${v ? '' : ' zero'}`}>
                        {v ? v.toFixed(1) : '-'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function updateStickyPositions(table) {
  const ths = table.querySelectorAll('thead th');
  let left = 0;
  for (let i = 0; i < 5 && i < ths.length; i++) {
    ths[i].style.left = left + 'px';
    table.querySelectorAll('tbody tr').forEach((tr) => {
      if (tr.children[i]) tr.children[i].style.left = left + 'px';
    });
    left += ths[i].offsetWidth;
  }
}

function updateScrollbarOffset(tblEl) {
  const ths = tblEl.querySelectorAll('thead th');
  let totalWidth = 0;
  for (let i = 0; i < 5 && i < ths.length; i++) {
    totalWidth += ths[i].offsetWidth;
  }
  const scrollContainer = tblEl.querySelector('.tbl-s');
  if (scrollContainer) {
    scrollContainer.style.setProperty('--sticky-width', totalWidth + 'px');
  }
}
