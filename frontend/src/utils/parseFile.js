/* utils/parseFile.js
   CSV → PapaParse
   XLSX → ExcelJS  (SheetJS 대체)
*/
import ExcelJS from "exceljs";        // alias 덕분에 브라우저 번들로 resolve
import Papa from "papaparse";



/** 파일을 읽어서 { cols, rows } 반환
    cols: [{ name, dtype }],  rows: [{ col: value, … }]
*/
export async function parseFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();

  /* ───────── CSV ───────── */
  if (ext === "csv") {
    const text = await file.text();
    const { data } = Papa.parse(text, { header: true });
    return shape(data);
  }

  /* ───────── Excel (.xlsx / .xlsm) ───────── */
  const buf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);

  const ws = wb.worksheets[0];
  if (!ws) return { cols: [], rows: [] };

  // ① 헤더 추출 (1행)
  const headers = ws.getRow(1).values.slice(1); // values[0] == null
  // ② 데이터 행 객체 배열 만들기
  const rows = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r).values.slice(1);
    const obj = {};
    headers.forEach((h, i) => (obj[h] = row[i]));
    rows.push(obj);
  }
  return shape(rows);

  /* ───────── 헬퍼 ───────── */
  function shape(rows) {
    const first = rows[0] || {};
    const cols = Object.keys(first).map(k => ({
      name: k,
      dtype: typeof first[k] === "number" ? "number" : "object",
    }));
    return { cols, rows };
  }
}
