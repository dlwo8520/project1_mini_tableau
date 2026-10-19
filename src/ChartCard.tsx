import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import {
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  BoxplotChart,
  HeatmapChart,
} from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
  AriaComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import {
  ArrowDownToLine,
  GripVertical,
  Pencil,
  Trash2,
  ImageDown,
  ChartNoAxesCombined,
} from "lucide-react";
import type { Chart, ChartResult } from "./types";
import { chartLabel } from "./types";
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  BoxplotChart,
  HeatmapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
  AriaComponent,
  CanvasRenderer,
]);
export function ChartCard({
  config,
  result,
  onEdit,
  onDelete,
  onExport,
  onMove,
}: {
  config: Chart;
  result?: ChartResult & { error?: string };
  onEdit: () => void;
  onDelete: () => void;
  onExport: () => void;
  onMove: (direction: number) => void;
}) {
  const root = useRef<HTMLDivElement>(null),
    instance = useRef<echarts.ECharts | null>(null);
  useEffect(() => {
    if (!root.current || !result || result.error) return;
    const chart = echarts.init(root.current);
    instance.current = chart;
    chart.setOption({ ...result.option, aria: { enabled: true } });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(root.current);
    return () => {
      observer.disconnect();
      chart.dispose();
      instance.current = null;
    };
  }, [result]);
  const png = () => {
    const url = instance.current?.getDataURL({
      type: "png",
      pixelRatio: 2,
      backgroundColor: "#fff",
    });
    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.download = config.title.replace(/[<>:"/\\|?*]/g, "_") + ".png";
      a.click();
    }
  };
  return (
    <article className="chart-card">
      <header>
        <div>
          <span className="eyebrow">{chartLabel[config.type]}</span>
          <h3>{config.title}</h3>
        </div>
        <div className="chart-tools">
          <button
            className="icon-button"
            aria-label={`${config.title} 차트 편집`}
            title="차트 편집"
            onClick={onEdit}
          >
            <Pencil size={15} />
          </button>
          <details className="popover">
            <summary
              className="icon-button"
              aria-label={`${config.title} 차트 메뉴`}
              title="차트 메뉴"
            >
              <GripVertical size={18} />
            </summary>
            <div className="dropdown">
              <button onClick={png}>
                <ImageDown size={15} />
                PNG 이미지 저장
              </button>
              <button onClick={onExport}>
                <ArrowDownToLine size={15} />
                차트 데이터 CSV
              </button>
              <button onClick={() => onMove(-1)}>앞으로 이동</button>
              <button onClick={() => onMove(1)}>뒤로 이동</button>
              <button className="danger-text" onClick={onDelete}>
                <Trash2 size={15} />
                차트 삭제
              </button>
            </div>
          </details>
        </div>
      </header>
      {result?.error ? (
        <div className="chart-error">
          <ChartNoAxesCombined size={28} />
          <p>{result.error}</p>
          <button className="button small" onClick={onEdit}>
            설정 수정
          </button>
        </div>
      ) : (
        <div
          ref={root}
          className="chart-canvas"
          role="img"
          aria-label={`${config.title}. ${result?.note ?? "차트 계산 중"}`}
        />
      )}
      <footer>{result?.note ?? "차트를 계산하고 있습니다…"}</footer>
    </article>
  );
}
