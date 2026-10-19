import { performance } from "node:perf_hooks";
import {
  createDataset,
  buildChart,
  recommendations,
  transform,
} from "../src/engine";
const start = performance.now();
const matrix: unknown[][] = [
  ["date", "region", "revenue", "orders", "cost", "id"],
];
for (let i = 0; i < 100000; i++)
  matrix.push([
    `2025-${String((i % 12) + 1).padStart(2, "0")}-01`,
    ["Seoul", "Busan", "Jeju"][i % 3],
    i % 10000,
    (i % 80) + 1,
    i % 2000,
    `ID${i}`,
  ]);
const parsed = performance.now();
const ds = createDataset("100k rows", matrix);
const profile = performance.now();
for (const config of recommendations(ds)) buildChart(ds, ds.rows, config);
const charts = performance.now();
transform(ds, { type: "dedupe" });
const end = performance.now();
console.log(
  JSON.stringify({
    rows: ds.rows.length,
    cells: ds.rows.length * ds.fields.length,
    generateMs: Math.round(parsed - start),
    profileMs: Math.round(profile - parsed),
    fourChartsMs: Math.round(charts - profile),
    dedupeMs: Math.round(end - charts),
  }),
);
