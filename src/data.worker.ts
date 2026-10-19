/// <reference lib="webworker" />
import { buildChart, csv, filtered, transform } from "./engine";
import { importFile, spreadsheet } from "./importers";
import { sample } from "./samples";
import type { Chart, Dataset, Summary, Transform } from "./types";
const datasets = new Map<
  string,
  { raw: Dataset; current: Dataset; ops: Transform[]; labels: string[] }
>();
const labels: Record<Transform["type"], string> = {
  trim: "앞뒤 공백 정리",
  dedupe: "완전히 같은 행 제거",
  dropMissing: "빈 값 행 제거",
  fill: "빈 값 채우기",
  cast: "자료형 변환",
  rename: "열 이름 변경",
  drop: "열 삭제",
  replace: "찾아 바꾸기",
  calculate: "계산 열 추가",
};
function summary(id: string): Summary {
  const s = datasets.get(id)!;
  return {
    id,
    name: s.current.name,
    fields: s.current.fields,
    notes: s.current.notes,
    rowCount: s.current.rows.length,
    originalRows: s.raw.rows.length,
    missing: s.current.fields.reduce((n, f) => n + f.missing, 0),
    history: s.labels,
  };
}
function add(ds: Dataset) {
  datasets.set(ds.id, { raw: ds, current: ds, ops: [], labels: [] });
  return summary(ds.id);
}
async function handle(cmd: string, p: any): Promise<any> {
  if (cmd === "import")
    return Promise.all((await importFile(p.file, p.options)).map(add));
  if (cmd === "sample") return [add(sample(p.which))];
  if (cmd === "remove") {
    datasets.delete(p.id);
    return null;
  }
  const state = datasets.get(p.id);
  if (!state) throw new Error("데이터를 먼저 불러와 주세요.");
  if (cmd === "view") {
    let rows = filtered(state.current, p.filters ?? []);
    if (p.search) {
      const q = String(p.search).toLocaleLowerCase();
      rows = rows.filter((r) =>
        r.some((v) =>
          String(v ?? "")
            .toLocaleLowerCase()
            .includes(q),
        ),
      );
    }
    if (p.sort) {
      const index = state.current.fields.findIndex(
          (f) => f.id === p.sort.field,
        ),
        dir = p.sort.direction === "desc" ? -1 : 1;
      rows = [...rows].sort((a, b) => {
        const x = a[index],
          y = b[index];
        if (x == null) return 1;
        if (y == null) return -1;
        return (
          (typeof x === "number" && typeof y === "number"
            ? x - y
            : String(x).localeCompare(String(y), "ko", { numeric: true })) * dir
        );
      });
    }
    const page = Math.max(
      0,
      Math.min(p.page ?? 0, Math.max(0, Math.ceil(rows.length / 50) - 1)),
    );
    const charts: Record<string, any> = {};
    for (const chart of (p.charts ?? []) as Chart[]) {
      try {
        charts[chart.id] = buildChart(state.current, rows, chart);
      } catch (e) {
        charts[chart.id] = { error: (e as Error).message };
      }
    }
    return {
      total: rows.length,
      page,
      rows: rows.slice(page * 50, page * 50 + 50),
      charts,
    };
  }
  if (cmd === "transform") {
    const result = transform(state.current, p.operation);
    if (p.preview)
      return {
        affected: result.affected,
        message: result.message,
        rows: result.dataset.rows.slice(0, 5),
        fields: result.dataset.fields,
        rowCount: result.dataset.rows.length,
      };
    state.current = result.dataset;
    state.ops.push(p.operation);
    state.labels.push(labels[p.operation.type as Transform["type"]]);
    return { summary: summary(p.id), message: result.message };
  }
  if (cmd === "undo" || cmd === "reset") {
    if (cmd === "reset") {
      state.ops = [];
      state.labels = [];
    } else {
      state.ops.pop();
      state.labels.pop();
    }
    state.current = state.raw;
    for (const op of state.ops)
      state.current = transform(state.current, op).dataset;
    return summary(p.id);
  }
  if (cmd === "export") {
    const ds = state.current,
      rows = filtered(ds, p.filters ?? []);
    let matrix: any[][];
    if (p.chart) matrix = buildChart(ds, rows, p.chart).table;
    else matrix = [ds.fields.map((f) => f.name), ...rows];
    if (p.format === "json")
      return {
        blob: new Blob(
          [
            JSON.stringify(
              rows.map((r) =>
                Object.fromEntries(ds.fields.map((f, i) => [f.name, r[i]])),
              ),
              null,
              2,
            ),
          ],
          { type: "application/json" },
        ),
        note: "",
      };
    if (p.format === "xlsx") {
      const XLSX = await spreadsheet();
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(matrix), "Data");
      const data = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      return {
        blob: new Blob([data], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        note: "",
      };
    }
    const result = csv(matrix);
    return {
      blob: new Blob([result.value], { type: "text/csv;charset=utf-8" }),
      note: result.escaped
        ? `스프레드시트 수식 실행을 막기 위해 ${result.escaped}개 텍스트 앞에 작은따옴표를 붙였습니다. 원문은 JSON으로 내보낼 수 있습니다.`
        : "",
    };
  }
  throw new Error("알 수 없는 작업입니다.");
}
// Serialize mutations; errors do not break the queue.
let queue = Promise.resolve();
self.onmessage = (event: MessageEvent) => {
  const { request, cmd, payload } = event.data;
  queue = queue.then(async () => {
    try {
      self.postMessage({ request, result: await handle(cmd, payload) });
    } catch (e) {
      self.postMessage({
        request,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });
};
