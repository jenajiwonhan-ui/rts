import React, { useState, useRef, useEffect, useCallback } from 'react';

export default function MultiSelect({ id, items, selected, onChange, label }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const filtered = items.filter((it) =>
    it.toLowerCase().includes(search.toLowerCase())
  );

  const allSelected = filtered.length > 0 && filtered.every((it) => selected.has(it));

  const toggleItem = useCallback((v) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v); else next.add(v);
    onChange(next);
  }, [selected, onChange]);

  const toggleAll = useCallback(() => {
    const next = new Set(selected);
    if (allSelected) {
      filtered.forEach((it) => next.delete(it));
    } else {
      if (search) {
        // When searching, clear all and add only visible
        next.clear();
        filtered.forEach((it) => next.add(it));
      } else {
        items.forEach((it) => next.add(it));
      }
    }
    onChange(next);
  }, [selected, onChange, allSelected, filtered, items, search]);

  const btnText = selected.size === items.length
    ? label
    : selected.size === 0
      ? 'None'
      : selected.size <= 2
        ? Array.from(selected).join(', ')
        : Array.from(selected)[0] + ' + ' + (selected.size - 1) + ' more';

  return (
    <div className="ms" ref={ref}>
      <div className="ms-btn" onClick={() => setOpen(!open)}>
        <span className="ms-l">{btnText}</span>
        <span className="arr">{'\u25BE'}</span>
      </div>
      {open && (
        <div className="ms-dd open">
          <div className="ms-search-wrap">
            <input
              className="ms-s"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="ms-list">
            <div className="ms-i" onClick={toggleAll}>
              <input type="checkbox" checked={allSelected} readOnly />
              <span style={{ fontWeight: 600 }}>
                {search ? `Select Searched (${filtered.length})` : 'Select All'}
              </span>
            </div>
            {filtered.map((it) => (
              <div key={it} className="ms-i" onClick={() => toggleItem(it)}>
                <input type="checkbox" checked={selected.has(it)} readOnly />
                <span>{it}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
