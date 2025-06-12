import { Card, CardHeader, CardContent } from "@/components/ui/card";

export default function ConfigSidebar({ columns, config, setConfig }) {
  const numCols   = columns?.filter(c => c.dtype !== "object") ?? [];
  const textCols  = columns?.filter(c => c.dtype === "object") ?? [];

  return (
    <aside className="w-64 shrink-0 flex flex-col gap-4 self-stretch">
      <Card className="shadow-card space-y-3">
        <CardHeader className="text-sm">그래프 설정</CardHeader>
        <CardContent className="space-y-2 text-xs">
          {/* 차트 타입 */}
          <label className="block">
            <span className="block mb-[2px]">차트 종류</span>
            <select
              className="w-full h-8 rounded border"
              value={config.type}
              onChange={e => setConfig(c => ({ ...c, type: e.target.value }))}
            >
              {["bar","line","scatter"].map(t => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>

          {/* X, Y 축 */}
          <label className="block">
            <span className="block mb-[2px]">X 축</span>
            <select
              className="w-full h-8 rounded border"
              value={config.x}
              onChange={e => setConfig(c => ({ ...c, x: e.target.value }))}
            >
              <option value="">선택</option>
              {columns?.map(c => (
                <option key={c.name}>{c.name}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block mb-[2px]">Y 축</span>
            <select
              className="w-full h-8 rounded border"
              value={config.y}
              onChange={e => setConfig(c => ({ ...c, y: e.target.value }))}
            >
              <option value="">선택</option>
              {columns?.map(c => (
                <option key={c.name}>{c.name}</option>
              ))}
            </select>
          </label>
        </CardContent>
      </Card>
    </aside>
  );
}
