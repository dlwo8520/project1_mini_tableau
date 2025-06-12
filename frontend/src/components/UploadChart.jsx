import React, { useState, useEffect, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import ReactECharts from 'echarts-for-react';
import { makeHistogram, makeBoxplot } from '../utils/stats';

export default function UploadChart() {
  /* ──────────────────── 상태 ──────────────────── */
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState(null);
  const [rawData, setRawData] = useState([]);
  const [error, setError] = useState('');

  const [chartType, setChartType] = useState('bar');
  const [binCount, setBinCount] = useState(10);

  const [xAxis, setXAxis] = useState('');
  const [yAxis, setYAxis] = useState('');

  /* ▼ 필터 */
  const [filterVar, setFilterVar] = useState('');
  const [filterValues, setFilterValues] = useState([]);
  const [selectedVals, setSelectedVals] = useState(new Set());

  /* ▼ 그룹 */
  const [groupVar, setGroupVar] = useState('');

  const [chartOption, setChartOption] = useState(null);

  /* ──────────────────── 업로드 ──────────────────── */
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

        /* 초기화 */
        setXAxis('');
        setYAxis('');
        setFilterVar('');
        setFilterValues([]);
        setSelectedVals(new Set());
        setGroupVar('');
        setChartOption(null);
      } catch (e) {
        setError(e.response?.data?.file || '업로드 실패');
      }
    },
  });

  /* ──────────────────── 필터 값 동기화 ──────────────────── */
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

  /* ──────────────────── 필터 적용 데이터 ──────────────────── */
  const filteredData = useMemo(() => {
    if (filterVar && selectedVals.size > 0) {
      return rawData.filter((r) => selectedVals.has(r[filterVar]));
    }
    return rawData;
  }, [rawData, filterVar, selectedVals]);

  /* ──────────────────── 차트 그리기 ──────────────────── */
  const drawChart = () => {
    const data = filteredData;
    let option;

    /* 그룹 카테고리 목록 (산점도·선 그래프용) */
    const groups =
      groupVar && ['scatter', 'line'].includes(chartType)
        ? [...new Set(data.map((r) => r[groupVar]))]
        : [];

    /* ---------- 1. 파이 & 막대 : 범주 빈도 ---------- */
    if (['pie', 'bar'].includes(chartType)) {
      const counts = data.reduce((acc, r) => {
        const key = r[yAxis];
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      const cats = Object.keys(counts);
      const vals = cats.map((k) => counts[k]);

      option =
        chartType === 'pie'
          ? {
              tooltip: {},
              legend: { data: cats },
              series: [
                {
                  name: yAxis,
                  type: 'pie',
                  radius: '55%',
                  data: cats.map((c) => ({ name: c, value: counts[c] })),
                },
              ],
            }
          : {
              xAxis: { type: 'category', data: cats },
              yAxis: { type: 'value' },
              series: [{ type: 'bar', data: vals }],
              tooltip: { trigger: 'axis' },
              grid: { containLabel: true },
              legend: { show: false },
            };
    }

    /* ---------- 2. 히스토그램 ---------- */
    else if (chartType === 'histogram') {
      const { categories, data: hist } = makeHistogram(
        data.map((r) => r[yAxis]),
        binCount
      );
      option = {
        xAxis: { type: 'category', data: categories },
        yAxis: { type: 'value' },
        series: [{ type: 'bar', data: hist }],
        tooltip: {},
        grid: { containLabel: true },
        legend: { show: false },
      };
    }

    /* ---------- 3. 박스플롯 ---------- */
    else if (chartType === 'boxplot') {
      const box = makeBoxplot(data.map((r) => r[yAxis]));
      option = {
        xAxis: { type: 'category', data: [''] },
        yAxis: { type: 'value' },
        series: [{ type: 'boxplot', data: [box] }],
        tooltip: {},
        grid: { containLabel: true },
        legend: { show: false },
      };
    }

    /* ---------- 4. 산점도 ---------- */
    else if (chartType === 'scatter') {
      const makeAxis = (name) => ({
        type: 'value',
        name,
        scale: true,
        min: (v) => v.min - (v.max - v.min) * 0.05,
        max: (v) => v.max + (v.max - v.min) * 0.05,
      });

      if (groups.length) {
        option = {
          xAxis: makeAxis(xAxis),
          yAxis: makeAxis(yAxis),
          tooltip: { trigger: 'item' },
          legend: { data: groups },
          grid: { containLabel: true },
          dataZoom: [{ type: 'inside' }, { type: 'slider', height: 40 }],
          series: groups.map((g) => ({
            name: g,
            type: 'scatter',
            data: data
              .filter((r) => r[groupVar] === g)
              .map((r) => [r[xAxis], r[yAxis]]),
          })),
        };
      } else {
        option = {
          xAxis: makeAxis(xAxis),
          yAxis: makeAxis(yAxis),
          tooltip: { trigger: 'item' },
          legend: { show: false },
          grid: { containLabel: true },
          dataZoom: [{ type: 'inside' }, { type: 'slider', height: 40 }],
          series: [
            {
              type: 'scatter',
              data: data.map((r) => [r[xAxis], r[yAxis]]),
            },
          ],
        };
      }
    }

    /* ---------- 5. 선 그래프 ---------- */
    else if (chartType === 'line') {
      const xCats = [...new Set(data.map((r) => r[xAxis]))];
      if (groups.length) {
        const series = groups.map((g) => ({
          name: g,
          type: 'line',
          data: xCats.map(
            (x) =>
              data.find((r) => r[xAxis] === x && r[groupVar] === g)?.[yAxis] ??
              null
          ),
        }));
        option = {
          xAxis: { type: 'category', data: xCats },
          yAxis: { type: 'value' },
          series,
          tooltip: { trigger: 'axis' },
          grid: { containLabel: true },
          legend: { data: groups },
        };
      } else {
        option = {
          xAxis: { type: 'category', data: xCats },
          yAxis: { type: 'value' },
          series: [
            {
              type: 'line',
              data: xCats.map(
                (x) => data.find((r) => r[xAxis] === x)?.[yAxis] ?? null
              ),
            },
          ],
          tooltip: { trigger: 'axis' },
          grid: { containLabel: true },
          legend: { show: false },
        };
      }
    } else {
      alert('해당 조합은 지원하지 않습니다.');
      return;
    }

    setChartOption(null);
    setTimeout(() => setChartOption(option), 0);
  };

  /* ──────────────────── UI 헬퍼 ──────────────────── */
  const needX = ['line', 'scatter'].includes(chartType);
  const numericCharts = ['histogram', 'boxplot', 'line', 'scatter'];
  const varLabel =
    ['pie', 'bar'].includes(chartType) ? '변수(범주형)' : '변수(수치형)';

  const varOptions = columns.filter((c) =>
    ['pie', 'bar'].includes(chartType)
      ? c.dtype === 'object'
      : c.dtype !== 'object'
  );

  const categoricalCols = columns.filter((c) => c.dtype === 'object');

  /* ──────────────────── 렌더 ──────────────────── */
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

      {/* 컨트롤 + 차트 */}
      <div className="flex flex-col lg:flex-row gap-8 mt-6">
        {/* ───── 컨트롤 ───── */}
        <div className="w-full lg:w-72 shrink-0 space-y-4">

          {/* 필터 변수 */}
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

              {/* 값 토글 */}
              {filterVar && filterValues.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {filterValues.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => toggleVal(v)}
                      className={`px-2 py-1 border rounded transition-colors ${
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
                <option value="bar">막대 (범주 빈도)</option>
                <option value="pie">파이 (범주 빈도)</option>
                <option value="histogram">히스토그램</option>
                <option value="boxplot">박스플롯</option>
                <option value="line">선 그래프</option>
                <option value="scatter">산점도</option>
              </select>
            </div>
          )}

          {/* 히스토그램 bin 입력 */}
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
          {columns.length > 0 && (
            <div className={needX ? 'grid grid-cols-2 gap-4' : ''}>
              {/* X축 */}
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

              {/* Y축·변수 */}
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

          {/* 그룹 변수 (산점도·선) */}
          {['scatter', 'line'].includes(chartType) && (
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

          {/* 실행 버튼 */}
          {columns.length > 0 && (
            <button
              className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
              disabled={!yAxis || (needX && !xAxis)}
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
