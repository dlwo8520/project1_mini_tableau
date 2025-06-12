import ReactECharts from "echarts-for-react";

export default function ChartArea({ columns, data, config }) {
  if (!data.length) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
        데이터를 업로드하세요
      </div>
    );
  }

  /* 아주 단순한 Bar 예시 */
  const option = {
    tooltip: {},
    xAxis: { type: "category" },
    yAxis: { type: "value" },
    series: [{
      type: config.type ?? "bar",
      data: data.map((r,i) => r[config.y] ?? i)
    }]
  };

  return (
    <div className="flex-1 rounded-2xl bg-white shadow-card">
      <ReactECharts option={option} style={{ height: 600 }} />
    </div>
  );
}
