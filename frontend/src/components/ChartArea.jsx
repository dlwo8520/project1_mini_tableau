import ReactECharts from "echarts-for-react";

export default function ChartArea({ columns, data, config }) {
  if (!columns) {
    return (
      <div className="flex-1 rounded-2xl bg-white shadow-card
                      flex items-center justify-center text-gray-400">
        데이터를 업로드하세요
      </div>
    );
  }

  /* 아주 간단한 예시 옵션 (scatter/line/bar) */
  const option = {
    xAxis: { type: "category" },
    yAxis: { type: "value" },
    series: [
      {
        type: config.type,
        data: data.map(r => r[config.y]),
      },
    ],
  };

  return (
    <div className="flex-1 rounded-2xl bg-white shadow-sm">
      <ReactECharts option={option} style={{ height: 600 }} />
    </div>
  );
}
