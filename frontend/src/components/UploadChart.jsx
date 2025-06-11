import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import ReactECharts from 'echarts-for-react';

export default function UploadChart() {
  // 1) 기본 업로드 상태
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  // 2) 차트용 상태 추가
  const [rawData, setRawData] = useState([]);        // 전체 데이터
  const [xAxis, setXAxis] = useState('');            // X축 변수
  const [yAxis, setYAxis] = useState('');            // Y축 변수
  const [chartOption, setChartOption] = useState();  // ECharts 옵션
  const [chartType, setChartType] = useState('bar');  // 기본은 막대그래프

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx', '.xls'],
    },
    multiple: false,
    onDrop: async (acceptedFiles) => {
      const file = acceptedFiles[0];
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await axios.post(
          'http://127.0.0.1:8000/api/upload/',
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } },
        );
        // 업로드 결과
        setRows(res.data.rows);
        setColumns(res.data.columns);
        setError('');
        // 차트용 전체 데이터(backend가 data 필드를 반환해야 함)
        setRawData(res.data.data || []);
        // 차트 옵션 초기화
        setChartOption(undefined);
        // 축 선택 초기화
        setXAxis('');
        setYAxis('');
      } catch (err) {
        setError(err.response?.data?.file || '업로드에 실패했습니다');
        setRows(null);
        setColumns([]);
        setRawData([]);
      }
    },
  });

  return (
    <div className="p-6 max-w-xl mx-auto">
      {/* 파일 업로드 드롭존 */}
      <div
        {...getRootProps()}
        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-blue-500"
      >
        <input {...getInputProps()} />
        {isDragActive
          ? '여기에 파일을 놓으세요'
          : 'CSV 또는 Excel 파일을 드래그하거나 클릭해 업로드'}
      </div>

      {/* 에러 메시지 */}
      {error && <p className="text-red-500 mt-4">{error}</p>}

      {/* 업로드 요약 */}
      {rows !== null && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold">총 행 수: {rows}</h2>
          <ul className="mt-2 list-disc list-inside">
            {columns.map((col) => (
              <li key={col.name}>
                {col.name}{' '}
                <span className="text-sm text-gray-500">({col.dtype})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 2) 축 선택 UI */}
      {columns.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-4">
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
          <div>
            <label className="block mb-1 font-medium">Y축 변수</label>
            <select
              className="w-full border p-1 rounded"
              value={yAxis}
              onChange={e => setYAxis(e.target.value)}
            >
              <option value="">선택하세요</option>
              {columns
                .filter(c => c.dtype !== 'object')
                .map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))
              }
            </select>
          </div>
        </div>
      )}
        {/* 2-1) 차트 유형 선택 */}
    {columns.length > 0 && (
    <div className="mt-4">
        <label className="block mb-1 font-medium">차트 유형</label>
        <select
        className="border p-1 rounded"
        value={chartType}
        onChange={e => setChartType(e.target.value)}
        >
        <option value="bar">막대그래프</option>
        <option value="line">선그래프</option>
        <option value="pie">파이차트</option>
        <option value="scatter">산점도</option>
        <option value="histogram">히스토그램</option>
        </select>
    </div>
    )}

      {/* 3) 차트 그리기 버튼 */}
      {columns.length > 0 && (
        <button
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          disabled={!xAxis || !yAxis}
          onClick={() => {

            let series, xAxisOpt, yAxisOpt;
          
            if (chartType === 'pie') {
              // 파이차트용 데이터 포맷
              series = [{
                type: 'pie',
                radius: '50%',
                data: rawData.map(r => ({
                  name: r[xAxis],
                  value: r[yAxis]
                }))
              }];
              xAxisOpt = null;
              yAxisOpt = null;
            } else if (chartType === 'histogram') {
              // 히스토그램: only Y축 값 배열 사용
              const values = rawData.map(r => r[yAxis]);
              series = [{
                type: 'histogram',
                data: values
              }];
              xAxisOpt = { type: 'value' };
              yAxisOpt = { type: 'value' };
            } else {
              // bar, line, scatter
              series = [{
                type: chartType,
                data: rawData.map(r => r[yAxis]),
                ...(chartType === 'scatter' && { symbolSize: 10 })
              }];
              xAxisOpt = { type: 'category', data: rawData.map(r => r[xAxis]) };
              yAxisOpt = { type: 'value' };
            }
          
            const option = {
              xAxis: xAxisOpt,
              yAxis: yAxisOpt,
              series,
              tooltip: { show: true },
              grid: { containLabel: true },
            };
            setChartOption(option);
          }}
        >
          차트 그리기
        </button>
      )}

      {/* 4) 렌더링된 차트 */}
      {chartOption && (
        <div className="mt-6">
          <ReactECharts option={chartOption} style={{ height: 400 }} />
        </div>
      )}
    </div>
  );
}
