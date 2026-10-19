export type Cell = string | number | boolean | null;
export type Kind = "text" | "number" | "date" | "boolean";
export type Row = Cell[];
export type Field = {
  id: string;
  name: string;
  kind: Kind;
  missing: number;
  unique: number;
  min?: number;
  max?: number;
  mean?: number;
  examples: string[];
};
export type Dataset = {
  id: string;
  name: string;
  fields: Field[];
  rows: Row[];
  notes: string[];
};
export type Summary = Omit<Dataset, "rows"> & {
  rowCount: number;
  originalRows: number;
  missing: number;
  history: string[];
};
export type ChartType =
  | "bar"
  | "line"
  | "area"
  | "donut"
  | "scatter"
  | "histogram"
  | "boxplot"
  | "correlation";
export type Chart = {
  id: string;
  title: string;
  type: ChartType;
  x: string;
  y: string;
  group: string;
  agg: "sum" | "mean" | "count" | "min" | "max" | "median";
  bucket: "none" | "day" | "month" | "year";
  limit: number;
  horizontal: boolean;
  labels: boolean;
  palette: string;
};
export type Filter = {
  id: string;
  field: string;
  op:
    "eq" | "ne" | "contains" | "gt" | "lt" | "between" | "missing" | "present";
  value: string;
  end: string;
};
export type Transform = {
  type:
    | "trim"
    | "dedupe"
    | "dropMissing"
    | "fill"
    | "cast"
    | "rename"
    | "drop"
    | "replace"
    | "calculate";
  field?: string;
  value?: string;
  extra?: string;
};
export type ImportOptions = {
  encoding: string;
  header: boolean;
  delimiter: string;
  decimal: "." | ",";
  jsonPath: string;
};
export type ChartResult = {
  option: Record<string, unknown>;
  table: Cell[][];
  note: string;
  count: number;
};
export type View = {
  rows: Row[];
  total: number;
  charts: Record<string, ChartResult>;
  page: number;
};
export const defaultImport: ImportOptions = {
  encoding: "auto",
  header: true,
  delimiter: "",
  decimal: ".",
  jsonPath: "",
};
export const kindLabel: Record<Kind, string> = {
  text: "텍스트",
  number: "숫자",
  date: "날짜",
  boolean: "참/거짓",
};
export const chartLabel: Record<ChartType, string> = {
  bar: "막대",
  line: "선",
  area: "영역",
  donut: "도넛",
  scatter: "산점도",
  histogram: "히스토그램",
  boxplot: "상자 수염",
  correlation: "상관관계",
};
export const uid = () => crypto.randomUUID();
