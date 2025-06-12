import { Card, CardHeader, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectItem,
  SelectContent,
} from "@/components/ui/select";

export default function ConfigSidebar({ columns, config, setConfig }) {
  const numCols = columns?.filter(c => c.dtype !== "object") ?? [];

  return (
    <aside className="w-64 shrink-0 flex flex-col gap-4 self-stretch">
      <Card className="shadow-card">
        <CardHeader className="text-sm">그래프 설정</CardHeader>
        <CardContent className="space-y-4 text-sm">

          {/* 차트 타입 */}
          <div>
            <label className="block mb-1 text-xs">차트 종류</label>
            <Select
              value={config.type}
              onValueChange={v => setConfig(c => ({ ...c, type: v }))}
            >
              <SelectTrigger className="h-8 text-xs" />
              <SelectContent>
                {["bar", "line", "scatter"].map(t => (
                  <SelectItem key={t} value={t} className="text-xs">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 축 선택 (데이터 업로드 후) */}
          {columns && (
            <>
              <div>
                <label className="block mb-1 text-xs">X 축</label>
                <select
                  value={config.x}
                  onChange={e => setConfig(c => ({ ...c, x: e.target.value }))}
                  className="w-full h-8 border rounded text-xs"
                >
                  <option value="">선택</option>
                  {columns.map(c => (
                    <option key={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1 text-xs">Y 축</label>
                <select
                  value={config.y}
                  onChange={e => setConfig(c => ({ ...c, y: e.target.value }))}
                  className="w-full h-8 border rounded text-xs"
                >
                  <option value="">선택</option>
                  {numCols.map(c => (
                    <option key={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </aside>
  );
}
