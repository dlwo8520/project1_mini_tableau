import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { importFile } from "../src/importers";
import { defaultImport } from "../src/types";
for (const name of [
  "alltypes_plain.parquet",
  "alltypes_plain.snappy.parquet",
  "byte_stream_split.zstd.parquet",
  "byte_stream_split_extended.gzip.parquet",
  "lz4_raw_compressed.parquet",
]) {
  test(`Parquet fixture: ${name}`, async () => {
    const bytes = await readFile(
      new URL(`./fixtures/${name}`, import.meta.url),
    );
    const [ds] = await importFile(new File([bytes], name), defaultImport);
    assert.ok(ds.rows.length > 0);
    assert.ok(ds.fields.length > 0);
    assert.ok(ds.rows.every((r) => r.length === ds.fields.length));
    assert.doesNotThrow(() => JSON.stringify(ds));
  });
}
