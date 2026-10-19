import test from "node:test";
import assert from "node:assert/strict";
import {
  buildChart,
  createDataset,
  defaultAggregation,
  histogramBins,
  isIdentifierName,
  recommendations,
  transform,
} from "../src/engine";
import type { Chart } from "../src/types";
// Synthetic, Iris-shaped observations test recommendation policy without a network dependency.
function iris(includeId = true) {
  const matrix: unknown[][] = [
    [
      "Id",
      "SepalLengthCm",
      "SepalWidthCm",
      "PetalLengthCm",
      "PetalWidthCm",
      "Species",
    ],
  ];
  for (let i = 0; i < 150; i++) {
    const group = Math.floor(i / 50);
    matrix.push([
      i + 1,
      5 + group + (i % 5) * 0.1,
      3 + (i % 7) * 0.1,
      1 + group * 2 + (i % 9) * 0.1,
      0.2 + group * 0.7 + (i % 4) * 0.1,
      ["setosa", "versicolor", "virginica"][group],
    ]);
  }
  return createDataset(
    "iris-like.csv",
    includeId ? matrix : matrix.map((r) => r.slice(1)),
  );
}
test("identifier names are token based, not substrings or mere numeric uniqueness", () => {
  for (const name of [
    "Id",
    "OrderID",
    "user_id",
    "record.index",
    "Unnamed: 0",
    "rowNumber",
    "sample_number",
    "고객번호",
    "순번",
  ])
    assert.equal(isIdentifierName(name), true, name);
  for (const name of [
    "humidity",
    "valid",
    "grid",
    "width",
    "liquid",
    "total count",
    "종류",
  ])
    assert.equal(isIdentifierName(name), false, name);
  const ds = createDataset("measure", [
    ["temperature"],
    ...Array.from({ length: 150 }, (_, i) => [i + 0.125]),
  ]);
  assert.equal(ds.fields[0].identifier, false);
  assert.ok(recommendations(ds).some((c) => c.y === ds.fields[0].id));
});
test("Iris-style data with or without Id suggests three species counts, means and real measurements", () => {
  for (const withId of [true, false]) {
    const ds = iris(withId),
      charts = recommendations(ds),
      species = ds.fields.find((f) => f.name === "Species")!;
    assert.equal(charts.length, 4);
    const id = ds.fields.find((f) => f.name === "Id");
    if (id) {
      assert.equal(id.identifier, true);
      assert.ok(charts.every((c) => ![c.x, c.y, c.group].includes(id.id)));
      assert.equal(ds.rows[149][0], 150);
    }
    const counts = charts.find((c) => c.type === "bar" && c.agg === "count")!;
    assert.equal(counts.x, species.id);
    const table = buildChart(ds, ds.rows, counts).table;
    assert.equal(table.length, 4);
    assert.deepEqual(
      table.slice(1).map((r) => r[1]),
      [50, 50, 50],
    );
    const means = charts.find((c) => c.type === "bar" && c.agg === "mean")!;
    assert.equal(
      ds.fields.find((f) => f.id === means.y)?.name,
      "SepalLengthCm",
    );
    const meanTable = buildChart(ds, ds.rows, means).table;
    assert.equal(meanTable.length, 4);
    assert.ok(
      Math.abs((meanTable.find((r) => r[0] === "setosa")![1] as number) - 5.2) <
        1e-10,
    );
    const scatter = charts.find((c) => c.type === "scatter")!;
    assert.equal(scatter.group, species.id);
    assert.equal(buildChart(ds, ds.rows, scatter).count, 150);
    const hist = buildChart(
      ds,
      ds.rows,
      charts.find((c) => c.type === "histogram")!,
    );
    assert.ok(hist.table.length - 1 <= 12);
    assert.equal(
      hist.table.slice(1).reduce((n, r) => n + (r[2] as number), 0),
      150,
    );
  }
});
test("sum is suggested for additive business names, mean for measurements and unknown quantities", () => {
  for (const name of [
    "SepalLengthCm",
    "temperature",
    "weight",
    "unit_price",
    "total_length",
    "revenue_growth_rate",
    "value",
    "만족도",
    "비율",
  ])
    assert.equal(defaultAggregation({ name }), "mean", name);
  for (const name of [
    "Sales",
    "Revenue",
    "OrderCount",
    "수량",
    "광고비",
    "매출",
  ])
    assert.equal(defaultAggregation({ name }), "sum", name);
  const ds = createDataset("sales", [
    ["Id", "region", "revenue"],
    [1, "a", 100],
    [2, "a", 200],
    [3, "b", 500],
  ]);
  assert.equal(recommendations(ds).find((c) => c.type === "bar")?.agg, "sum");
});
test("constant and sparse distributions are compact; explicit histogram bins keep every record", () => {
  assert.equal(histogramBins([]), 1);
  assert.equal(histogramBins([5, 5, 5], 50), 1);
  assert.ok(histogramBins([1, 1, 1, 1, 2]) <= 2);
  const ds = iris();
  const base = recommendations(ds).find((c) => c.type === "histogram")!;
  for (const bins of [1, 5, 8, 50]) {
    const result = buildChart(ds, ds.rows, { ...base, bins });
    assert.equal(result.table.length - 1, bins);
    assert.equal(
      result.table.slice(1).reduce((n, r) => n + (r[2] as number), 0),
      150,
    );
    assert.match(result.note, new RegExp(`지정 ${bins}구간`));
  }
  assert.equal(histogramBins([1, 2, 3], 1000), 50);
});

test("constant revenue still sums and classification measurements are not mistaken for class codes", () => {
  const sales = createDataset("constant-sales", [
    ["Id", "region", "revenue"],
    [1, "a", 100],
    [2, "a", 100],
    [3, "b", 100],
  ]);
  const chart = recommendations(sales).find((c) => c.type === "bar")!;
  assert.equal(chart.agg, "sum");
  assert.deepEqual(buildChart(sales, sales.rows, chart).table, [
    ["region", "revenue"],
    ["a", 200],
    ["b", 100],
  ]);
  const measured = createDataset("classification", [
    ["species", "classificationAccuracy"],
    ["a", 0.8],
    ["b", 0.9],
    ["a", 0.7],
  ]);
  assert.equal(
    recommendations(measured).find((c) => c.agg === "mean")?.y,
    measured.fields[1].id,
  );
});
test("histogram interval boundaries stay left-closed despite floating-point division", () => {
  const ds = createDataset("boundaries", [["length"], [4.3], [6.1], [7.9]]);
  const chart = {
    ...recommendations(ds)[0],
    type: "histogram",
    y: ds.fields[0].id,
    bins: 8,
  } as Chart;
  const result = buildChart(ds, ds.rows, chart);
  assert.equal(result.table[4][2], 0); // [5.65, 6.1)
  assert.equal(result.table[5][2], 1); // [6.1, 6.55)
  assert.equal(result.table.at(-1)![1], 7.9);
  assert.equal(
    result.table.slice(1).reduce((n, r) => n + Number(r[2]), 0),
    3,
  );
});

test("correlation excludes ID by default; explicit selection and override remain possible", () => {
  const ds = iris();
  const base = recommendations(ds)[0];
  const corr = { ...base, type: "correlation" } as Chart;
  const standard = buildChart(ds, ds.rows, corr);
  assert.equal(standard.table.length, 17);
  assert.ok(
    standard.table.slice(1).every((r) => r[0] !== "Id" && r[1] !== "Id"),
  );
  assert.equal(
    buildChart(ds, ds.rows, { ...corr, includeIdentifiers: true }).table.length,
    26,
  );
  const manual = buildChart(ds, ds.rows, {
    ...base,
    y: ds.fields[0].id,
    agg: "sum",
  });
  assert.equal(
    manual.table.slice(1).reduce((n, r) => n + (r[1] as number), 0),
    11325,
  );
});
test("numeric category codes are grouped, ID-only files do not get meaningless recommendations, rename re-evaluates identity", () => {
  const ds = createDataset("coded", [
    ["record_id", "class", "height"],
    [1, 0, 10],
    [2, 0, 20],
    [3, 1, 30],
    [4, 1, 40],
  ]);
  const charts = recommendations(ds);
  assert.equal(charts[0].agg, "count");
  assert.equal(charts[0].x, ds.fields[1].id);
  assert.equal(charts[1].y, ds.fields[2].id);
  const onlyId = createDataset("ids", [["Id"], [1], [2], [3]]);
  assert.deepEqual(recommendations(onlyId), []);
  assert.equal(
    transform(onlyId, {
      type: "rename",
      field: onlyId.fields[0].id,
      value: "measurement",
    }).dataset.fields[0].identifier,
    false,
  );
});
