import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Chart, registerables } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { MM_NAMES } from '../utils/constants';
import {
  ymLabel, sorted, getWeeksPerMonth,
  buildProdColors, buildOrgColors, getOrgKey
} from '../utils/helpers';

Chart.register(...registerables, ChartDataLabels);

export default function ChartBlock({ detail, range, weekMondays, productColors }) {
  const barRef = useRef(null);
  const pieRef = useRef(null);
  const barChart = useRef(null);
  const pieChart = useRef(null);

  const [curTab, setCurTab] = useState('byProd');
  const [tmMode, setTmMode] = useState('monthly');
  const [orgDepth, setOrgDepth] = useState('l');

  const lastYm = range[range.length - 1];
  const ymLabelStr = MM_NAMES[parseInt(lastYm.split("-")[1]) - 1] + " '" + lastYm.split("-")[0].slice(2) + " Mix";

  const renderBar = useCallback(() => {
    if (barChart.current) barChart.current.destroy();
    const canvas = barRef.current;
    if (!canvas) return;

    if (curTab === 'byProd') {
      const info = buildProdColors(detail, productColors);
      const { cM, allP } = info;

      if (tmMode === 'monthly') {
        const wpm = getWeeksPerMonth(detail);
        const ymD = {};
        detail.forEach((d) => {
          if (!ymD[d.ym]) ymD[d.ym] = {};
          ymD[d.ym][d.p] = (ymD[d.ym][d.p] || 0) + d.tot;
        });
        Object.keys(ymD).forEach((ym) => {
          const nw = wpm[ym] || 1;
          Object.keys(ymD[ym]).forEach((k) => { ymD[ym][k] = ymD[ym][k] / nw; });
        });
        barChart.current = new Chart(canvas, {
          type: 'bar',
          data: {
            labels: range.map(ymLabel),
            datasets: allP.map((p) => ({
              label: p,
              data: range.map((ym) => (ymD[ym] && ymD[ym][p]) || 0),
              backgroundColor: cM[p] ? cM[p].bg : '#ccc',
              borderWidth: 0, barPercentage: 0.6, categoryPercentage: 0.75,
            })),
          },
          options: barOptions('M/M', 'm-m', allP.length),
        });
      } else {
        const wD = {};
        detail.forEach((d) => {
          Object.entries(d.wk).forEach(([w, v]) => {
            if (!wD[w]) wD[w] = {};
            wD[w][d.p] = (wD[w][d.p] || 0) + v;
          });
        });
        const weeks = sorted(new Set(Object.keys(wD)));
        barChart.current = new Chart(canvas, {
          type: 'bar',
          data: {
            labels: weeks.map((w) => weekMondays[w] || w),
            datasets: allP.map((p) => ({
              label: p,
              data: weeks.map((w) => (wD[w] && wD[w][p]) || 0),
              backgroundColor: cM[p] ? cM[p].bg : '#ccc',
              borderWidth: 0, barPercentage: 0.75, categoryPercentage: 0.85,
            })),
          },
          options: barOptions('Weekly RTS', 'w-w', allP.length, weeks.length),
        });
      }
      return allP.map((p) => ({ name: p, color: cM[p] ? cM[p].bg : '#ccc' }));
    } else {
      const info = buildOrgColors(detail, orgDepth);
      const { cM, allO } = info;

      if (tmMode === 'monthly') {
        const wpm = getWeeksPerMonth(detail);
        const ymO = {};
        detail.forEach((d) => {
          const k = getOrgKey(d, orgDepth);
          if (!ymO[d.ym]) ymO[d.ym] = {};
          ymO[d.ym][k] = (ymO[d.ym][k] || 0) + d.tot;
        });
        Object.keys(ymO).forEach((ym) => {
          const nw = wpm[ym] || 1;
          Object.keys(ymO[ym]).forEach((k) => { ymO[ym][k] = ymO[ym][k] / nw; });
        });
        barChart.current = new Chart(canvas, {
          type: 'bar',
          data: {
            labels: range.map(ymLabel),
            datasets: allO.map((o) => ({
              label: o,
              data: range.map((ym) => (ymO[ym] && ymO[ym][o]) || 0),
              backgroundColor: cM[o] ? cM[o].bg : '#ccc',
              borderWidth: 0, barPercentage: 0.6, categoryPercentage: 0.75,
            })),
          },
          options: barOptions('M/M', 'm-m', allO.length),
        });
      } else {
        const wO = {};
        detail.forEach((d) => {
          const k = getOrgKey(d, orgDepth);
          Object.entries(d.wk).forEach(([w, v]) => {
            if (!wO[w]) wO[w] = {};
            wO[w][k] = (wO[w][k] || 0) + v;
          });
        });
        const weeks = sorted(new Set(Object.keys(wO)));
        barChart.current = new Chart(canvas, {
          type: 'bar',
          data: {
            labels: weeks.map((w) => weekMondays[w] || w),
            datasets: allO.map((o) => ({
              label: o,
              data: weeks.map((w) => (wO[w] && wO[w][o]) || 0),
              backgroundColor: cM[o] ? cM[o].bg : '#ccc',
              borderWidth: 0, barPercentage: 0.75, categoryPercentage: 0.85,
            })),
          },
          options: barOptions('Weekly RTS', 'w-w', allO.length, weeks.length),
        });
      }
      return allO.map((o) => ({ name: o, color: cM[o] ? cM[o].bg : '#ccc' }));
    }
  }, [detail, range, curTab, tmMode, orgDepth, weekMondays, productColors]);

  const renderPie = useCallback(() => {
    if (pieChart.current) pieChart.current.destroy();
    const canvas = pieRef.current;
    if (!canvas) return;

    const lastDetail = detail.filter((d) => d.ym === lastYm);
    const wpm = getWeeksPerMonth(lastDetail);
    const nw = wpm[lastYm] || 1;

    if (curTab === 'byProd') {
      const info = buildProdColors(detail, productColors);
      const { cM } = info;
      const lpm = {};
      lastDetail.forEach((d) => { lpm[d.p] = (lpm[d.p] || 0) + d.tot; });
      Object.keys(lpm).forEach((k) => { lpm[k] = lpm[k] / nw; });
      const entries = Object.entries(lpm).sort((a, b) => {
        if (a[0] === "Non-product") return 1;
        if (b[0] === "Non-product") return -1;
        return b[1] - a[1];
      });
      pieChart.current = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: entries.map((e) => e[0]),
          datasets: [{ data: entries.map((e) => e[1]), backgroundColor: entries.map((e) => cM[e[0]] ? cM[e[0]].bg : '#ccc'), borderWidth: 0 }],
        },
        options: pieOptions(),
      });
    } else {
      const info = buildOrgColors(detail, orgDepth);
      const { cM } = info;
      const lom = {};
      lastDetail.forEach((d) => {
        const k = getOrgKey(d, orgDepth);
        lom[k] = (lom[k] || 0) + d.tot;
      });
      Object.keys(lom).forEach((k) => { lom[k] = lom[k] / nw; });
      const entries = Object.entries(lom).sort((a, b) => b[1] - a[1]).slice(0, 15);
      pieChart.current = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: entries.map((e) => e[0]),
          datasets: [{ data: entries.map((e) => e[1]), backgroundColor: entries.map((e) => cM[e[0]] ? cM[e[0]].bg : '#ccc'), borderWidth: 0 }],
        },
        options: pieOptions(),
      });
    }
  }, [detail, lastYm, curTab, orgDepth, productColors]);

  const [legend, setLegend] = useState([]);

  useEffect(() => {
    const items = renderBar();
    if (items) setLegend(items);
    renderPie();
    return () => {
      if (barChart.current) barChart.current.destroy();
      if (pieChart.current) pieChart.current.destroy();
    };
  }, [renderBar, renderPie]);

  const handleTabClick = (tab) => {
    setCurTab(tab);
  };

  const hintText = curTab === 'byProd'
    ? "See where your team members are currently assigned."
    : "See which teams are supporting your product.";

  return (
    <div className="chart-block">
      <div className="tab-bar">
        <button
          className={`tab-btn ${curTab === 'byProd' ? 'on' : ''}`}
          onClick={() => handleTabClick('byProd')}
          title="See where your team members are currently assigned."
        >
          My Team's Resources
        </button>
        <button
          className={`tab-btn ${curTab === 'byOrg' ? 'on' : ''}`}
          onClick={() => handleTabClick('byOrg')}
          title="See which teams are supporting your product"
        >
          Contribution to My Product
          <span style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle', lineHeight: 1, visibility: curTab === 'byOrg' ? 'visible' : 'hidden' }}>
            <div className="depth-tgl">
              {[
                { v: 'l', label: 'Lv.1' },
                { v: 'd', label: 'Dept' },
                { v: 't', label: 'Team' },
              ].map((b) => (
                <button
                  key={b.v}
                  className={orgDepth === b.v ? 'on' : ''}
                  onClick={(e) => { e.stopPropagation(); setOrgDepth(b.v); }}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </span>
        </button>
        <div className="tab-right" />
      </div>

      <div style={{ padding: '8px 20px 0', fontSize: '11.5px', color: 'var(--td)' }}>
        {hintText}
      </div>

      <div className="chart-body">
        <div className="chart-row">
          <div className="chart-col-r" style={{ flex: '0 0 70%', paddingRight: 20, paddingLeft: 0, borderRight: '1px solid var(--border)', borderLeft: 'none' }}>
            <h3>
              Trend
              <div className="tgl" style={{ marginLeft: 'auto' }}>
                <button className={tmMode === 'monthly' ? 'on' : ''} onClick={() => setTmMode('monthly')}>Monthly</button>
                <button className={tmMode === 'weekly' ? 'on' : ''} onClick={() => setTmMode('weekly')}>Weekly</button>
              </div>
            </h3>
            <div className="ch-wrap"><canvas ref={barRef} /></div>
          </div>
          <div className="chart-col-l" style={{ flex: '0 0 30%', paddingLeft: 20, paddingRight: 0, borderRight: 'none' }}>
            <h3>{ymLabelStr}</h3>
            <div className="ch-wrap"><canvas ref={pieRef} /></div>
          </div>
        </div>
      </div>

      <div className="legend-bar">
        {legend.map((item) => (
          <span key={item.name} className="sl-item">
            <span className="sl-dot" style={{ background: item.color }} />
            {item.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function barOptions(yTitle, diffLabel, dsCount, weekCount) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      datalabels: {
        display: true,
        anchor(ctx) {
          return ctx.datasetIndex === ctx.chart.data.datasets.length - 1 ? 'end' : 'center';
        },
        align(ctx) {
          return ctx.datasetIndex === ctx.chart.data.datasets.length - 1 ? 'end' : 'center';
        },
        color(ctx) {
          return ctx.datasetIndex === ctx.chart.data.datasets.length - 1 ? '#5f6280' : '#fff';
        },
        font(ctx) {
          const isTop = ctx.datasetIndex === ctx.chart.data.datasets.length - 1;
          return isTop
            ? { size: weekCount ? 9 : 10, weight: 600, family: 'Pretendard' }
            : { size: weekCount ? 8 : 10, weight: 700, family: 'Pretendard' };
        },
        formatter(v, ctx) {
          const isTop = ctx.datasetIndex === ctx.chart.data.datasets.length - 1;
          let t = 0;
          ctx.chart.data.datasets.forEach((d) => { t += d.data[ctx.dataIndex]; });
          if (isTop) return t.toFixed(1);
          const yMax = ctx.chart.scales.y.max || t;
          return yMax > 0 && v / yMax * 100 >= 15 ? v.toFixed(1) : '';
        },
      },
      tooltip: {
        callbacks: {
          title: () => '',
          label(ctx) {
            let t = 0;
            ctx.chart.data.datasets.forEach((d) => { t += d.data[ctx.dataIndex]; });
            const pct = t > 0 ? Math.round(ctx.parsed.y / t * 100) : 0;
            const cur = ctx.parsed.y;
            const prev = ctx.dataIndex > 0 ? ctx.dataset.data[ctx.dataIndex - 1] : 0;
            const diff = cur - prev;
            const chg = ctx.dataIndex > 0 ? (diff >= 0 ? '+' : '') + diff.toFixed(1) + ' ' + diffLabel + ', ' : '';
            return [ctx.dataset.label, cur.toFixed(1) + (yTitle === 'M/M' ? ' MM' : '') + ' (' + chg + pct + '% total)'];
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true, grid: { display: false },
        ticks: weekCount ? { font: { size: weekCount > 20 ? 7 : 9 }, maxRotation: 60 } : {},
      },
      y: {
        stacked: true, grace: '15%',
        grid: { color: '#eff0f5' },
        title: { display: true, text: yTitle, font: { size: 11 } },
      },
    },
  };
}

function pieOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '50%',
    layout: { padding: 40 },
    plugins: {
      legend: { display: false },
      datalabels: {
        color: '#fff',
        font: { weight: 700, size: 10, family: 'Pretendard' },
        formatter(v, ctx) {
          const t = ctx.dataset.data.reduce((a, b) => a + b, 0);
          const p = t > 0 ? Math.round(v / t * 100) : 0;
          return p >= 3 ? p + '%' : '';
        },
        anchor: 'center', align: 'center',
      },
      tooltip: {
        callbacks: {
          title: () => '',
          label(ctx) {
            const v = ctx.parsed;
            const t = ctx.dataset.data.reduce((a, b) => a + b, 0);
            return [ctx.label, v.toFixed(1) + ' MM (' + Math.round(v / t * 100) + '%)'];
          },
        },
      },
    },
  };
}
