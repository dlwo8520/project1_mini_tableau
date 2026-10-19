import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregate,
  buildChart,
  createDataset,
  csv,
  dateValue,
  filtered,
  formula,
  numeric,
  recommendations,
  transform,
} from "../src/engine";
import {
  flattenObject,
  importFile,
  jsonMatrix,
  recordsMatrix,
} from "../src/importers";
import { defaultImport, type Chart } from "../src/types";
import * as XLSX from "xlsx";
const config = (
  ds: ReturnType<typeof createDataset>,
  overrides: Partial<Chart> = {},
): Chart => ({
  ...recommendations(ds)[0],
  type: "bar",
  x: ds.fields[0].id,
  y: ds.fields[1]?.id ?? "",
  agg: "sum",
  group: "",
  bucket: "none",
  limit: 12,
  ...overrides,
});
test("numeric inference preserves IDs and unsafe integers; supports separators and percent", () => {
  assert.equal(numeric("00123"), null);
  assert.equal(numeric("9007199254740993"), null);
  assert.equal(numeric("1,234.56"), 1234.56);
  assert.equal(numeric("1.234,56", ","), 1234.56);
  assert.equal(numeric("12%"), 0.12);
  const ds = createDataset("test", [
    ["id", "amount"],
    ["001", "1,200"],
    ["002", "2,000"],
    ["003", ""],
  ]);
  assert.equal(ds.fields[0].kind, "text");
  assert.equal(ds.fields[1].kind, "number");
  assert.equal(ds.fields[1].missing, 1);
  assert.equal(ds.fields[1].mean, 1600);
});
test("date detection is strict and UTC, invalid dates do not roll over", () => {
  assert.equal(dateValue("2025-02-30"), null);
  assert.equal(dateValue("2024-02-29"), Date.UTC(2024, 1, 29));
  assert.equal(dateValue("2025-1-2"), Date.UTC(2025, 0, 2));
  assert.equal(dateValue("12345"), null);
});
test("duplicate and empty headers keep all cells aligned", () => {
  const ds = createDataset("t", [
    ["a", "a", null],
    ["x", 2, 3],
    ["y", 4, 5, 6],
  ]);
  assert.deepEqual(
    ds.fields.map((f) => f.name),
    ["a", "a (2)", "열 3", "열 4"],
  );
  assert.deepEqual(ds.rows[0], ["x", 2, 3, null]);
});
test("group aggregation sums all duplicates; averages exclude nulls, count includes rows", () => {
  const ds = createDataset("t", [
    ["group", "value", "color"],
    ["A", 10, "x"],
    ["A", 20, "x"],
    ["A", null, "x"],
    ["B", 8, "y"],
  ]);
  assert.deepEqual(buildChart(ds, ds.rows, config(ds)).table, [
    ["group", "value"],
    ["A", 30],
    ["B", 8],
  ]);
  assert.equal(
    buildChart(ds, ds.rows, config(ds, { agg: "mean" })).table[1][1],
    15,
  );
  assert.equal(
    buildChart(ds, ds.rows, config(ds, { agg: "count" })).table[1][1],
    3,
  );
  assert.equal(aggregate([1, 2, 3, 4], "median", 4), 2.5);
  const grouped = buildChart(
    ds,
    ds.rows,
    config(ds, { group: ds.fields[2].id }),
  );
  assert.equal(grouped.table[1][1], 30);
  assert.equal(grouped.table[1][2], null);
});
test("constant histogram and boxplot have finite values; constant correlation stays undefined", () => {
  const ds = createDataset("t", [
    ["cat", "n", "other"],
    ["a", 5, 7],
    ["b", 5, 8],
    ["c", 5, null],
  ]);
  const h = buildChart(ds, ds.rows, config(ds, { type: "histogram" }));
  assert.deepEqual(h.table, [
    ["구간 시작", "구간 끝", "행 수"],
    [5, 5, 3],
  ]);
  assert.ok(!JSON.stringify(h.option).includes("NaN"));
  const box = buildChart(ds, ds.rows, config(ds, { type: "boxplot" }));
  assert.deepEqual(box.table[1], [5, 5, 5, 5, 5, 0]);
  const corr = buildChart(ds, ds.rows, config(ds, { type: "correlation" }));
  assert.equal(corr.table[1][2], null);
});
test("pairwise Pearson excludes missing values and matches known result", () => {
  const ds = createDataset("t", [
    ["x", "y"],
    [1, 2],
    [2, 4],
    [3, 6],
    [null, 9],
    [5, null],
  ]);
  const result = buildChart(ds, ds.rows, config(ds, { type: "correlation" }));
  assert.equal(result.table[2][2], 1);
  assert.equal(result.table[2][3], 3);
});
test("scatter uses actual X-Y pairs, grouping and missing-value exclusion", () => {
  const ds = createDataset("t", [
    ["x", "y", "g"],
    [1, 2, "a"],
    [3, 4, "b"],
    [null, 6, "a"],
  ]);
  const c = config(ds, { type: "scatter", group: ds.fields[2].id });
  const r = buildChart(ds, ds.rows, c);
  assert.equal(r.count, 2);
  assert.deepEqual(r.table.slice(1), [
    [1, 2, "a"],
    [3, 4, "b"],
  ]);
});
test("filters support typed numbers, dates, missing and AND", () => {
  const ds = createDataset("t", [
    ["g", "n", "date"],
    ["a", 1, "2025-01-01"],
    ["a", 3, "2025-02-01"],
    ["b", null, "2025-03-01"],
  ]);
  const f = (field: string, op: any, value = "") => ({
    id: "f",
    field,
    op,
    value,
    end: "",
  });
  assert.equal(
    filtered(ds, [f("f0", "eq", "a"), f("f1", "gt", "2")]).length,
    1,
  );
  assert.equal(filtered(ds, [f("f1", "missing")]).length, 1);
  assert.equal(filtered(ds, [f("f2", "gt", "2025-01-15")]).length, 2);
});
test("transforms preserve original; dedupe/fill/cast/rename/drop/replace work", () => {
  const ds = createDataset("t", [
    ["a", "b"],
    [" x ", 2],
    [" x ", 2],
    ["z", null],
  ]);
  const trimmed = transform(ds, { type: "trim" }).dataset;
  assert.equal(ds.rows[0][0], " x ");
  assert.equal(trimmed.rows[0][0], "x");
  const deduped = transform(trimmed, { type: "dedupe" });
  assert.equal(deduped.affected, 1);
  assert.equal(deduped.dataset.rows.length, 2);
  const filled = transform(ds, { type: "fill", field: "f1", value: "mean" });
  assert.equal(filled.dataset.rows[2][1], 2);
  assert.equal(ds.rows[2][1], null);
  const cast = transform(ds, { type: "cast", field: "f0", value: "number" });
  assert.equal(cast.dataset.fields[0].missing, 3);
  assert.match(cast.message, /3개 값은 빈 값/);
  assert.equal(
    transform(ds, { type: "rename", field: "f0", value: "new" }).dataset
      .fields[0].name,
    "new",
  );
  assert.equal(
    transform(ds, { type: "drop", field: "f0" }).dataset.fields.length,
    1,
  );
  assert.equal(
    transform(ds, { type: "replace", field: "f0", value: "x", extra: "y" })
      .dataset.rows[0][0],
    " y ",
  );
  assert.equal(
    transform(ds, { type: "dropMissing", field: "f1" }).dataset.rows.length,
    2,
  );
});
test("safe formulas handle precedence, nulls and division by zero; stable computed field IDs", () => {
  const ds = createDataset("t", [
    ["a", "b"],
    [10, 2],
    [8, 0],
    [null, 3],
  ]);
  const fn = formula("([a] + 2) / [b]", ds.fields);
  assert.equal(fn(ds.rows[0]), 6);
  assert.equal(fn(ds.rows[1]), null);
  assert.equal(fn(ds.rows[2]), null);
  assert.throws(() => formula("globalThis.alert(1)", ds.fields));
  assert.throws(() => formula("[missing]+1", ds.fields));
  const op = { type: "calculate" as const, value: "ratio", extra: "[a]/[b]" };
  assert.deepEqual(transform(ds, op).dataset, transform(ds, op).dataset);
});
test("JSON nested paths and reserved names do not collide or mutate prototypes", () => {
  const record = JSON.parse(
    '{"a.b":1,"a":{"b":2},"__proto__":{"safe":3},"arr":[1,2]}',
  );
  const m = recordsMatrix([record]);
  assert.ok((m[0] as string[]).includes("a\\.b"));
  assert.ok((m[0] as string[]).includes("a.b"));
  assert.equal(({} as any).safe, undefined);
  assert.equal(flattenObject(record).get("a.b"), 2);
  assert.deepEqual(jsonMatrix({ data: [{ x: 1 }] }, "").matrix, [["x"], [1]]);
  assert.throws(
    () => jsonMatrix({ data: [1], other: [1, 2] }, ""),
    /여러 배열/,
  );
});
test("CSV export escapes quotes, multiline cells, and formula-like text", () => {
  const r = csv([["h"], ["=1+1"], ['a"b\nc'], [-3]]);
  assert.equal(r.escaped, 1);
  assert.ok(r.value.startsWith("\ufeff"));
  assert.ok(r.value.includes('"a""b\nc"'));
  assert.ok(r.value.includes("'=1+1"));
  assert.ok(r.value.endsWith("-3"));
});
test("real CSV handles BOM, Korean, quoted multiline and semicolon locale", async () => {
  const f = new File(
    [
      '\ufeff이름,코드,금액,설명\r\n서울,001,"1,200","줄1\n줄2"\r\n부산,002,300,정상',
    ],
    "sample.CSV",
  );
  const [ds] = await importFile(f, defaultImport);
  assert.equal(ds.rows.length, 2);
  assert.equal(ds.rows[0][1], "001");
  assert.equal(ds.rows[0][2], 1200);
  assert.equal(ds.rows[0][3], "줄1\n줄2");
  const [de] = await importFile(new File(["a;n\nx;1.234,56"], "de.csv"), {
    ...defaultImport,
    decimal: ",",
  });
  assert.equal(de.rows[0][1], 1234.56);
});
test("JSONL error gives original line number; invalid CSV quotes reject instead of skipping", async () => {
  await assert.rejects(
    () => importFile(new File(['{"a":1}\n\nwrong'], "x.jsonl"), defaultImport),
    /3번째/,
  );
  await assert.rejects(
    () => importFile(new File(['a,b\n"unclosed,x'], "x.csv"), defaultImport),
    /읽지 못했습니다/,
  );
});
test("Excel multi-sheet import, dates, sparse cells, legacy XLS and ODS", async () => {
  for (const type of ["xlsx", "xls", "xlsm", "xlsb", "ods"] as const) {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["날짜", "수량"],
        [new Date(Date.UTC(2025, 0, 1)), 12],
        [new Date(Date.UTC(2025, 0, 2)), null],
      ]),
      "First",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["이름", "값"],
        ["테스트", 4],
      ]),
      "Second",
    );
    const content = XLSX.write(wb, { bookType: type, type: "array" });
    const sets = await importFile(
      new File([content], `book.${type}`),
      defaultImport,
    );
    assert.equal(sets.length, 2);
    assert.equal(sets[0].fields[0].kind, "date");
    assert.equal(sets[0].fields[1].missing, 1);
    assert.equal(sets[1].rows[0][0], "테스트");
  }
});
test("limits reject oversize matrices without silently truncating", () => {
  assert.throws(
    () => createDataset("big", [Array(501).fill("h"), Array(501).fill(1)]),
    /한도/,
  );
});

test("legacy Korean CSV, UTF-16 TSV, DBF and headerless matrices", async () => {
  const cp = await import("xlsx/dist/cpexcel.full.mjs");
  const bytes = cp.utils.encode(949, "지역,값\r\n서울,12\r\n부산,8");
  const [korean] = await importFile(
    new File([new Uint8Array(bytes)], "korean.csv"),
    defaultImport,
  );
  assert.equal(korean.rows[0][0], "서울");
  assert.match(korean.notes[0], /EUC-KR/);
  const text = "\ufeff이름\t수량\r\n테스트\t42";
  const u16 = new Uint8Array(text.length * 2);
  for (let i = 0; i < text.length; i++) {
    u16[i * 2] = text.charCodeAt(i) & 255;
    u16[i * 2 + 1] = text.charCodeAt(i) >> 8;
  }
  const [tsv] = await importFile(new File([u16], "x.tsv"), defaultImport);
  assert.deepEqual(tsv.rows[0], ["테스트", 42]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["city", "value"],
      ["Seoul", 12],
    ]),
    "Data",
  );
  const dbf = XLSX.write(wb, { bookType: "dbf", type: "array" });
  const [db] = await importFile(new File([dbf], "x.dbf"), defaultImport);
  assert.deepEqual(db.rows[0], ["Seoul", 12]);
  const [plain] = await importFile(new File(["a,1\nb,2"], "nohead.csv"), {
    ...defaultImport,
    header: false,
  });
  assert.equal(plain.rows.length, 2);
  assert.equal(plain.fields[0].name, "열 1");
});
