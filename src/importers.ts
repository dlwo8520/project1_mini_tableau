import Papa from "papaparse";
import { checkSize, createDataset, MAX_ROWS, normalizeCell } from "./engine";
import type { Dataset, ImportOptions } from "./types";
export const extensions =
  ".csv,.tsv,.txt,.xlsx,.xls,.xlsm,.xlsb,.ods,.json,.jsonl,.ndjson,.parquet,.dbf";
export function flattenObject(
  value: unknown,
  prefix = "",
  result = new Map<string, unknown>(),
): Map<string, unknown> {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !(value instanceof Uint8Array)
  ) {
    for (const [key, child] of Object.entries(value)) {
      // Escape actual dots and backslashes, so nested keys cannot overwrite literal dotted keys.
      const path = prefix
        ? `${prefix}.${key.replace(/\\/g, "\\\\").replace(/\./g, "\\.")}`
        : key.replace(/\\/g, "\\\\").replace(/\./g, "\\.");
      if (
        child !== null &&
        typeof child === "object" &&
        !Array.isArray(child) &&
        !(child instanceof Date) &&
        !(child instanceof Uint8Array)
      )
        flattenObject(child, path, result);
      else result.set(path, child);
    }
  } else result.set(prefix || "값", value);
  return result;
}
export function recordsMatrix(records: unknown[]): unknown[][] {
  if (!records.length) throw new Error("데이터 배열이 비어 있습니다.");
  if (records.every(Array.isArray)) return records as unknown[][];
  const flat = records.map((r) => flattenObject(r)),
    keys = [...new Set(flat.flatMap((r) => [...r.keys()]))];
  checkSize(records.length, keys.length);
  return [keys, ...flat.map((r) => keys.map((k) => normalizeCell(r.get(k))))];
}
export function jsonMatrix(
  data: unknown,
  path: string,
): { matrix: unknown[][]; header: boolean; note: string } {
  if (path) {
    for (const key of path.split(".")) {
      if (data === null || typeof data !== "object" || !(key in data))
        throw new Error(`JSON 경로를 찾을 수 없습니다: ${path}`);
      data = (data as Record<string, unknown>)[key];
    }
  }
  let note = "";
  if (!Array.isArray(data) && data !== null && typeof data === "object") {
    const entries = Object.entries(data);
    const candidates = entries.filter(([, v]) => Array.isArray(v));
    if (candidates.length === 1) {
      data = candidates[0][1];
      note = `JSON의 ${candidates[0][0]} 배열을 불러왔습니다.`;
    } else if (
      candidates.length > 1 &&
      candidates.length === entries.length &&
      candidates.every(
        ([, v]) =>
          (v as unknown[]).length === (candidates[0][1] as unknown[]).length,
      )
    ) {
      return {
        matrix: [
          entries.map(([k]) => k),
          ...Array.from(
            { length: (candidates[0][1] as unknown[]).length },
            (_, i) => entries.map(([, v]) => (v as unknown[])[i]),
          ),
        ],
        header: true,
        note: "열 단위 배열을 표로 변환했습니다.",
      };
    } else if (candidates.length > 1)
      throw new Error(
        `여러 배열이 있습니다 (${candidates.map(([k]) => k).join(", ")}). 가져오기 설정의 JSON 경로를 지정해 주세요.`,
      );
    else data = [data];
  }
  const records: unknown[] = Array.isArray(data) ? data : [data];
  const matrix = recordsMatrix(records);
  return { matrix, header: !records.every(Array.isArray), note };
}
async function spreadsheet() {
  const XLSX = await import("xlsx");
  const cptable = await import("xlsx/dist/cpexcel.full.mjs");
  XLSX.set_cptable(cptable);
  return XLSX;
}
export async function importFile(
  file: File,
  options: ImportOptions,
): Promise<Dataset[]> {
  if (file.size > 50 * 1024 * 1024)
    throw new Error(
      "파일당 50MB까지 지원합니다. 필요한 부분만 나누어 올려 주세요.",
    );
  if (!file.size) throw new Error("파일이 비어 있습니다.");
  const ext = file.name.split(".").at(-1)?.toLowerCase();
  const notes: string[] = [];
  if (["xlsx", "xls", "xlsm", "xlsb", "ods", "dbf"].includes(ext ?? "")) {
    const XLSX = await spreadsheet();
    const wb = XLSX.read(await file.arrayBuffer(), {
      type: "array",
      dense: true,
      cellDates: true,
      sheetRows: MAX_ROWS + 2,
    });
    const datasets: Dataset[] = [];
    let cells = 0;
    for (const name of wb.SheetNames) {
      const sheet = wb.Sheets[name];
      if (!sheet["!ref"]) continue;
      const range = XLSX.utils.decode_range(sheet["!fullref"] ?? sheet["!ref"]);
      checkSize(range.e.r - (options.header ? 1 : 0) + 1, range.e.c + 1);
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: null,
        raw: true,
        blankrows: false,
      });
      if (matrix.length < (options.header ? 2 : 1)) continue;
      const ds = createDataset(
        wb.SheetNames.length > 1 ? `${file.name} · ${name}` : file.name,
        matrix,
        options.header,
        options.decimal,
      );
      cells += ds.rows.length * ds.fields.length;
      if (cells > 2_000_000)
        throw new Error(
          "여러 시트를 합친 셀 수가 200만 개를 넘었습니다. 필요한 시트만 별도 파일로 저장해 주세요.",
        );
      ds.notes.push(
        "수식은 파일에 저장된 계산 결과를 읽습니다. 브라우저에서 재계산하지 않습니다.",
      );
      datasets.push(ds);
    }
    if (!datasets.length)
      throw new Error(
        "읽을 수 있는 시트가 없습니다. 암호화 파일은 암호를 해제한 뒤 올려 주세요.",
      );
    return datasets;
  }
  if (ext === "parquet") {
    const { parquetMetadataAsync, parquetReadObjects } =
      await import("hyparquet");
    const { compressors } = await import("hyparquet-compressors");
    const source = {
      byteLength: file.size,
      slice: (start: number, end?: number) =>
        file.slice(start, end).arrayBuffer(),
    };
    const metadata = await parquetMetadataAsync(source);
    checkSize(
      Number(metadata.num_rows),
      Math.max(1, metadata.schema.length - 1),
    );
    const rows = await parquetReadObjects({ file: source, compressors });
    const ds = createDataset(
      file.name,
      recordsMatrix(rows),
      true,
      options.decimal,
    );
    ds.notes.push(
      "Parquet의 INT64는 문자열로 보존합니다. DECIMAL은 JavaScript 숫자 정밀도, 타임스탬프는 밀리초 정밀도를 따릅니다. BSON·INTERVAL은 지원하지 않습니다.",
    );
    return [ds];
  }
  if (!["csv", "tsv", "txt", "json", "jsonl", "ndjson"].includes(ext ?? ""))
    throw new Error(
      "지원하지 않는 형식입니다. CSV · TSV · Excel · ODS · JSON · JSONL · Parquet · DBF 파일을 사용해 주세요.",
    );
  const bytes = await file.arrayBuffer();
  let text: string;
  if (options.encoding === "auto") {
    const a = new Uint8Array(bytes);
    const encoding =
      a[0] === 255 && a[1] === 254
        ? "utf-16le"
        : a[0] === 254 && a[1] === 255
          ? "utf-16be"
          : "utf-8";
    try {
      text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
    } catch {
      try {
        text = new TextDecoder("euc-kr", { fatal: true }).decode(bytes);
        notes.push(
          "UTF-8로 읽을 수 없어 EUC-KR로 읽었습니다. 글자가 깨졌다면 인코딩을 직접 선택해 주세요.",
        );
      } catch {
        throw new Error(
          "텍스트 인코딩을 확인할 수 없습니다. 가져오기 설정에서 인코딩을 선택해 주세요.",
        );
      }
    }
  } else
    text = new TextDecoder(options.encoding, { fatal: true }).decode(bytes);
  text = text.replace(/^\ufeff/, "");
  let matrix: unknown[][],
    header = options.header;
  if (ext === "json" || ext === "jsonl" || ext === "ndjson") {
    let data: unknown;
    if (ext === "json") {
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          "JSON 문법을 확인해 주세요. 파일 전체가 유효한 JSON이어야 합니다.",
        );
      }
    } else {
      data = text.split(/\r?\n/).flatMap((line, i) => {
        if (!line.trim()) return [];
        try {
          return [JSON.parse(line)];
        } catch {
          throw new Error(
            `JSONL ${i + 1}번째 줄의 JSON 문법이 올바르지 않습니다.`,
          );
        }
      });
    }
    const parsed = jsonMatrix(data, options.jsonPath);
    matrix = parsed.matrix;
    header = parsed.header ? true : options.header;
    if (parsed.note) notes.push(parsed.note);
    notes.push(
      "중첩 객체는 경로 이름으로 펼치고 배열은 JSON 문자열로 보존합니다. 큰 정수 ID는 원본 JSON에서 문자열이어야 정밀도를 보존합니다.",
    );
  } else {
    const parsed = Papa.parse<string[]>(text, {
      header: false,
      dynamicTyping: false,
      skipEmptyLines: "greedy",
      delimiter: options.delimiter || (ext === "tsv" ? "\t" : ""),
      preview: MAX_ROWS + 2,
    });
    const serious = parsed.errors.filter(
      (e) => e.code !== "UndetectableDelimiter",
    );
    if (serious.length)
      throw new Error(
        `구분자 파일을 읽지 못했습니다: ${serious[0].message} (줄 ${(serious[0].row ?? 0) + 1})`,
      );
    if (parsed.meta.truncated)
      throw new Error("10만 행을 넘는 파일입니다. 파일을 나누어 주세요.");
    matrix = parsed.data;
    const widths = new Set(matrix.map((r) => r.length));
    if (widths.size > 1)
      notes.push(
        "행마다 열 수가 다릅니다. 가장 긴 행에 맞춰 부족한 셀을 빈 값으로 채웠습니다.",
      );
    if (parsed.errors.some((e) => e.code === "UndetectableDelimiter"))
      notes.push(
        "구분자가 없는 한 열짜리 표로 읽었습니다. 필요하면 구분자를 직접 선택하세요.",
      );
  }
  const ds = createDataset(file.name, matrix, header, options.decimal);
  ds.notes.push(...notes);
  return [ds];
}
export { spreadsheet };
