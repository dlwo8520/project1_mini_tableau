// src/components/UploadChart.jsx

import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';

// ECharts core + 플러그인 등록
import * as echarts from 'echarts/core';
import {
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  BoxplotChart
} from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import ecStat from 'echarts-stat/dist/ecStat';

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  BoxplotChart,
  // Violin/Histo 는 ecStat transform 으로 처리
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
  ecStat.default
]);

import ReactECharts from 'echarts-for-react';

// 이하 생략: drawChart 로직까지 동일




export default function UploadChart() {
  // 업로드 상태
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState(null);
  const [rawData, setRawData] = useState([]);
  const [error, setError] = useState('');

  // 차트 설정 상태
  const [chartType, setChartType] = useState('bar');
  const [xAxis, setXAxis] = useState('');
  const [yAxis, setYAxis] = useState('');
  const [chartOption, setChartOption] = useState();

  // 파일 업로드
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx', '.xls'],
    },
    multiple: false,
    onDrop: async (files) => {
      const file = files[0];
      const fd = new FormData();
      fd.append('file', file);
      try {
        const res = await axios.post(
          'http://127.0.0.1:8000/api/upload/',
          fd,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        setRows(res.data.rows);
        setColumns(res.data.columns);
        setRawData(res.data.data || []);
        setError('');
        // 초기화
        setXAxis('');
        setYAxis('');
        setChartOption(undefined);
      } catch (e) {
        setError(e.response?.data?.file || '업로드 실패');
      }
    }
  });

  // 차트 그리기
  const drawChart = () => {
    let option = {};
    const data = rawData;
    switch (chartType) {
      case 'pie':
        option = {
          tooltip: {},
          series: [{
            type: 'pie',
            radius: '50%',
            data: data.map(r => ({ name: r[xAxis], value: r[yAxis] }))
          }]
        };
        break;
        case 'histogram':
            option = {
              dataset: [{
                source: data.map(r => r[yAxis])
              }],
              series: [{
                type: 'histogram',
                encode: { value: 0 },
                // transform으로 bins 자동 계산
                transform: { type: 'ecStat:histogram', config: {} }
              }]
            };
            break;
          
          case 'boxplot':
            option = {
              dataset: [{
                source: data.map(r => r[yAxis])
              }],
              series: [{
                type: 'boxplot',
                encode: { value: 0 },
                transform: { type: 'ecStat:boxplot', config: {} }
              }]
            };
            break;
          
          case 'violin':
            option = {
              dataset: [{
                source: data.map(r => r[yAxis])
              }],
              series: [{
                type: 'violin',
                encode: { value: 0 },
                transform: { type: 'ecStat:violin', config: {} }
              }]
            };
            break;
          
      default:
        // bar, line, scatter
        option = {
          xAxis: { type: 'category', data: data.map(r => r[xAxis]) },
          yAxis: { type: 'value' },
          tooltip: {},
          series: [{
            type: chartType,
            data: data.map(r => r[yAxis])
          }],
          grid: { containLabel: true }
        };
    }
    setChartOption(option);
  };

  // 렌더링
  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Mini Tableau</h1>

      {/* 1) 파일 업로드 */}
      <div
        {...getRootProps()}
        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-blue-500"
      >
        <input {...getInputProps()} />
        {isDragActive ? '드롭하세요' : 'CSV/Excel 파일을 드래그 또는 클릭해 업로드'}
      </div>
      {error && <p className="text-red-500 mt-2">{error}</p>}

      {/* 2) 업로드 요약 */}
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

      {/* 3) 차트 유형 선택 */}
      {columns.length > 0 && (
        <div className="mt-6">
          <label className="block mb-1 font-medium">차트 유형</label>
          <select
            className="border p-1 rounded"
            value={chartType}
            onChange={e => setChartType(e.target.value)}
          >
            <option value="bar">막대그래프</option>
            <option value="line">선그래프</option>
            <option value="scatter">산점도</option>
            <option value="pie">파이차트</option>
            <option value="histogram">히스토그램</option>
            <option value="boxplot">박스플롯</option>
            <option value="violin">바이올린</option>
          </select>
        </div>
      )}

      {/* 4) 변수 선택 (X/Y or Y만) */}
      {chartType && columns.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-4">
          {(chartType !== 'histogram' && chartType !== 'boxplot' && chartType !== 'violin') && (
            <div>
              <label className="block mb-1 font-medium">X축 변수</label>
              <select
                className="w-full border p-1 rounded"
                value={xAxis}
                onChange={e => setXAxis(e.target.value)}
              >
                <option value="">선택하세요</option>
                {columns.map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block mb-1 font-medium">Y축 변수</label>
            <select
              className="w-full border p-1 rounded"
              value={yAxis}
              onChange={e => setYAxis(e.target.value)}
            >
              <option value="">선택하세요</option>
              {columns.filter(c => c.dtype !== 'object').map(c => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* 5) 차트 그리기 버튼 */}
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

      {/* 6) 차트 렌더링 */}
      {chartOption && (
        <div className="mt-6">
          <ReactECharts option={chartOption} style={{ height: 400 }} />
        </div>
      )}
    </div>
  );
}
