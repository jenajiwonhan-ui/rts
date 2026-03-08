import React, { useState, useCallback } from 'react';
import DataTable from './DataTable';
import PersonChart from './PersonChart';

export default function DetailsSection({ detail, weekMondays }) {
  const [filteredData, setFilteredData] = useState([]);
  const [searchText, setSearchText] = useState('');

  const handleFilteredChange = useCallback((filtered, search) => {
    setFilteredData(filtered);
    setSearchText(search);
  }, []);

  return (
    <div className="sec">
      <div className="sec-title">
        <span className="sec-num">2</span>Details
      </div>
      <PersonChart filtered={filteredData} search={searchText} weekMondays={weekMondays} />
      <DataTable detail={detail} weekMondays={weekMondays} onFilteredChange={handleFilteredChange} />
    </div>
  );
}
