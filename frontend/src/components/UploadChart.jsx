import React, { useState } from 'react';
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

 const drawChart = () => {
    const values = rawData.map(r => r[yAxis]);
    let option = {};

    switch (chartType) {
      case 'histogram': {
        // binCount 를 적용
        const { categories, data } = makeHistogram(values, binCount);
        option = {
          xAxis: { type: 'category', data: categories },
          yAxis: { type: 'value' },
          series: [{ type: 'bar', data }]
        };
        break;
      }
      case 'boxplot': {
        const boxData = makeBoxplot(values);
        option = {
          xAxis: { type: 'category', data: [''] },
          yAxis: { type: 'value' },
          series: [{ type: 'boxplot', data: [boxData] }]
        };
        break;
      }
      default: {
        const xData = rawData.map(r => r[xAxis]);
        const yData = rawData.map(r => r[yAxis]);
        option = {
          xAxis: { type: 'category', data: xData },
          yAxis: { type: 'value' },
          tooltip: {},
          series: [{ type: chartType, data: yData }],
          grid: { containLabel: true }
        };
      }
    }

    setChartOption(option);
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
          <ReactECharts option={chartOption} style={{ height: 400 }} />
        </div>
      )}
    </div>
  );
}
