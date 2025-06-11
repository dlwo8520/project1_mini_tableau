import React, { useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import ReactECharts from 'echarts-for-react';
import { makeHistogram, makeBoxplot } from '../utils/stats';

export default function UploadChart() {
  // 업로드 상태
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState(null);
  const [rawData, setRawData] = useState([]);
  const [error, setError] = useState('');

  // 차트 설정 상태
  const [chartType, setChartType] = useState('bar');
  const [category, setCategory] = useState('');      // ← 범주형 그룹 변수
  const [binCount, setBinCount] = useState(10);     // histogram용 구간 수
  const [xAxis, setXAxis] = useState('');
  const [yAxis, setYAxis] = useState('');
  const [chartOption, setChartOption] = useState();



  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'text/csv': ['.csv'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx', '.xls'] },
    multiple: false,
    onDrop: async files => {
      const file = files[0];
      const fd = new FormData();
      fd.append('file', file);
      try {
        const res = await axios.post('http://127.0.0.1:8000/api/upload/', fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setRows(res.data.rows);
        setColumns(res.data.columns);
        setRawData(res.data.data || []);
        setError('');
        setXAxis('');
        setYAxis('');
        setChartOption(undefined);
      } catch (e) {
        setError(e.response?.data?.file || '업로드 실패');
      }
    }
  });

  // drawChart 함수만 발췌

const drawChart = () => {
    const data = rawData;
    // 전체 모드: 그룹 미선택 혹은 그룹 변수와 X축이 같으면 groups = []
    const groups = (category && category !== xAxis)
      ? [...new Set(data.map(r => r[category]))]
      : [];
  
    let option;
  
    if (chartType === 'histogram') {
      const { categories, data: histData } = makeHistogram(data.map(r => r[yAxis]), binCount);
      option = {
        xAxis: { type: 'category', data: categories },
        yAxis: { type: 'value' },
        series: [{ type: 'bar', data: histData }],
        tooltip: {},
        grid: { containLabel: true },
        legend: { show: false },          // 범례 숨김
      };
    }
    else if (chartType === 'boxplot') {
      const boxData = makeBoxplot(data.map(r => r[yAxis]));
      option = {
        xAxis: { type: 'category', data: [''] },
        yAxis: { type: 'value' },
        series: [{ type: 'boxplot', data: [boxData] }],
        tooltip: {},
        grid: { containLabel: true },
        legend: { show: false },          // 범례 숨김
      };
    }
    else if (groups.length > 0 && chartType !== 'pie') {
      // 그룹별 바/선/산점도
      const xData = [...new Set(data.map(r => r[xAxis]))];
      const series = groups.map(g => ({
        name: g,
        type: chartType,
        data: xData.map(x =>
          data.filter(r => r[category] === g && r[xAxis] === x)
              .map(r => r[yAxis])[0] ?? null
        )
      }));
      option = {
        xAxis: { type: 'category', data: xData },
        yAxis: { type: 'value' },
        series,
        tooltip: { trigger: 'axis' },
        legend: { show: true, data: groups },  // 그룹 모드에만 범례 표시
        grid: { containLabel: true },
      };
    }
    else if (chartType === 'pie' && groups.length > 0) {
      // 그룹별 파이 차트
      const agg = groups.map(g => ({
        name: g,
        value: data
          .filter(r => r[category] === g)
          .reduce((sum, r) => sum + r[yAxis], 0)
      }));
      option = {
        tooltip: {},
        legend: { show: true, data: groups },
        series: [{
          name: yAxis,
          type: 'pie',
          radius: '50%',
          data: agg
        }]
      };
    }
/* ─────────────────────────────────────────────
     A) 그룹 + scatter  →  [x,y] 점 배열
  ───────────────────────────────────────────── */
  else if (groups.length > 0 && chartType === 'scatter') {
    const series = groups.map(g => ({
      name: g,
      type: 'scatter',
      data: data
        .filter(r => r[category] === g)
        .map(r => [r[xAxis], r[yAxis]]),
    }));
    option = {
      xAxis: { type: 'value', name: xAxis },
      yAxis: { type: 'value', name: yAxis },
      series,
      tooltip: { trigger: 'item' },
      legend: { data: groups },
      grid: { containLabel: true },
    };
  }
  /* ─────────────────────────────────────────────
     B) 그룹 없음 + scatter  →  단일 시리즈 점 배열
  ───────────────────────────────────────────── */
  else if (groups.length === 0 && chartType === 'scatter') {
    option = {
      xAxis: { type: 'value', name: xAxis },
      yAxis: { type: 'value', name: yAxis },
      series: [{
        type: 'scatter',
        data: data.map(r => [r[xAxis], r[yAxis]]),
      }],
      tooltip: { trigger: 'item' },
      legend: { show: false },
      grid: { containLabel: true },
    };
  }
    /* 4. 바로 여기! ▸ bar/line + 그룹 */
  else if (groups.length > 0 && ['bar','line'].includes(chartType)) {
    // ⬇⬇ 여기에 붙여 넣으세요 ⬇⬇
    const xData = [...new Set(data.map(r => r[xAxis]))];
    const series = groups.map(g => ({
      name: g,
      type: chartType,
      data: xData.map(x => {
        const ys = data
          .filter(r => r[category] === g && r[xAxis] === x)
          .map(r => r[yAxis]);
        return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : null; // 평균
      }),
    }));
    option = {
      xAxis: { type: 'category', data: xData },
      yAxis: { type: 'value' },
      series,
      tooltip: { trigger: 'axis' },
      legend: { data: groups },
      grid: { containLabel: true },
    };
    }
    else {
      // 전체(그룹 미선택)
      const xData = data.map(r => r[xAxis]);
      const yData = data.map(r => r[yAxis]);
      option = {
        xAxis: { type: 'category', data: xData },
        yAxis: { type: 'value' },
        series: [{
          type: chartType,
          data: yData
        }],
        tooltip: {},
        grid: { containLabel: true },
        legend: { show: false },          // 전체 모드에선 범례 숨김
      };
    }
  
   // drawChart 함수 안 마지막 줄만 교체
   // 1) 먼저 null 로 초기화
   setChartOption(null);
   // 2) 다음 이벤트 루프에서 새 옵션 적용
   setTimeout(() => setChartOption(option), 0);

  };
  
  
  
  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Mini Tableau</h1>
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
          <p>총 행 수: <strong>{rows}</strong></p>
          <ul className="list-disc list-inside">
            {columns.map(c => (
              <li key={c.name}>{c.name} ({c.dtype})</li>
            ))}
          </ul>
        </div>
      )}

{columns.length > 0 && (
        <div className="mt-6">
          <label className="block mb-1 font-medium">차트 유형</label>
          <select
            className="border p-1 rounded"
            value={chartType}
            onChange={e => setChartType(e.target.value)}
          >
            <option value="bar">막대</option>
            <option value="line">선</option>
            <option value="scatter">산점도</option>
            <option value="pie">파이</option>
            <option value="histogram">히스토그램</option>
            <option value="boxplot">박스플롯</option>
          </select>
        </div>
      )}

      {/* 히스토그램 구간 수 입력 */}
      {chartType === 'histogram' && (
        <div className="mt-4">
          <label className="block mb-1">구간(bin) 개수</label>
          <input
            type="number"
            min={1}
            value={binCount}
            onChange={e => setBinCount(Number(e.target.value))}
            className="w-24 border p-1 rounded"
          />
        </div>
      )}

      {/* 변수 선택 (X/Y or Y만) */}
      {chartType && columns.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-4">
          {['bar','line','scatter','pie'].includes(chartType) && (
            <div>
              <label className="block mb-1">X축</label>
              <select
                className="w-full border p-1 rounded"
                value={xAxis}
                onChange={e => setXAxis(e.target.value)}
              >
                <option value="">선택</option>
                {columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block mb-1">Y축</label>
            <select
              className="w-full border p-1 rounded"
              value={yAxis}
              onChange={e => setYAxis(e.target.value)}
            >
              <option value="">선택</option>
              {columns.filter(c => c.dtype !== 'object').map(c => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {columns.length > 0 && (
       <div className="mt-4">
         <label className="block mb-1 font-medium">그룹 변수(범주형)</label>
         <select
           className="border p-1 rounded"
           value={category}
           onChange={e => setCategory(e.target.value)}
         >
           <option value="">전체</option>
           {columns
             .filter(c => c.dtype === 'object' && c.name !== xAxis)
             .map(c => (
               <option key={c.name} value={c.name}>{c.name}</option>
             ))
           }
         </select>
       </div>
     )}

      {/* 차트 그리기 버튼 */}
      {columns.length > 0 && (
        <button
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          disabled={
            !yAxis ||
            (['bar','line','scatter','pie'].includes(chartType) && !xAxis)
          }
          onClick={drawChart}
        >
          차트 그리기
        </button>
      )}

      {/* 차트 렌더링 */}
      {chartOption && (
        <div className="mt-6">
          <ReactECharts
            key="main-chart"   // 또는 chartType 하나만 넣어도 OK
            option={chartOption}
            style={{ height: 400 }}
          />
        </div>
      )}
    </div>
  );
}
