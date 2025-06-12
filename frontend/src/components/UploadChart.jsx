import React, { useState, useEffect, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import ReactECharts from 'echarts-for-react';
import { makeHistogram, makeBoxplot } from '../utils/stats';

export default function UploadChart() {
  /* ───────── 상태 ───────── */
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState(null);
  const [rawData, setRawData] = useState([]);
  const [error, setError] = useState('');

  const [chartType, setChartType] = useState('bar');
  const [binCount, setBinCount] = useState(10);

  const [xAxis, setXAxis] = useState('');
  const [yAxis, setYAxis] = useState('');

  /* 필터 */
  const [filterVar, setFilterVar] = useState('');
  const [filterValues, setFilterValues] = useState([]);
  const [selectedVals, setSelectedVals] = useState(new Set());

  /* 그룹 */
  const [groupVar, setGroupVar] = useState('');

  /* 회귀선(산점도) */
  const [showReg, setShowReg] = useState(false);

  /* 사용자 라벨·옵션 */
  const [chartTitle, setChartTitle] = useState('');
  const [xLabelInput, setXLabelInput] = useState('');
  const [yLabelInput, setYLabelInput] = useState('');
  const [xRotate, setXRotate] = useState(0);
  const [barOrient, setBarOrient] = useState('vertical');

  const [chartOption, setChartOption] = useState(null);

  /* ───────── 업로드 ───────── */
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
        '.xlsx',
        '.xls',
      ],
    },
    multiple: false,
    onDrop: async (files) => {
      const fd = new FormData();
      fd.append('file', files[0]);
      try {
        const res = await axios.post('http://127.0.0.1:8000/api/upload/', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setRows(res.data.rows);
        setColumns(res.data.columns);
        setRawData(res.data.data || []);
        setError('');

        /* 컨트롤 초기화 */
        setXAxis('');
        setYAxis('');
        setFilterVar('');
        setFilterValues([]);
        setSelectedVals(new Set());
        setGroupVar('');
        setShowReg(false);
        setChartOption(null);
      } catch (e) {
        setError(e.response?.data?.file || '업로드 실패');
      }
    },
  });

  /* ───────── 필터 동기화 ───────── */
  useEffect(() => {
    if (filterVar) {
      setFilterValues([...new Set(rawData.map((r) => r[filterVar]))]);
      setSelectedVals(new Set());
    } else {
      setFilterValues([]);
      setSelectedVals(new Set());
    }
  }, [filterVar, rawData]);
  const toggleVal = (v) =>
    setSelectedVals((prev) => {
      const next = new Set(prev);
      next.has(v) ? next.delete(v) : next.add(v);
      return next;
    });

  /* ───────── 필터 적용 데이터 ───────── */
  const filteredData = useMemo(() => {
    if (filterVar && selectedVals.size > 0) {
      return rawData.filter((r) => selectedVals.has(r[filterVar]));
    }
    return rawData;
  }, [rawData, filterVar, selectedVals]);

  /* ───────── 유틸: 회귀선 ───────── */
  const fitLine = (pts) => {
    const n = pts.length;
    if (n < 2) return null;
    let sx = 0,
      sy = 0,
      sxy = 0,
      sx2 = 0;
    pts.forEach(([x, y]) => {
      sx += x;
      sy += y;
      sxy += x * y;
      sx2 += x * x;
    });
    const denom = n * sx2 - sx * sx;
    if (denom === 0) return null;
    const slope = (n * sxy - sx * sy) / denom;
    const intercept = (sy - slope * sx) / n;
    const xs = pts.map((p) => p[0]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    return [
      [minX, slope * minX + intercept],
      [maxX, slope * maxX + intercept],
    ];
  };

  /* ───────── 유틸: 상관 행렬 ───────── */
  const buildCorrMatrix = (numCols, data) => {
    const m = numCols.length;
    const sums = Array(m).fill(0);
    const sums2 = Array(m).fill(0);
    data.forEach((row) =>
      numCols.forEach((c, i) => {
        const v = row[c];
        sums[i] += v;
        sums2[i] += v * v;
      })
    );
    const n = data.length;
    const means = sums.map((s) => s / n);
    const corr = [];
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < m; j++) {
        let cov = 0;
        data.forEach((row) => {
          cov += (row[numCols[i]] - means[i]) * (row[numCols[j]] - means[j]);
        });
        const varI = sums2[i] - n * means[i] * means[i];
        const varJ = sums2[j] - n * means[j] * means[j];
        const denom = Math.sqrt(varI * varJ);
        const r = denom === 0 ? 0 : cov / denom;
        corr.push([i, j, +r.toFixed(2)]);
      }
    }
    return corr;
  };

  /* ───────── 차트 그리기 ───────── */
  const drawChart = () => {
    const data = filteredData;
    let option;

    const groups =
      groupVar && ['scatter', 'line', 'area'].includes(chartType)
        ? [...new Set(data.map((r) => r[groupVar]))]
        : [];

    /* ===== 0) 상관 히트맵 ===== */
    if (chartType === 'corr') {
      const numCols = columns.filter((c) => c.dtype !== 'object').map((c) => c.name);
      if (numCols.length < 2) {
        alert('수치형 변수가 2개 이상 필요합니다.');
        return;
      }
      const heat = buildCorrMatrix(numCols, data);
      option = {
        tooltip: { position: 'top' },
        grid: { containLabel: true },
        xAxis: {
          type: 'category',
          data: numCols,
          name: xLabelInput,
          nameLocation: 'middle',
          nameGap: 30,
        },
        yAxis: {
          type: 'category',
          data: numCols,
          name: yLabelInput,
          nameLocation: 'middle',
          nameGap: 40,
        },
        visualMap: {
          min: -1,
          max: 1,
          calculable: true,
          orient: 'horizontal',
          left: 'center',
          bottom: 0,
        },
        series: [
          {
            type: 'heatmap',
            data: heat,
            label: { show: true, formatter: (p) => p.data[2] },
            emphasis: { itemStyle: { borderColor: '#333', borderWidth: 1 } },
          },
        ],
      };
    }

    /* ===== 1) 파이·도넛·막대 ===== */
    else if (['pie', 'donut', 'bar'].includes(chartType)) {
      const counts = data.reduce((acc, r) => {
        const key = r[yAxis];
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      const cats = Object.keys(counts);
      const vals = cats.map((k) => counts[k]);

      if (['pie', 'donut'].includes(chartType)) {
        option = {
          tooltip: {},
          legend: { data: cats },
          series: [
            {
              type: 'pie',
              radius: chartType === 'donut' ? ['40%', '70%'] : '55%',
              data: cats.map((c) => ({ name: c, value: counts[c] })),
            },
          ],
        };
      } else {
        const vertical = barOrient === 'vertical';
        option = {
          xAxis: vertical
            ? {
                type: 'category',
                data: cats,
                name: xLabelInput,
                nameLocation: 'middle',
                nameGap: 30,
                axisLabel: { rotate: xRotate },
              }
            : { type: 'value', name: xLabelInput, nameLocation: 'middle', nameGap: 40 },
          yAxis: vertical
            ? { type: 'value', name: yLabelInput, nameLocation: 'middle', nameGap: 40 }
            : {
                type: 'category',
                data: cats,
                name: yLabelInput,
                nameLocation: 'middle',
                nameGap: 30,
                axisLabel: { rotate: xRotate },
              },
          series: [
            {
              type: 'bar',
              data: vertical ? vals : vals.map((v, i) => [v, cats[i]]),
            },
          ],
          tooltip: { trigger: 'axis' },
          grid: { containLabel: true },
          legend: { show: false },
        };
      }
    }

    /* ===== 2) 히스토그램 ===== */
    else if (chartType === 'histogram') {
      const { categories, data: hist } = makeHistogram(
        data.map((r) => r[yAxis]),
        binCount
      );
      option = {
        xAxis: {
          type: 'category',
          data: categories,
          name: xLabelInput,
          nameLocation: 'middle',
          nameGap: 30,
          axisLabel: { rotate: xRotate },
        },
        yAxis: {
          type: 'value',
          name: yLabelInput,
          nameLocation: 'middle',
          nameGap: 40,
        },
        series: [{ type: 'bar', data: hist }],
        tooltip: {},
        grid: { containLabel: true },
        legend: { show: false },
        dataZoom: [{ type: 'inside' }, { type: 'slider', height: 40 }],
      };
    }

    /* ===== 3) 박스플롯 ===== */
    else if (chartType === 'boxplot') {
      const box = makeBoxplot(data.map((r) => r[yAxis]));
      option = {
        xAxis: { type: 'category', data: [''], name: xLabelInput },
        yAxis: {
          type: 'value',
          name: yLabelInput,
          nameLocation: 'middle',
          nameGap: 40,
        },
        series: [{ type: 'boxplot', data: [box] }],
        tooltip: {},
        grid: { containLabel: true },
        legend: { show: false },
      };
    }

    /* ===== 4) 산점도 (회귀선) ===== */
    else if (chartType === 'scatter') {
      const makeAxis = (name, label) => ({
        type: 'value',
        name: label || name,
        nameLocation: 'middle',
        nameGap: 40,
        scale: true,
        min: (v) => v.min - (v.max - v.min) * 0.05,
        max: (v) => v.max + (v.max - v.min) * 0.05,
      });
      const scatterSeries = [];
      const regSeries = [];

      if (groups.length) {
        groups.forEach((g) => {
          const pts = data
            .filter((r) => r[groupVar] === g)
            .map((r) => [r[xAxis], r[yAxis]]);
          scatterSeries.push({ name: g, type: 'scatter', data: pts });
          if (showReg) {
            const line = fitLine(pts);
            if (line) {
              regSeries.push({
                name: `${g}-reg`,
                type: 'line',
                data: line,
                lineStyle: { type: 'dashed' },
                symbol: 'none',
                tooltip: { show: false },
              });
            }
          }
        });
      } else {
        const pts = data.map((r) => [r[xAxis], r[yAxis]]);
        scatterSeries.push({ type: 'scatter', data: pts });
        if (showReg) {
          const line = fitLine(pts);
          if (line) {
            regSeries.push({
              type: 'line',
              data: line,
              lineStyle: { type: 'dashed' },
              symbol: 'none',
              tooltip: { show: false },
            });
          }
        }
      }

      option = {
        xAxis: makeAxis(xAxis, xLabelInput),
        yAxis: makeAxis(yAxis, yLabelInput),
        grid: { containLabel: true },
        legend: { data: groups },
        tooltip: { trigger: 'item' },
        series: [...scatterSeries, ...regSeries],
      };
    }

    /* ===== 5) 선 & 영역 ===== */
    else if (['line', 'area'].includes(chartType)) {
      const xCats = [...new Set(data.map((r) => r[xAxis]))];
      const buildSeries = (name, filterFn) => ({
        name,
        type: 'line',
        areaStyle: chartType === 'area' ? {} : undefined,
        data: xCats.map(
          (x) =>
            data.find((r) => r[xAxis] === x && filterFn(r))?.[yAxis] ?? null
        ),
      });

      const series = groups.length
        ? groups.map((g) => buildSeries(g, (r) => r[groupVar] === g))
        : [buildSeries(yAxis, () => true)];

      option = {
        xAxis: {
          type: 'category',
          data: xCats,
          name: xLabelInput,
          nameLocation: 'middle',
          nameGap: 30,
          axisLabel: { rotate: xRotate },
        },
        yAxis: {
          type: 'value',
          name: yLabelInput,
          nameLocation: 'middle',
          nameGap: 40,
        },
        series,
        tooltip: { trigger: 'axis' },
        grid: { containLabel: true },
        legend: { show: groups.length > 0, data: groups },
        dataZoom: [{ type: 'inside' }, { type: 'slider', height: 40 }],
      };
    } else {
      alert('지원하지 않는 차트입니다.');
      return;
    }

    if (chartTitle) option.title = { text: chartTitle, left: 'center' };
    setChartOption(null);
    setTimeout(() => setChartOption(option), 0);
  };

  /* ───────── UI 헬퍼 ───────── */
  const needX = ['line', 'area', 'scatter'].includes(chartType);
  const categoricalCharts = ['pie', 'donut', 'bar'];
  const varLabel =
    categoricalCharts.includes(chartType) ? '변수(범주형)' : '변수(수치형)';
  const varOptions = columns.filter((c) =>
    categoricalCharts.includes(chartType)
      ? c.dtype === 'object'
      : c.dtype !== 'object'
  );
  const categoricalCols = columns.filter((c) => c.dtype === 'object');

  /* ───────── 렌더 ───────── */
  return (
    <div className="p-6 mx-auto max-w-none">
      <h1 className="text-3xl font-bold mb-6">Mini Tableau</h1>

      {/* 업로드 */}
      <div
        {...getRootProps()}
        className="border-2 border-dashed rounded-lg p-8 text-center hover:border-blue-500 cursor-pointer"
      >
        <input {...getInputProps()} />
        {isDragActive ? '드롭하세요' : 'CSV/Excel 파일 드래그 또는 클릭'}
      </div>

      {error && <p className="text-red-500 mt-2">{error}</p>}

      {rows !== null && (
        <div className="mt-4">
          <p>
            총 행 수: <strong>{rows}</strong>
          </p>
          <ul className="list-disc list-inside">
            {columns.map((c) => (
              <li key={c.name}>
                {c.name} ({c.dtype})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-8 mt-6">
        {/* ───── 컨트롤 ───── */}
        <div className="w-full lg:w-72 shrink-0 space-y-4">
          {/* 필터 */}
          {columns.length > 0 && (
            <div>
              <label className="block mb-1 font-medium">필터 변수(범주형)</label>
              <select
                className="w-full border p-1 rounded"
                value={filterVar}
                onChange={(e) => setFilterVar(e.target.value)}
              >
                <option value="">없음</option>
                {categoricalCols.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              {filterVar && filterValues.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {filterValues.map((v) => (
                    <button
                      key={v}
                      onClick={() => toggleVal(v)}
                      className={`px-2 py-1 border rounded ${
                        selectedVals.has(v)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 차트 유형 */}
          {columns.length > 0 && (
            <div>
              <label className="block mb-1 font-medium">차트 유형</label>
              <select
                className="border p-1 rounded w-full"
                value={chartType}
                onChange={(e) => setChartType(e.target.value)}
              >
                <option value="bar">막대</option>
                <option value="pie">파이</option>
                <option value="donut">도넛</option>
                <option value="histogram">히스토그램</option>
                <option value="boxplot">박스플롯</option>
                <option value="line">선 그래프</option>
                <option value="area">영역 그래프</option>
                <option value="scatter">산점도</option>
                <option value="corr">상관 히트맵</option>
              </select>
            </div>
          )}

          {/* 히스토그램 bin */}
          {chartType === 'histogram' && (
            <div>
              <label className="block mb-1">구간(bin) 개수</label>
              <input
                type="number"
                min={1}
                value={binCount}
                onChange={(e) => setBinCount(Number(e.target.value))}
                className="w-24 border p-1 rounded"
              />
            </div>
          )}

          {/* 변수 선택 */}
          {columns.length > 0 && chartType !== 'corr' && (
            <div className={needX ? 'grid grid-cols-2 gap-4' : ''}>
              {needX && (
                <div>
                  <label className="block mb-1">X축</label>
                  <select
                    className="w-full border p-1 rounded"
                    value={xAxis}
                    onChange={(e) => setXAxis(e.target.value)}
                  >
                    <option value="">선택</option>
                    {columns.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className={needX ? '' : 'mt-2'}>
                <label className="block mb-1">{varLabel}</label>
                <select
                  className="w-full border p-1 rounded"
                  value={yAxis}
                  onChange={(e) => setYAxis(e.target.value)}
                >
                  <option value="">선택</option>
                  {varOptions.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* 그룹 변수 */}
          {['scatter', 'line', 'area'].includes(chartType) && (
            <div>
              <label className="block mb-1 font-medium">
                그룹 변수(범주형·옵션)
              </label>
              <select
                className="w-full border p-1 rounded"
                value={groupVar}
                onChange={(e) => setGroupVar(e.target.value)}
              >
                <option value="">없음</option>
                {categoricalCols.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 회귀선 체크 */}
          {chartType === 'scatter' && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showReg}
                onChange={(e) => setShowReg(e.target.checked)}
              />
              회귀선 표시
            </label>
          )}

          {/* 사용자 라벨 및 옵션 */}
          {columns.length > 0 && (
            <div className="space-y-2">
              <input
                className="w-full border p-1 rounded"
                placeholder="그래프 제목"
                value={chartTitle}
                onChange={(e) => setChartTitle(e.target.value)}
              />
              {chartType !== 'pie' && chartType !== 'donut' && (
                <>
                  <input
                    className="w-full border p-1 rounded"
                    placeholder="X축 이름"
                    value={xLabelInput}
                    onChange={(e) => setXLabelInput(e.target.value)}
                  />
                  <input
                    className="w-full border p-1 rounded"
                    placeholder="Y축 이름"
                    value={yLabelInput}
                    onChange={(e) => setYLabelInput(e.target.value)}
                  />
                  <div className="flex items-center gap-2">
                    <label className="text-sm">X축 라벨 회전</label>
                    <input
                      type="number"
                      className="w-16 border p-1 rounded"
                      value={xRotate}
                      onChange={(e) => setXRotate(Number(e.target.value))}
                    />
                  </div>
                  {chartType === 'bar' && (
                    <div>
                      <label className="block mb-1">막대 방향</label>
                      <select
                        className="w-full border p-1 rounded"
                        value={barOrient}
                        onChange={(e) => setBarOrient(e.target.value)}
                      >
                        <option value="vertical">세로 막대</option>
                        <option value="horizontal">가로 막대</option>
                      </select>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* 실행 */}
          {columns.length > 0 && (
            <button
              className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
              disabled={
                chartType === 'corr'
                  ? false
                  : !yAxis || (needX && !xAxis)
              }
              onClick={drawChart}
            >
              차트 그리기
            </button>
          )}
        </div>

        {/* ───── 차트 영역 ───── */}
        <div className="flex-1 min-w-0">
          {chartOption && (
            <ReactECharts
              key="main-chart"
              option={chartOption}
              style={{ width: '100%', height: 600 }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
