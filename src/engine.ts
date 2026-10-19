import type {
  Cell,
  Chart,
  ChartResult,
  Dataset,
  Field,
  Filter,
  Kind,
  Row,
  Transform,
} from "./types";
export const MAX_ROWS = 100_000,
  MAX_CELLS = 2_000_000,
  MAX_COLUMNS = 500;
export function checkSize(rows: number, columns: number) {
  if (rows > MAX_ROWS || columns > MAX_COLUMNS || rows * columns > MAX_CELLS)
    throw new Error(
      "브라우저 처리 한도를 넘었습니다. 파일을 나누어 주세요. (10만 행 · 500열 · 200만 셀)",
    );
}
export const empty = (v: Cell | undefined) =>
  v == null || (typeof v === "string" && v.trim() === "");
export function numeric(v: Cell | undefined, decimal = "."): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string" || !v.trim()) return null;
  let s = v.trim().replace(/[₩$€£\s]/g, "");
  if (/^[-+]?0\d+/.test(s)) return null; // Preserve codes such as 00123.
  if (decimal === ",") s = s.replace(/\./g, "").replace(",", ".");
  else if (/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?%?$/.test(s)) s = s.replace(/,/g, "");
  const percent = s.endsWith("%");
  if (percent) s = s.slice(0, -1);
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || (Number.isInteger(n) && !Number.isSafeInteger(n)))
    return null;
  return percent ? n / 100 : n;
}
export function dateValue(v: Cell | undefined): number | null {
  if (typeof v !== "string") return null;
  // Avoid interpreting identifiers, locale-dependent dates, or invalid rollover dates.
  const match = v.match(
    /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/,
  );
  if (!match) return null;
  const y = +match[1],
    m = +match[2],
    d = +match[3];
  const day = new Date(Date.UTC(y, m - 1, d));
  if (
    day.getUTCFullYear() !== y ||
    day.getUTCMonth() !== m - 1 ||
    day.getUTCDate() !== d
  )
    return null;
  const standardized = v
    .replace(
      /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/,
      (_, a, b, c) => `${a}-${b.padStart(2, "0")}-${c.padStart(2, "0")}`,
    )
    .replace(" ", "T");
  const time = Date.parse(
    standardized.length === 10
      ? standardized + "T00:00:00Z"
      : /Z|[+-]\d\d:?\d\d$/.test(standardized)
        ? standardized
        : standardized + "Z",
  );
  return Number.isFinite(time) ? time : null;
}
export function normalizeCell(value: unknown): Cell {
  if (value == null) return null;
  if (value instanceof Date)
    return Number.isFinite(+value) ? value.toISOString() : null;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean" || typeof value === "string") return value;
  return JSON.stringify(value, (_, v) =>
    typeof v === "bigint" ? v.toString() : v,
  );
}
export function createDataset(
  name: string,
  matrix: unknown[][],
  header = true,
  decimal = ".",
): Dataset {
  const width = matrix.reduce((n, r) => Math.max(n, r.length), 0);
  if (!matrix.length || !width)
    throw new Error("파일에 표로 읽을 수 있는 데이터가 없습니다.");
  checkSize(Math.max(0, matrix.length - (header ? 1 : 0)), width);
  const used = new Set<string>();
  const names = Array.from({ length: width }, (_, i) => {
    const base = header
      ? String(matrix[0]?.[i] ?? "").trim() || `열 ${i + 1}`
      : `열 ${i + 1}`;
    let name = base,
      suffix = 2;
    while (used.has(name)) name = `${base} (${suffix++})`;
    used.add(name);
    return name;
  });
  const rows = matrix
    .slice(header ? 1 : 0)
    .map((r) => names.map((_, i) => normalizeCell(r[i])));
  if (!rows.length)
    throw new Error(
      "머리글 아래에 데이터 행이 없습니다. 첫 행을 머리글로 쓰는 설정을 확인해 주세요.",
    );
  const fields = names.map((name, i) => {
    const values = rows.map((r) => r[i]).filter((v) => !empty(v));
    let kind: Kind = "text";
    if (
      values.length &&
      values.every(
        (v) => typeof v === "boolean" || v === "true" || v === "false",
      )
    )
      kind = "boolean";
    else if (values.length && values.every((v) => numeric(v, decimal) !== null))
      kind = "number";
    else if (values.length && values.every((v) => dateValue(v) !== null))
      kind = "date";
    if (kind === "number")
      rows.forEach((r) => {
        r[i] = empty(r[i]) ? null : numeric(r[i], decimal);
      });
    if (kind === "boolean")
      rows.forEach((r) => {
        r[i] = empty(r[i]) ? null : r[i] === true || r[i] === "true";
      });
    return {
      id: `f${i}`,
      name,
      kind,
      missing: 0,
      unique: 0,
      examples: [],
    } as Field;
  });
  return profile({ id: crypto.randomUUID(), name, fields, rows, notes: [] });
}
export function profile(ds: Dataset): Dataset {
  ds.fields = ds.fields.map((field, i) => {
    let missing = 0,
      min = Infinity,
      max = -Infinity,
      sum = 0,
      count = 0;
    const unique = new Set<string>();
    for (const row of ds.rows) {
      const v = row[i];
      if (empty(v)) {
        missing++;
        continue;
      }
      unique.add(String(v));
      const n =
        field.kind === "date"
          ? dateValue(v)
          : field.kind === "number"
            ? numeric(v)
            : null;
      if (n !== null) {
        min = Math.min(min, n);
        max = Math.max(max, n);
        sum += n;
        count++;
      }
    }
    return {
      ...field,
      missing,
      unique: unique.size,
      examples: [...unique].slice(0, 3),
      min: count ? min : undefined,
      max: count ? max : undefined,
      mean: field.kind === "number" && count ? sum / count : undefined,
      identifier: isIdentifierName(field.name),
    };
  });
  return ds;
}
// A column name must indicate an identifier; uniqueness alone must never hide a measurement.
export function isIdentifierName(name: string): boolean {
  const normalized = name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .trim();
  return (
    /(?:^|[\s_.-])(?:id|uuid|guid|index)(?:$|[\s_.-])/.test(normalized) ||
    /^unnamed\s*:\s*\d+$/.test(normalized) ||
    /^(?:(?:row|record|sample|serial|customer|order)[\s_.-]*(?:no|number)|no\.?)$/.test(
      normalized,
    ) ||
    /^(?:(?:고객|주문|샘플|행|일련|회원|상품|제품|사용자)?\s*번호|순번|인덱스)$/.test(
      normalized,
    )
  );
}
export const identifierField = (field: Field) =>
  field.identifier ?? isIdentifierName(field.name);
export function defaultAggregation(field?: Pick<Field, "name">): Chart["agg"] {
  if (!field) return "count";
  const name = field.name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  if (
    /(?:^|[\s_.-])(?:length|width|height|temperature|pressure|speed|weight|age|score|rating|rate|ratio|percent|price|average|mean)(?:$|[\s_.-])|길이|너비|높이|온도|기온|압력|속도|무게|연령|나이|점수|만족도|비율|평균|단가/.test(
      name,
    )
  )
    return "mean";
  // Use mean for unknown physical/continuous measurements; only known additive names opt into sum.
  return /(?:^|[\s_.-])(?:sales|revenue|amount|cost|expense|profit|quantity|qty|count|orders|units|total)(?:$|[\s_.-])|매출|매입|금액|비용|광고비|수량|건수|주문\s*수|판매\s*수|이익|수익/.test(
    name,
  )
    ? "sum"
    : "mean";
}
export function histogramBins(sorted: number[], requested = 0): number {
  if (!sorted.length || sorted[0] === sorted.at(-1)) return 1;
  if (Number.isFinite(requested) && requested > 0)
    return Math.max(1, Math.min(50, Math.round(requested)));
  const iqr = quantile(sorted, 0.75)! - quantile(sorted, 0.25)!;
  const width = (2 * iqr) / Math.cbrt(sorted.length);
  const estimate =
    width > 0
      ? Math.ceil((sorted.at(-1)! - sorted[0]) / width)
      : Math.ceil(Math.log2(sorted.length) + 1);
  // Compact first view; users can choose up to 50 bins explicitly. No records are omitted.
  return Math.max(1, Math.min(12, new Set(sorted).size, estimate));
}
export function filtered(ds: Dataset, filters: Filter[]) {
  const specs = filters
    .map((f) => ({ ...f, index: ds.fields.findIndex((c) => c.id === f.field) }))
    .filter((f) => f.index >= 0);
  return ds.rows.filter((row) =>
    specs.every((f) => {
      const v = row[f.index];
      if (f.op === "missing") return empty(v);
      if (f.op === "present") return !empty(v);
      if (f.op === "contains")
        return String(v ?? "")
          .toLocaleLowerCase()
          .includes(f.value.toLocaleLowerCase());
      const field = ds.fields[f.index];
      const convert = (v: Cell) =>
        field.kind === "number"
          ? numeric(v)
          : field.kind === "date"
            ? dateValue(v)
            : String(v ?? "");
      const a = convert(v),
        b = convert(f.value),
        c = convert(f.end);
      if (f.op === "eq") return a === b;
      if (f.op === "ne") return a !== b;
      if (a === null || b === null || empty(v)) return false;
      if (f.op === "gt") return a > b;
      if (f.op === "lt") return a < b;
      return c !== null && a >= b && a <= c;
    }),
  );
}
export function quantile(sorted: number[], p: number) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * p,
    i = Math.floor(pos);
  return (
    sorted[i] +
    (sorted[Math.min(i + 1, sorted.length - 1)] - sorted[i]) * (pos - i)
  );
}
export function aggregate(
  values: number[],
  agg: Chart["agg"],
  count: number,
): number | null {
  if (agg === "count") return count;
  if (!values.length) return null;
  if (agg === "median")
    return quantile(
      [...values].sort((a, b) => a - b),
      0.5,
    );
  if (agg === "min") return values.reduce((a, b) => Math.min(a, b), Infinity);
  if (agg === "max") return values.reduce((a, b) => Math.max(a, b), -Infinity);
  const total = values.reduce((a, b) => a + b, 0);
  return agg === "mean" ? total / values.length : total;
}
const palettes: Record<string, string[]> = {
  blue: [
    "#2563eb",
    "#38bdf8",
    "#6366f1",
    "#14b8a6",
    "#a5b4fc",
    "#93c5fd",
    "#0c4a6e",
    "#c4b5fd",
  ],
  ocean: ["#0284c7", "#0891b2", "#0d9488", "#2dd4bf", "#67e8f9", "#155e75"],
  violet: ["#6366f1", "#8b5cf6", "#a78bfa", "#c084fc", "#818cf8", "#4f46e5"],
};
export function buildChart(
  ds: Dataset,
  rows: Row[],
  config: Chart,
): ChartResult {
  const fields = ds.fields,
    xi = fields.findIndex((f) => f.id === config.x),
    yi = fields.findIndex((f) => f.id === config.y),
    gi = fields.findIndex((f) => f.id === config.group);
  const xname = fields[xi]?.name ?? "",
    yname = fields[yi]?.name ?? "행 수";
  const option: any = {
    color: palettes[config.palette] ?? palettes.blue,
    animationDuration: 350,
    textStyle: { fontFamily: "inherit", color: "#66758c" },
    tooltip: { trigger: "axis", confine: true },
    grid: { left: 12, right: 22, top: 36, bottom: 14, containLabel: true },
    legend: {
      top: 0,
      type: "scroll",
      textStyle: { color: "#66758c", fontSize: 11 },
    },
  };
  const axis = {
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { lineStyle: { color: "#eef2f7" } },
    axisLabel: { hideOverlap: true, color: "#8290a4", fontSize: 11 },
  };
  let table: Cell[][] = [],
    note = "",
    count = rows.length;
  const numericValues = (index: number) =>
    rows.map((r) => numeric(r[index])).filter((v): v is number => v !== null);
  const bucket = (value: Cell) => {
    if (empty(value)) return "(빈 값)";
    if (config.bucket !== "none" && xi >= 0 && fields[xi].kind === "date") {
      const t = dateValue(value);
      if (t !== null)
        return new Date(t)
          .toISOString()
          .slice(
            0,
            config.bucket === "year" ? 4 : config.bucket === "month" ? 7 : 10,
          );
    }
    return String(value);
  };
  if (config.type === "correlation") {
    const nums = fields
      .map((f, i) => ({ f, i }))
      .filter(
        ({ f }) =>
          f.kind === "number" &&
          (config.includeIdentifiers || !identifierField(f)),
      )
      .slice(0, 18);
    const values: (number | null)[][] = [];
    table = [["변수 1", "변수 2", "Pearson r", "유효 쌍"]];
    nums.forEach((a, ai) =>
      nums.forEach((b, bi) => {
        let n = 0,
          mx = 0,
          my = 0,
          sx = 0,
          sy = 0,
          co = 0;
        for (const r of rows) {
          const x = numeric(r[a.i]),
            y = numeric(r[b.i]);
          if (x === null || y === null) continue;
          n++;
          const dx = x - mx,
            dy = y - my;
          mx += dx / n;
          my += dy / n;
          sx += dx * (x - mx);
          sy += dy * (y - my);
          co += dx * (y - my);
        }
        const r =
          n > 1 && sx > 0 && sy > 0
            ? Math.max(-1, Math.min(1, co / Math.sqrt(sx * sy)))
            : null;
        values.push([ai, bi, r === null ? null : +r.toFixed(4)]);
        table.push([a.f.name, b.f.name, r, n]);
      }),
    );
    option.xAxis = {
      ...axis,
      type: "category",
      data: nums.map((n) => n.f.name),
      axisLabel: { rotate: 25, fontSize: 10 },
    };
    option.yAxis = {
      ...axis,
      type: "category",
      data: nums.map((n) => n.f.name),
    };
    option.tooltip = { position: "top", confine: true };
    option.visualMap = {
      min: -1,
      max: 1,
      calculable: false,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      inRange: { color: ["#fbbf24", "#f8fafc", "#2563eb"] },
      itemHeight: 90,
    };
    option.grid = { ...option.grid, bottom: 55 };
    option.series = [
      {
        type: "heatmap",
        data: values,
        label: { show: config.labels, fontSize: 10 },
      },
    ];
    note =
      "Pearson · 결측값은 변수 쌍마다 제외 · 상수 열은 계산 불가" +
      (fields.filter(
        (f) =>
          f.kind === "number" &&
          (config.includeIdentifiers || !identifierField(f)),
      ).length > 18
        ? " · 처음 18개 숫자 열"
        : "") +
      (!config.includeIdentifiers &&
      fields.some((f) => f.kind === "number" && identifierField(f))
        ? " · ID 후보 열 제외"
        : "");
  } else if (config.type === "scatter") {
    if (xi < 0 || yi < 0)
      throw new Error("산점도에 사용할 숫자 X·Y 열을 선택해 주세요.");
    const groups = new Map<string, number[][]>();
    let valid = 0;
    for (const r of rows) {
      const x = numeric(r[xi]),
        y = numeric(r[yi]);
      if (x === null || y === null) continue;
      valid++;
      const group = gi < 0 ? yname : String(r[gi] ?? "(빈 값)");
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push([x, y]);
    }
    if (groups.size > 30)
      throw new Error("산점도의 색상 그룹은 30개 이하로 선택해 주세요.");
    const stride = Math.max(1, Math.ceil(valid / 5000));
    option.xAxis = {
      ...axis,
      type: "value",
      name: xname,
      scale: true,
      nameLocation: "middle",
      nameGap: 25,
    };
    option.yAxis = { ...axis, type: "value", name: yname, scale: true };
    option.grid = { ...option.grid, bottom: 35 };
    option.tooltip = { trigger: "item", confine: true };
    option.series = [...groups].map(([name, points]) => ({
      name,
      type: "scatter",
      symbolSize: 7,
      itemStyle: { opacity: 0.65 },
      data: points.filter((_, i) => i % stride === 0),
    }));
    table = [
      [xname, yname, gi < 0 ? "시리즈" : fields[gi].name],
      ...[...groups].flatMap(([g, points]) =>
        points.map((p) => [p[0], p[1], g]),
      ),
    ];
    note =
      `${valid.toLocaleString()}개 유효 쌍` +
      (stride > 1 ? " · 화면에는 약 5,000점 간격 표본, 내보내기는 전체" : "");
    count = valid;
  } else if (config.type === "histogram" || config.type === "boxplot") {
    if (yi < 0) throw new Error("분포를 확인할 숫자 열을 선택해 주세요.");
    const values = numericValues(yi).sort((a, b) => a - b);
    count = values.length;
    if (!values.length)
      throw new Error("선택한 범위에 유효한 숫자가 없습니다.");
    if (config.type === "histogram") {
      const bins = histogramBins(values, config.bins),
        low = values[0],
        high = values.at(-1)!;
      const width = high === low ? 1 : (high - low) / bins,
        counts = Array(high === low ? 1 : bins).fill(0);
      const edges = Array.from({ length: counts.length + 1 }, (_, i) =>
        high === low ? low : i === counts.length ? high : low + i * width,
      );
      values.forEach((v) => {
        // Compare against the actual interval edges. Division alone can put 6.1 in
        // the preceding 5.65–6.1 bin because (6.1-4.3)/0.45 rounds below 4.
        let left = 0,
          right = counts.length;
        while (left < right) {
          const mid = Math.floor((left + right) / 2);
          if (v >= edges[mid + 1]) left = mid + 1;
          else right = mid;
        }
        counts[Math.min(counts.length - 1, left)]++;
      });
      const labels = counts.map((_, i) =>
        high === low
          ? String(low)
          : `${+edges[i].toPrecision(4)}–${+edges[i + 1].toPrecision(4)}`,
      );
      option.xAxis = { ...axis, type: "category", data: labels };
      option.yAxis = { ...axis, type: "value", minInterval: 1, name: "행 수" };
      option.series = [
        {
          type: "bar",
          data: counts,
          barCategoryGap: "6%",
          itemStyle: { borderRadius: [4, 4, 0, 0] },
          label: { show: config.labels, position: "top" },
        },
      ];
      table = [
        ["구간 시작", "구간 끝", "행 수"],
        ...counts.map((n, i) => [edges[i], edges[i + 1], n]),
      ];
      note = `숫자 분포 · ${config.bins ? "지정" : "자동"} ${counts.length}구간의 행 수 · 오른쪽 끝은 마지막 구간에 포함`;
    } else {
      const q1 = quantile(values, 0.25)!,
        median = quantile(values, 0.5)!,
        q3 = quantile(values, 0.75)!,
        iqr = q3 - q1;
      const inner = values.filter(
        (v) => v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr,
      );
      const low = inner[0],
        high = inner.at(-1)!,
        outliers = values.filter((v) => v < low || v > high);
      option.xAxis = { ...axis, type: "category", data: [yname] };
      option.yAxis = { ...axis, type: "value", scale: true };
      option.series = [
        {
          type: "boxplot",
          data: [[low, q1, median, q3, high]],
          itemStyle: { color: "#dbeafe", borderColor: "#2563eb" },
        },
        {
          type: "scatter",
          data: outliers.slice(0, 3000).map((v) => [0, v]),
          symbolSize: 4,
        },
      ];
      table = [
        ["최소 수염", "Q1", "중앙값", "Q3", "최대 수염", "이상치 수"],
        [low, q1, median, q3, high, outliers.length],
      ];
      note = "Tukey 수염 · 1.5 × IQR · 이상치 표시는 최대 3,000점";
    }
  } else {
    if (xi < 0) throw new Error("범주 또는 날짜 X축을 선택해 주세요.");
    if (config.agg !== "count" && (yi < 0 || fields[yi].kind !== "number"))
      throw new Error("집계할 숫자 열을 선택해 주세요.");
    const groups = new Map<
        string,
        Map<string, { values: number[]; count: number }>
      >(),
      groupNames = new Set<string>();
    for (const r of rows) {
      const x = bucket(r[xi]),
        g = gi < 0 ? "" : String(r[gi] ?? "(빈 값)");
      groupNames.add(g);
      if (!groups.has(x)) groups.set(x, new Map());
      const cell = groups.get(x)!;
      if (!cell.has(g)) cell.set(g, { values: [], count: 0 });
      const item = cell.get(g)!;
      item.count++;
      const n = numeric(r[yi]);
      if (n !== null) item.values.push(n);
    }
    if (groupNames.size > 30)
      throw new Error(
        "색상 그룹은 30개 이하로 선택해 주세요. 필터를 적용하거나 다른 열을 선택하세요.",
      );
    let labels = [...groups.keys()];
    const totalFor = (x: string) => {
      const a = [...groups.get(x)!.values()];
      return (
        aggregate(
          a.flatMap((v) => v.values),
          config.agg,
          a.reduce((s, v) => s + v.count, 0),
        ) ?? -Infinity
      );
    };
    if (
      fields[xi].kind === "date" ||
      config.type === "line" ||
      config.type === "area"
    )
      labels.sort((a, b) =>
        fields[xi].kind === "number"
          ? Number(a) - Number(b)
          : a.localeCompare(b),
      );
    else labels.sort((a, b) => totalFor(b) - totalFor(a));
    const all = labels.length;
    labels = labels.slice(0, config.limit);
    const names = [...groupNames];
    const series = names.map((name) => ({
      name: name || (config.agg === "count" ? "행 수" : yname),
      type: config.type === "line" || config.type === "area" ? "line" : "bar",
      data: labels.map((x) => {
        const cell = groups.get(x)!.get(name);
        return cell ? aggregate(cell.values, config.agg, cell.count) : null;
      }),
      ...(config.type === "area" ? { areaStyle: { opacity: 0.13 } } : {}),
      smooth: 0.15,
      connectNulls: false,
      symbolSize: 5,
      barMaxWidth: 38,
      itemStyle: {
        borderRadius: config.horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
      },
      label: {
        show: config.labels,
        position: config.horizontal ? "right" : "top",
        fontSize: 10,
      },
    }));
    table = [
      [xname, ...series.map((s) => s.name)],
      ...labels.map((x, i) => [x, ...series.map((s) => s.data[i])]),
    ];
    if (config.type === "donut") {
      if (gi >= 0) throw new Error("도넛 차트는 색상 그룹 없이 사용해 주세요.");
      if (series[0]?.data.some((v) => v !== null && v < 0))
        throw new Error(
          "도넛 차트에는 음수를 사용할 수 없습니다. 막대 차트를 선택해 주세요.",
        );
      option.tooltip = { trigger: "item", confine: true };
      option.legend = {
        bottom: 0,
        type: "scroll",
        textStyle: { fontSize: 11, color: "#66758c" },
      };
      option.series = [
        {
          type: "pie",
          radius: ["48%", "72%"],
          center: ["50%", "45%"],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: "#fff", borderWidth: 3, borderRadius: 5 },
          label: { show: config.labels, formatter: "{b}: {d}%", fontSize: 11 },
          data: labels.map((name, i) => ({ name, value: series[0].data[i] })),
        },
      ];
    } else {
      const cat = {
          ...axis,
          type: "category",
          data: labels,
          boundaryGap: config.type === "bar",
        },
        val = { ...axis, type: "value" };
      option.xAxis = config.horizontal && config.type === "bar" ? val : cat;
      option.yAxis =
        config.horizontal && config.type === "bar"
          ? { ...cat, inverse: true }
          : val;
      option.series = series;
    }
    note =
      `${config.agg === "count" ? "행 수" : ({ sum: "합계", mean: "평균", min: "최솟값", max: "최댓값", median: "중앙값" } as any)[config.agg]} 기준` +
      (all > labels.length
        ? ` · ${all}개 범주 중 ${labels.length}개 표시 (설정에서 변경)`
        : "") +
      (gi >= 0 ? ` · ${fields[gi].name}별` : "");
  }
  return { option, table, note, count };
}
export function recommendations(ds: Pick<Dataset, "fields">): Chart[] {
  const nums = ds.fields.filter(
      (f) => f.kind === "number" && !identifierField(f) && f.unique > 0,
    ),
    dates = ds.fields.filter((f) => f.kind === "date" && !identifierField(f)),
    cats = ds.fields.filter(
      (f) =>
        !identifierField(f) &&
        (f.kind === "text" ||
          f.kind === "boolean" ||
          (f.kind === "number" &&
            /^(?:(?:species|class|label|category|status|grade|type|group|cluster|code)(?:[\s_.-]*(?:code|label))?|등급|분류|유형|구분|코드)$/i.test(
              f.name.replace(/([a-z0-9])([A-Z])/g, "$1 $2"),
            ))) &&
        f.unique > 1 &&
        f.unique <= 30,
    );
  const measures = nums.filter((f) => !cats.includes(f));
  const measure = measures[0],
    agg = defaultAggregation(measure);
  const make = (type: Chart["type"], title: string, x = "", y = ""): Chart => ({
    id: crypto.randomUUID(),
    title,
    type,
    x,
    y,
    group: "",
    agg: y ? defaultAggregation(ds.fields.find((f) => f.id === y)) : "count",
    bucket: dates.some((f) => f.id === x) ? "month" : "none",
    limit: 12,
    horizontal: false,
    labels: !y && cats.some((f) => f.id === x && f.unique <= 12),
    palette: "blue",
    bins: 0,
  });
  const list: Chart[] = [];
  if (dates.length)
    list.push(
      make(
        "area",
        `${dates[0].name}에 따른 ${measure?.name ?? "행 수"}${measure ? (agg === "sum" ? " 합계" : " 평균") : ""}`,
        dates[0].id,
        measure?.id,
      ),
    );
  if (cats.length && (!dates.length || !measure) && (!measure || agg !== "sum"))
    list.push(make("bar", `${cats[0].name}별 개수`, cats[0].id));
  if (cats.length && measure)
    list.push(
      make(
        "bar",
        `${cats[0].name}별 ${measure.name} ${agg === "sum" ? "합계" : "평균"}`,
        cats[0].id,
        measure.id,
      ),
    );
  if (measure)
    list.push(make("histogram", `${measure.name} 분포`, "", measure.id));
  const varying = measures.filter((f) => f.unique > 1);
  if (varying.length > 1) {
    const scatter = make(
      "scatter",
      `${varying[0].name} × ${varying[1].name}`,
      varying[0].id,
      varying[1].id,
    );
    // A small categorical legend makes observation groups visible without creating many series.
    if (cats[0] && cats[0].unique <= 12) scatter.group = cats[0].id;
    list.push(scatter);
  }
  if (list.length < 3 && cats[1])
    list.push(make("donut", `${cats[1].name} 구성`, cats[1].id));
  if (!list.length && cats[0])
    list.push(make("bar", `${cats[0].name}별 개수`, cats[0].id));
  return list.slice(0, 4);
}
// Small arithmetic parser: field references [매출], + - * / and parentheses. No eval.
export function formula(
  expression: string,
  fields: Field[],
): (row: Row) => Cell {
  const tokens =
    expression.match(/\[[^\]]+\]|(?:\d+(?:\.\d*)?|\.\d+)|[()+*/-]|\S/g) ?? [];
  let position = 0;
  type Fn = (row: Row) => number | null;
  function primary(): Fn {
    const token = tokens[position++];
    if (token === "-") {
      const f = primary();
      return (r) => {
        const v = f(r);
        return v === null ? null : -v;
      };
    }
    if (token === "+") return primary();
    if (token === "(") {
      const f = add();
      if (tokens[position++] !== ")")
        throw new Error("수식의 닫는 괄호를 확인해 주세요.");
      return f;
    }
    if (token?.startsWith("[")) {
      const index = fields.findIndex((f) => f.name === token.slice(1, -1));
      if (index < 0) throw new Error(`열을 찾을 수 없습니다: ${token}`);
      return (r) => numeric(r[index]);
    }
    if (token && /^\d|^\.\d/.test(token) && Number.isFinite(Number(token)))
      return () => Number(token);
    throw new Error(
      "수식은 [열 이름], 숫자, + - * / ( )만 사용할 수 있습니다.",
    );
  }
  function multiply(): Fn {
    let fn = primary();
    while (tokens[position] === "*" || tokens[position] === "/") {
      const op = tokens[position++],
        left = fn,
        right = primary();
      fn = (r) => {
        const a = left(r),
          b = right(r);
        return a === null || b === null || (op === "/" && b === 0)
          ? null
          : op === "*"
            ? a * b
            : a / b;
      };
    }
    return fn;
  }
  function add(): Fn {
    let fn = multiply();
    while (tokens[position] === "+" || tokens[position] === "-") {
      const op = tokens[position++],
        left = fn,
        right = multiply();
      fn = (r) => {
        const a = left(r),
          b = right(r);
        return a === null || b === null ? null : op === "+" ? a + b : a - b;
      };
    }
    return fn;
  }
  const fn = add();
  if (position !== tokens.length)
    throw new Error(
      "수식을 끝까지 읽을 수 없습니다. 열 이름을 대괄호로 감싸 주세요.",
    );
  return (r) => {
    const n = fn(r);
    return n === null || !Number.isFinite(n) ? null : n;
  };
}
export function transform(
  ds: Dataset,
  op: Transform,
): { dataset: Dataset; affected: number; message: string } {
  let rows = ds.rows.map((r) => [...r]),
    fields = ds.fields.map((f) => ({ ...f })),
    affected = 0;
  const index = fields.findIndex((f) => f.id === op.field);
  if (!["trim", "dedupe", "calculate"].includes(op.type) && index < 0)
    throw new Error("대상 열을 선택해 주세요.");
  if (op.type === "trim")
    rows.forEach((r) =>
      r.forEach((v, i) => {
        if (typeof v === "string") {
          const n = v.trim();
          if (n !== v) affected++;
          r[i] = n || null;
        }
      }),
    );
  if (op.type === "dedupe") {
    const seen = new Set<string>();
    rows = rows.filter((r) => {
      const key = JSON.stringify(r);
      if (seen.has(key)) {
        affected++;
        return false;
      }
      seen.add(key);
      return true;
    });
  }
  if (op.type === "dropMissing")
    rows = rows.filter((r) => {
      if (empty(r[index])) {
        affected++;
        return false;
      }
      return true;
    });
  if (op.type === "fill") {
    const valid = rows.map((r) => r[index]).filter((v) => !empty(v));
    let value: Cell = op.extra ?? "";
    if (op.value === "mean" || op.value === "median") {
      if (fields[index].kind !== "number")
        throw new Error("평균·중앙값 채우기는 숫자 열에서 사용할 수 있습니다.");
      const ns = valid
        .map((v) => numeric(v))
        .filter((v): v is number => v !== null);
      if (!ns.length) throw new Error("채움 값을 계산할 숫자가 없습니다.");
      value = aggregate(ns, op.value, ns.length);
    } else if (op.value === "mode") {
      const freq = new Map<Cell, number>();
      valid.forEach((v) => freq.set(v, (freq.get(v) ?? 0) + 1));
      value = [...freq].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      if (value === null) throw new Error("최빈값을 계산할 값이 없습니다.");
    } else if (fields[index].kind === "number") {
      value = numeric(value);
      if (value === null)
        throw new Error("숫자 열에는 숫자 채움 값을 입력해 주세요.");
    } else if (fields[index].kind === "date" && dateValue(value) === null)
      throw new Error("날짜 채움 값은 YYYY-MM-DD 형식으로 입력해 주세요.");
    else if (fields[index].kind === "boolean") {
      if (value !== "true" && value !== "false")
        throw new Error("참/거짓 채움 값은 true 또는 false를 입력해 주세요.");
      value = value === "true";
    }
    rows.forEach((r) => {
      if (empty(r[index])) {
        r[index] = value;
        affected++;
      }
    });
  }
  if (op.type === "cast") {
    const kind = op.value as Kind;
    if (!["text", "number", "date", "boolean"].includes(kind))
      throw new Error("알 수 없는 자료형입니다.");
    let invalid = 0;
    rows.forEach((r) => {
      const v = r[index];
      if (empty(v)) {
        r[index] = null;
        return;
      }
      let result: Cell = String(v);
      if (kind === "number") result = numeric(v);
      if (kind === "date") {
        const t = dateValue(v);
        result = t === null ? null : new Date(t).toISOString();
      }
      if (kind === "boolean")
        result =
          v === true || v === "true" || v === 1 || v === "1"
            ? true
            : v === false || v === "false" || v === 0 || v === "0"
              ? false
              : null;
      if (result === null) invalid++;
      if (result !== v) affected++;
      r[index] = result;
    });
    fields[index].kind = kind;
    if (invalid)
      return {
        dataset: profile({ ...ds, fields, rows }),
        affected,
        message: `${affected.toLocaleString()}개 셀 변경 · 변환할 수 없는 ${invalid.toLocaleString()}개 값은 빈 값으로 변경 (되돌리기 가능)`,
      };
  }
  if (op.type === "rename") {
    const name = op.value?.trim();
    if (!name) throw new Error("새 열 이름을 입력해 주세요.");
    if (fields.some((f, i) => i !== index && f.name === name))
      throw new Error("같은 이름의 열이 있습니다.");
    fields[index].name = name;
    affected = 1;
  }
  if (op.type === "drop") {
    fields.splice(index, 1);
    rows.forEach((r) => r.splice(index, 1));
    affected = ds.rows.length;
    if (!fields.length) throw new Error("최소 한 개의 열이 필요합니다.");
  }
  if (op.type === "replace") {
    if (!op.value) throw new Error("찾을 문자열을 입력해 주세요.");
    if (fields[index].kind !== "text")
      throw new Error("찾아 바꾸기는 텍스트 열에서 사용할 수 있습니다.");
    rows.forEach((r) => {
      if (typeof r[index] === "string" && r[index].includes(op.value!)) {
        r[index] = r[index].split(op.value!).join(op.extra ?? "");
        affected++;
      }
    });
  }
  if (op.type === "calculate") {
    const name = op.value?.trim();
    if (!name || fields.some((f) => f.name === name))
      throw new Error("새롭고 고유한 열 이름을 입력해 주세요.");
    checkSize(rows.length, fields.length + 1);
    const fn = formula(op.extra ?? "", fields);
    rows.forEach((r) => r.push(fn(r)));
    fields.push({
      id: `calc_${fields.length}_${name}`,
      name,
      kind: "number",
      missing: 0,
      unique: 0,
      examples: [],
    });
    affected = rows.length;
  }
  return {
    dataset: profile({ ...ds, fields, rows }),
    affected,
    message: `${affected.toLocaleString()}개 ${["dedupe", "dropMissing"].includes(op.type) ? "행" : "값"} 처리 완료`,
  };
}
export function csv(matrix: Cell[][]) {
  let escaped = 0;
  const value =
    "\ufeff" +
    matrix
      .map((row) =>
        row
          .map((v) => {
            let s = String(v ?? "");
            if (typeof v === "string" && /^[\s]*[=+@-]/.test(s)) {
              s = "'" + s;
              escaped++;
            }
            return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
          })
          .join(","),
      )
      .join("\r\n");
  return { value, escaped };
}
