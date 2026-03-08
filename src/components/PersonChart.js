import React, { useRef, useEffect } from 'react';
import { Chart, registerables } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { buildPersonData, buildPersonChartData } from '../utils/helpers';

Chart.register(...registerables, ChartDataLabels);

export default function PersonChart({ filtered, search, weekMondays }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    if (!search || search.length < 1 || !filtered || filtered.length === 0) return;

    const people = buildPersonData(filtered);
    const names = Object.keys(people);
    if (names.length === 0 || names.length > 5) return;

    const name = names[0];
    const { weeks, allP, pCol, wd } = buildPersonChartData(people, name);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const datasets = allP.map((p) => ({
      label: p,
      data: weeks.map((w) => (wd[w] && wd[w][p]) || 0),
      backgroundColor: pCol[p] ? pCol[p].bg : '#ccc',
      borderWidth: 0, barPercentage: 0.7, categoryPercentage: 0.8,
    }));

    const rc = datasets.map((ds) => ds.data.slice());

    // Normalize to 100%
    weeks.forEach((_, i) => {
      let t = 0;
      datasets.forEach((ds) => { t += ds.data[i]; });
      if (t > 0) datasets.forEach((ds) => { ds.data[i] = ds.data[i] / t * 100; });
    });

    chartRef.current = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: weeks.map((w) => weekMondays[w] || w),
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          datalabels: { display: false },
          tooltip: {
            callbacks: {
              label(ctx) {
                const raw = rc[ctx.datasetIndex][ctx.dataIndex];
                return ' ' + ctx.dataset.label + ': ' + raw.toFixed(1) + ' (' + Math.round(ctx.parsed.y) + '%)';
              },
            },
          },
        },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 60 } },
          y: {
            stacked: true, max: 100,
            grid: { color: '#eff0f5' },
            ticks: { callback: (v) => v + '%' },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    };
  }, [filtered, search, weekMondays]);

  if (!search || search.length < 1 || !filtered || filtered.length === 0) return null;

  const people = buildPersonData(filtered);
  const names = Object.keys(people);
  if (names.length === 0 || names.length > 5) return null;

  const name = names[0];
  const { allP, pCol } = buildPersonChartData(people, name);

  return (
    <div className="person-chart show">
      <div className="person-name">{name}</div>
      <div className="person-ch-wrap">
        <canvas ref={canvasRef} />
      </div>
      <div className="person-legend">
        {allP.map((p) => (
          <span key={p} className="sl-item">
            <span className="sl-dot" style={{ background: pCol[p] ? pCol[p].bg : '#ccc' }} />
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}
