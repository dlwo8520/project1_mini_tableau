import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  X,
  Upload,
  FileSpreadsheet,
  SlidersHorizontal,
  Info,
  Check,
  ArrowRight,
  WandSparkles,
} from "lucide-react";
import type { Chart, Filter, ImportOptions, Summary, Transform } from "./types";
import { chartLabel, defaultImport, kindLabel, uid } from "./types";
import { extensions } from "./importers";
import { request } from "./client";
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialog.current) {
          const b = dialog.current.getBoundingClientRect();
          if (
            e.clientX < b.left ||
            e.clientX > b.right ||
            e.clientY < b.top ||
            e.clientY > b.bottom
          )
            onClose();
        }
      }}
    >
      <header className="modal-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button className="icon-button" onClick={onClose} aria-label="닫기">
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function ImportDialog({
  onClose,
  onImport,
  busy,
  error,
  initial,
}: {
  onClose: () => void;
  onImport: (files: File[], options: ImportOptions) => Promise<void>;
  busy: boolean;
  error: string;
  initial?: File[];
}) {
  const [files, setFiles] = useState<File[]>(initial ?? []),
    [options, setOptions] = useState(defaultImport),
    [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <Modal
      title="데이터 가져오기"
      subtitle="파일은 서버로 전송하지 않고 이 브라우저에서 처리합니다."
      onClose={() => !busy && onClose()}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onImport(files, options);
        }}
      >
        <button
          type="button"
          className={`import-drop ${over ? "over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            setFiles([...e.dataTransfer.files]);
          }}
          onClick={() => input.current?.click()}
          disabled={busy}
        >
          <div className="upload-orb">
            <Upload size={24} />
          </div>
          <strong>
            {files.length
              ? `${files.length}개 파일 선택됨`
              : "파일을 놓거나 클릭하여 선택"}
          </strong>
          <span>CSV · TSV · Excel · JSON · JSONL · Parquet · ODS · DBF</span>
          <small>파일당 50MB · 10만 행 · 500열 · 200만 셀</small>
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept={extensions}
          hidden
          onChange={(e) => setFiles([...(e.target.files ?? [])])}
        />
        {files.length > 0 && (
          <ul className="file-list">
            {files.map((f, i) => (
              <li key={i}>
                <FileSpreadsheet size={17} />
                <span>{f.name}</span>
                <small>{(f.size / 1024).toFixed(1)} KB</small>
              </li>
            ))}
          </ul>
        )}
        <details className="import-options">
          <summary>
            <SlidersHorizontal size={16} />
            가져오기 설정
          </summary>
          <div className="form-grid">
            <label>
              텍스트 인코딩
              <select
                value={options.encoding}
                onChange={(e) =>
                  setOptions({ ...options, encoding: e.target.value })
                }
              >
                <option value="auto">자동 (UTF-8 → EUC-KR)</option>
                <option value="utf-8">UTF-8</option>
                <option value="euc-kr">EUC-KR / Windows-949</option>
                <option value="utf-16le">UTF-16 LE</option>
                <option value="utf-16be">UTF-16 BE</option>
                <option value="shift_jis">Shift JIS</option>
                <option value="gb18030">GB18030</option>
                <option value="windows-1252">Windows-1252</option>
              </select>
            </label>
            <label>
              구분자
              <select
                value={options.delimiter}
                onChange={(e) =>
                  setOptions({ ...options, delimiter: e.target.value })
                }
              >
                <option value="">자동 감지</option>
                <option value=",">쉼표 (,)</option>
                <option value={"\t"}>탭</option>
                <option value=";">세미콜론 (;)</option>
                <option value="|">파이프 (|)</option>
              </select>
            </label>
            <label>
              소수점
              <select
                value={options.decimal}
                onChange={(e) =>
                  setOptions({
                    ...options,
                    decimal: e.target.value as "." | ",",
                  })
                }
              >
                <option value=".">마침표 (1,234.56)</option>
                <option value=",">쉼표 (1.234,56)</option>
              </select>
            </label>
            <label>
              JSON 배열 경로
              <input
                value={options.jsonPath}
                onChange={(e) =>
                  setOptions({ ...options, jsonPath: e.target.value })
                }
                placeholder="예: response.data"
              />
            </label>
          </div>
          <label className="check-row">
            <input
              type="checkbox"
              checked={options.header}
              onChange={(e) =>
                setOptions({ ...options, header: e.target.checked })
              }
            />
            첫 번째 행을 열 이름으로 사용
          </label>
          <p className="form-help">
            JSON 객체의 키는 항상 열 이름으로 사용합니다. Excel의 비어 있지 않은
            모든 시트를 불러옵니다. 암호화 파일은 암호를 해제해 주세요.
          </p>
        </details>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <span className="muted">
            <Info size={14} />
            데이터는 탭을 닫으면 사라집니다.
          </span>
          <button className="button primary" disabled={!files.length || busy}>
            {busy ? "분석하고 있어요…" : "가져와서 분석하기"}
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function ChartDialog({
  dataset,
  chart,
  onClose,
  onSave,
}: {
  dataset: Summary;
  chart?: Chart;
  onClose: () => void;
  onSave: (c: Chart) => void;
}) {
  const nums = dataset.fields.filter((f) => f.kind === "number");
  const [c, setC] = useState<Chart>(
    chart ?? {
      id: uid(),
      title: "새 차트",
      type: "bar",
      x: dataset.fields[0].id,
      y: nums[0]?.id ?? "",
      group: "",
      agg: nums.length ? "sum" : "count",
      bucket: "none",
      limit: 12,
      horizontal: false,
      labels: false,
      palette: "blue",
    },
  );
  const set = (key: keyof Chart, value: unknown) => {
    if (key === "type" && value === "scatter")
      setC({
        ...c,
        type: "scatter",
        x: nums[0]?.id ?? "",
        y: nums[1]?.id ?? nums[0]?.id ?? "",
      });
    else if (key === "type" && (value === "histogram" || value === "boxplot"))
      setC({ ...c, type: value, y: c.y || nums[0]?.id || "" });
    else if (key === "type" && value === "donut")
      setC({ ...c, type: "donut", group: "" });
    else setC({ ...c, [key]: value });
  };
  const needX = !["histogram", "boxplot", "correlation"].includes(c.type),
    needY =
      c.type !== "correlation" &&
      (c.agg !== "count" ||
        ["histogram", "boxplot", "scatter"].includes(c.type));
  return (
    <Modal
      title={chart ? "차트 편집" : "새 차트 만들기"}
      subtitle="열과 집계 방식을 골라 데이터의 다른 면을 살펴보세요."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(c);
        }}
      >
        <div className="chart-types">
          {Object.entries(chartLabel).map(([key, label]) => (
            <button
              type="button"
              className={c.type === key ? "selected" : ""}
              key={key}
              onClick={() => set("type", key)}
            >
              {label}
              {c.type === key && <Check size={13} />}
            </button>
          ))}
        </div>
        <div className="form-grid">
          <label className="full">
            차트 제목
            <input
              value={c.title}
              required
              maxLength={100}
              onChange={(e) => set("title", e.target.value)}
            />
          </label>
          {needX && (
            <label>
              X축 / 범주
              <select value={c.x} onChange={(e) => set("x", e.target.value)}>
                {dataset.fields
                  .filter((f) => c.type !== "scatter" || f.kind === "number")
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {needY && (
            <label>
              숫자 열 (Y축)
              <select
                required
                value={c.y}
                onChange={(e) => set("y", e.target.value)}
              >
                <option value="">선택하세요</option>
                {nums.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!["histogram", "boxplot", "scatter", "correlation"].includes(
            c.type,
          ) && (
            <label>
              집계 방식
              <select
                value={c.agg}
                onChange={(e) => set("agg", e.target.value)}
              >
                <option value="sum">합계</option>
                <option value="mean">평균</option>
                <option value="median">중앙값</option>
                <option value="count">행 수</option>
                <option value="min">최솟값</option>
                <option value="max">최댓값</option>
              </select>
            </label>
          )}
          {["bar", "line", "area", "scatter"].includes(c.type) && (
            <label>
              색상 그룹
              <select
                value={c.group}
                onChange={(e) => set("group", e.target.value)}
              >
                <option value="">그룹 없이</option>
                {dataset.fields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.unique})
                  </option>
                ))}
              </select>
            </label>
          )}
          {needX && c.type !== "scatter" && (
            <>
              <label>
                날짜 묶기
                <select
                  value={c.bucket}
                  onChange={(e) => set("bucket", e.target.value)}
                >
                  <option value="none">원래 값</option>
                  <option value="day">일별</option>
                  <option value="month">월별</option>
                  <option value="year">연별</option>
                </select>
              </label>
              <label>
                표시할 범주 수
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={c.limit}
                  onChange={(e) =>
                    set(
                      "limit",
                      Math.min(500, Math.max(1, Number(e.target.value))),
                    )
                  }
                />
              </label>
            </>
          )}
          <label>
            색상 팔레트
            <select
              value={c.palette}
              onChange={(e) => set("palette", e.target.value)}
            >
              <option value="blue">블루 스튜디오</option>
              <option value="ocean">오션</option>
              <option value="violet">블루 바이올렛</option>
            </select>
          </label>
        </div>
        <div className="check-options">
          {c.type === "bar" && (
            <label className="check-row">
              <input
                type="checkbox"
                checked={c.horizontal}
                onChange={(e) => set("horizontal", e.target.checked)}
              />
              가로 막대
            </label>
          )}
          <label className="check-row">
            <input
              type="checkbox"
              checked={c.labels}
              onChange={(e) => set("labels", e.target.checked)}
            />
            값 표시
          </label>
        </div>
        <p className="form-help">
          막대·도넛은 집계값 내림차순, 날짜·선·영역은 X축 순서로 표시합니다.
          필터는 모든 차트에 함께 적용됩니다.
        </p>
        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>
            취소
          </button>
          <button className="button primary">
            {chart ? "변경 적용" : "차트 추가"}
            <Check size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function FilterDialog({
  dataset,
  onClose,
  onSave,
}: {
  dataset: Summary;
  onClose: () => void;
  onSave: (f: Filter) => void;
}) {
  const [f, setF] = useState<Filter>({
    id: uid(),
    field: dataset.fields[0].id,
    op: "eq",
    value: "",
    end: "",
  });
  return (
    <Modal
      title="데이터 필터"
      subtitle="원본을 바꾸지 않고 분석할 범위만 좁힙니다."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(f);
        }}
      >
        <div className="form-grid">
          <label>
            대상 열
            <select
              value={f.field}
              onChange={(e) => setF({ ...f, field: e.target.value })}
            >
              {dataset.fields.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {kindLabel[c.kind]}
                </option>
              ))}
            </select>
          </label>
          <label>
            조건
            <select
              value={f.op}
              onChange={(e) =>
                setF({ ...f, op: e.target.value as Filter["op"] })
              }
            >
              <option value="eq">같음</option>
              <option value="ne">같지 않음</option>
              <option value="contains">텍스트 포함</option>
              <option value="gt">보다 큼 / 이후</option>
              <option value="lt">보다 작음 / 이전</option>
              <option value="between">범위 (양 끝 포함)</option>
              <option value="missing">빈 값</option>
              <option value="present">빈 값 아님</option>
            </select>
          </label>
          {!["missing", "present"].includes(f.op) && (
            <label className="full">
              값
              <input
                required
                value={f.value}
                onChange={(e) => setF({ ...f, value: e.target.value })}
                placeholder="날짜는 YYYY-MM-DD"
                list="filter-values"
              />
              <datalist id="filter-values">
                {dataset.fields
                  .find((c) => c.id === f.field)
                  ?.examples.map((v) => (
                    <option key={v} value={v} />
                  ))}
              </datalist>
            </label>
          )}
          {f.op === "between" && (
            <label className="full">
              범위 끝
              <input
                required
                value={f.end}
                onChange={(e) => setF({ ...f, end: e.target.value })}
              />
            </label>
          )}
        </div>
        <p className="form-help">
          여러 필터는 모두 만족하는 행만 남깁니다 (AND).
        </p>
        <div className="modal-actions">
          <button className="button" type="button" onClick={onClose}>
            취소
          </button>
          <button className="button primary">필터 적용</button>
        </div>
      </form>
    </Modal>
  );
}
const transformNames: Record<Transform["type"], string> = {
  trim: "공백 정리",
  dedupe: "중복 행 제거",
  dropMissing: "빈 값 행 제거",
  fill: "빈 값 채우기",
  cast: "자료형 변환",
  rename: "열 이름 변경",
  drop: "열 삭제",
  replace: "찾아 바꾸기",
  calculate: "계산 열 추가",
};
export function TransformDialog({
  dataset,
  initial,
  onClose,
  onApply,
}: {
  dataset: Summary;
  initial?: Transform;
  onClose: () => void;
  onApply: (o: Transform) => Promise<void>;
}) {
  const [op, setOp] = useState<Transform>(
      initial ?? {
        type: "trim",
        field: dataset.fields[0].id,
        value: "",
        extra: "",
      },
    ),
    [preview, setPreview] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const change = (v: Partial<Transform>) => {
    setOp({ ...op, ...v });
    setPreview(null);
    setError("");
  };
  const inspect = async () => {
    setBusy(true);
    setError("");
    try {
      setPreview(
        await request("transform", {
          id: dataset.id,
          operation: op,
          preview: true,
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title="데이터 다듬기"
      subtitle="변경 내용을 먼저 확인하고 적용하세요. 적용 후에도 되돌릴 수 있습니다."
      onClose={onClose}
    >
      <div className="form-grid">
        <label className="full">
          작업
          <select
            value={op.type}
            onChange={(e) =>
              change({
                type: e.target.value as Transform["type"],
                value:
                  e.target.value === "fill"
                    ? "mode"
                    : e.target.value === "cast"
                      ? "number"
                      : "",
                extra: "",
              })
            }
          >
            {Object.entries(transformNames).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {!["trim", "dedupe", "calculate"].includes(op.type) && (
          <label className="full">
            대상 열
            <select
              value={op.field}
              onChange={(e) => change({ field: e.target.value })}
            >
              {dataset.fields.map((f) => (
                <option value={f.id} key={f.id}>
                  {f.name} · {kindLabel[f.kind]}
                </option>
              ))}
            </select>
          </label>
        )}
        {op.type === "fill" && (
          <label className="full">
            채우는 방식
            <select
              value={op.value}
              onChange={(e) => change({ value: e.target.value })}
            >
              <option value="mode">최빈값</option>
              <option value="mean">평균 (숫자)</option>
              <option value="median">중앙값 (숫자)</option>
              <option value="custom">직접 입력</option>
            </select>
          </label>
        )}
        {op.type === "cast" && (
          <label className="full">
            새 자료형
            <select
              value={op.value}
              onChange={(e) => change({ value: e.target.value })}
            >
              {Object.entries(kindLabel).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        )}
        {["rename", "calculate", "replace"].includes(op.type) && (
          <label className="full">
            {op.type === "replace" ? "찾을 문자열" : "새 열 이름"}
            <input
              value={op.value}
              onChange={(e) => change({ value: e.target.value })}
            />
          </label>
        )}
        {(op.type === "replace" ||
          op.type === "calculate" ||
          (op.type === "fill" && op.value === "custom")) && (
          <label className="full">
            {op.type === "calculate"
              ? "수식"
              : op.type === "replace"
                ? "바꿀 문자열"
                : "채움 값"}
            <input
              value={op.extra}
              onChange={(e) => change({ extra: e.target.value })}
              placeholder={
                op.type === "calculate" ? "예: [매출] / [주문 수]" : ""
              }
            />
          </label>
        )}
      </div>
      <p className="form-help">
        {op.type === "dedupe"
          ? "모든 열의 값이 완전히 같은 행을 제거하고 첫 번째 행을 남깁니다."
          : op.type === "trim"
            ? "모든 텍스트의 앞뒤 공백을 제거합니다. 공백만 있는 셀은 빈 값으로 바꿉니다."
            : op.type === "cast"
              ? "변환할 수 없는 값은 빈 값이 됩니다. 날짜는 YYYY-MM-DD, 참/거짓은 true / false / 1 / 0을 지원합니다."
              : op.type === "calculate"
                ? "숫자와 [열 이름], + - * / ( )를 사용합니다. 빈 값과 0으로 나누는 결과는 빈 값이 됩니다."
                : "선택한 열 전체에 적용됩니다. 현재 화면의 필터는 전처리 범위를 바꾸지 않습니다."}
      </p>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {preview && (
        <>
          <div className="preview-box">
            <Check size={19} />
            <div>
              <strong>{preview.message}</strong>
              <p>
                적용 후 {preview.rowCount.toLocaleString()}행 ·{" "}
                {preview.fields.length}열
              </p>
            </div>
          </div>
          <details className="preview-rows">
            <summary>적용 후 첫 5행 보기</summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {preview.fields.map((f: { id: string; name: string }) => (
                      <th key={f.id}>{f.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row: unknown[], i: number) => (
                    <tr key={i}>
                      {row.map((v, j) => (
                        <td key={j}>
                          {v == null ? (
                            <span className="null-cell">빈 값</span>
                          ) : (
                            String(v)
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
      <div className="modal-actions">
        <button className="button" onClick={inspect} disabled={busy}>
          <WandSparkles size={16} />
          {busy ? "계산 중…" : "변경 미리 확인"}
        </button>
        <button
          className="button primary"
          disabled={!preview || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onApply(op);
            } catch (e) {
              setError((e as Error).message);
              setBusy(false);
            }
          }}
        >
          확인한 변경 적용
          <ArrowRight size={16} />
        </button>
      </div>
    </Modal>
  );
}
