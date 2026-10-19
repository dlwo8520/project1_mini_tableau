import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Columns3,
  Database,
  FileSpreadsheet,
  Filter as FilterIcon,
  GitFork,
  Hash,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Table2,
  Trash2,
  Type,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";
import {
  ChartDialog,
  FilterDialog,
  ImportDialog,
  Modal,
  TransformDialog,
} from "./Dialogs";
import { request, saveBlob } from "./client";
import { recommendations } from "./engine";
import type {
  Chart,
  Filter,
  ImportOptions,
  Summary,
  Transform,
  View,
} from "./types";
import { kindLabel } from "./types";
const format = (n: number) =>
  n.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
const ChartCard = lazy(() =>
  import("./ChartCard").then((module) => ({ default: module.ChartCard })),
);
function Mark() {
  return (
    <svg width="34" height="34" viewBox="0 0 48 48" aria-hidden="true">
      <rect width="48" height="48" rx="14" fill="currentColor" />
      <path
        d="M12 17V9l9 6h6l9-6v25H12Z"
        fill="none"
        stroke="white"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <path
        d="M18 28v-6m6 6v-9m6 9v-4"
        stroke="white"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
function FieldIcon({ kind }: { kind: string }) {
  return kind === "number" ? (
    <Hash size={15} />
  ) : kind === "date" ? (
    <CalendarDays size={15} />
  ) : kind === "boolean" ? (
    <Check size={15} />
  ) : (
    <Type size={15} />
  );
}
export default function App() {
  const [datasets, setDatasets] = useState<Summary[]>([]),
    [active, setActive] = useState(""),
    [tab, setTab] = useState("dashboard"),
    [charts, setCharts] = useState<Record<string, Chart[]>>({}),
    [filters, setFilters] = useState<Record<string, Filter[]>>({});
  const [view, setView] = useState<View | null>(null),
    [page, setPage] = useState(0),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState<{ field: string; direction: string } | null>(
      null,
    ),
    [busy, setBusy] = useState(false),
    [viewBusy, setViewBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const [modal, setModal] = useState<
      | "import"
      | "chart"
      | "filter"
      | "transform"
      | "help"
      | "reset"
      | "remove"
      | null
    >(null),
    [editing, setEditing] = useState<Chart | undefined>(),
    [initialOp, setInitialOp] = useState<Transform | undefined>(),
    [initialFiles, setInitialFiles] = useState<File[] | undefined>(),
    [sidebar, setSidebar] = useState(false),
    [drag, setDrag] = useState(false);
  const [mobile, setMobile] = useState(
    () => matchMedia("(max-width:760px)").matches,
  );
  useEffect(() => {
    const media = matchMedia("(max-width:760px)");
    const change = () => setMobile(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  const dataset = datasets.find((d) => d.id === active),
    activeCharts = charts[active] ?? [],
    activeFilters = filters[active] ?? [];
  const sequence = useRef(0);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    setPage(0);
    setSearch("");
    setSort(null);
    setView(null);
  }, [active]);
  useEffect(() => {
    if (!dataset) return;
    const seq = ++sequence.current;
    setViewBusy(true);
    const timer = setTimeout(
      () => {
        request<View>("view", {
          id: active,
          filters: activeFilters,
          charts: tab === "dashboard" ? activeCharts : [],
          page,
          search: tab === "table" ? search : "",
          sort: tab === "table" ? sort : null,
        })
          .then((v) => {
            if (sequence.current === seq) setView(v);
          })
          .catch((e) => {
            if (sequence.current === seq) setError(e.message);
          })
          .finally(() => {
            if (sequence.current === seq) setViewBusy(false);
          });
      },
      search ? 180 : 0,
    );
    return () => {
      clearTimeout(timer);
    };
  }, [active, dataset, activeCharts, activeFilters, page, search, sort, tab]);
  function accept(items: Summary[]) {
    setDatasets((prev) => [...prev, ...items]);
    setCharts((prev) => ({
      ...prev,
      ...Object.fromEntries(items.map((ds) => [ds.id, recommendations(ds)])),
    }));
    setFilters((prev) => ({
      ...prev,
      ...Object.fromEntries(items.map((ds) => [ds.id, []])),
    }));
    setActive(items[0].id);
    setTab("dashboard");
    setModal(null);
    setError("");
    setNotice(
      `${items.length}개 데이터셋을 불러왔습니다. 자동 추천 차트를 자유롭게 편집해 보세요.`,
    );
  }
  const sample = async (which: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      accept(await request("sample", { which }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const importData = async (files: File[], options: ImportOptions) => {
    setBusy(true);
    setError("");
    const loaded: Summary[] = [];
    const failures: string[] = [];
    try {
      for (const file of files) {
        try {
          loaded.push(
            ...(await request<Summary[]>("import", { file, options })),
          );
        } catch (e) {
          failures.push(`${file.name}: ${(e as Error).message}`);
        }
      }
      if (loaded.length) accept(loaded);
      if (failures.length) setError(failures.join("\n"));
    } finally {
      setBusy(false);
    }
  };
  const update = (ds: Summary) =>
    setDatasets((prev) => prev.map((d) => (d.id === ds.id ? ds : d)));
  const process = async (op: Transform) => {
    const result = await request("transform", { id: active, operation: op });
    update(result.summary);
    setModal(null);
    setNotice(result.message);
  };
  const undo = async (reset = false) => {
    setBusy(true);
    try {
      update(await request(reset ? "reset" : "undo", { id: active }));
      setNotice(reset ? "원본으로 복원했습니다." : "이전 변경을 되돌렸습니다.");
      setModal(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const exportData = async (format: string, chart?: Chart) => {
    if (!dataset) return;
    setBusy(true);
    try {
      const { blob, note } = await request("export", {
        id: active,
        format,
        filters: activeFilters,
        chart,
      });
      saveBlob(
        blob,
        `${(chart?.title ?? dataset.name).replace(/\.[^.]+$/, "").replace(/[<>:"/\\|?*]/g, "_")}.${format}`,
      );
      setNotice(
        note || "파일을 내보냈습니다. 현재 데이터 필터가 적용되었습니다.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const newChart = () => {
    setEditing(undefined);
    setModal("chart");
  };
  function openImport(files?: File[]) {
    setInitialFiles(files);
    setError("");
    setModal("import");
  }
  const drop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    if (e.dataTransfer.files.length) openImport([...e.dataTransfer.files]);
  };
  return (
    <div
      className="app-shell"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDrag(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false);
      }}
      onDrop={drop}
    >
      <aside
        className={`sidebar ${sidebar ? "open" : ""}`}
        inert={mobile && !sidebar}
      >
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("dashboard");
          }}
        >
          <Mark />
          <span>
            mini cat<span>DATA STUDIO</span>
          </span>
        </a>
        <button
          className="button primary upload-side"
          onClick={() => openImport()}
          disabled={busy}
        >
          <Plus size={18} />
          데이터 가져오기
        </button>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {[
            { key: "dashboard", icon: LayoutDashboard, label: "대시보드" },
            { key: "table", icon: Table2, label: "데이터 살펴보기" },
            { key: "prepare", icon: WandSparkles, label: "데이터 다듬기" },
          ].map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              onClick={() => {
                setTab(key);
                setSidebar(false);
              }}
            >
              <Icon size={18} />
              {label}
              {key === "dashboard" && dataset && (
                <span className="nav-count">{activeCharts.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="nav-label datasets-label">
          DATASETS <span>{datasets.length}</span>
        </div>
        <div className="dataset-list">
          {!datasets.length ? (
            <p className="sidebar-empty">
              아직 불러온 데이터가 없어요.
              <br />
              파일 하나로 시작해 보세요.
            </p>
          ) : (
            datasets.map((ds) => (
              <button
                key={ds.id}
                className={active === ds.id ? "selected" : ""}
                onClick={() => {
                  setActive(ds.id);
                  setSidebar(false);
                }}
              >
                <span className="dataset-file">
                  <FileSpreadsheet size={17} />
                </span>
                <span>
                  <strong title={ds.name}>{ds.name}</strong>
                  <small>
                    {format(ds.rowCount)}행 · {ds.fields.length}열
                  </small>
                </span>
                {active === ds.id && <span className="active-dot" />}
              </button>
            ))
          )}
        </div>
        {dataset && (
          <>
            <div className="nav-label">
              FIELDS <span>{dataset.fields.length}</span>
            </div>
            <div className="field-list">
              {dataset.fields.map((f) => (
                <div key={f.id} title={`${f.name} · ${kindLabel[f.kind]}`}>
                  <FieldIcon kind={f.kind} />
                  <span>{f.name}</span>
                  <small>
                    {f.kind === "number"
                      ? "123"
                      : f.kind === "date"
                        ? "날짜"
                        : f.kind === "boolean"
                          ? "T/F"
                          : "ABC"}
                  </small>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="sidebar-bottom">
          <div className="local-badge">
            <span className="status-dot" />내 브라우저에서만 분석
          </div>
          <button onClick={() => setModal("help")}>
            <CircleHelp size={16} />
            사용 가이드
            <ArrowUpRight size={15} />
          </button>
          <a
            href="https://github.com/dlwo8520/project1_mini_tableau"
            target="_blank"
            rel="noreferrer"
          >
            <GitFork size={16} />
            GitHub
            <ArrowUpRight size={15} />
          </a>
        </div>
      </aside>
      {sidebar && (
        <button
          className="sidebar-scrim"
          aria-label="메뉴 닫기"
          onClick={() => setSidebar(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              onClick={() => setSidebar(true)}
              aria-label="메뉴 열기"
            >
              <Menu size={21} />
            </button>
            <span>워크스페이스</span>
            <ChevronRight size={14} />
            <strong>
              {
                {
                  dashboard: "대시보드",
                  table: "데이터 살펴보기",
                  prepare: "데이터 다듬기",
                }[tab]
              }
            </strong>
          </div>
          <div className="top-actions">
            <span className="privacy">
              <ShieldCheck size={15} />
              서버 전송 없이, 안전하게
            </span>
            <button
              className="icon-button"
              onClick={() => setModal("help")}
              aria-label="사용 가이드"
            >
              <CircleHelp size={19} />
            </button>
            <span className="avatar">M</span>
          </div>
        </header>
        <main>
          {dataset ? (
            <>
              <div className="workspace-title">
                <div>
                  <div className="eyebrow">YOUR DATA, YOUR PERSPECTIVE</div>
                  <h1>
                    {tab === "dashboard"
                      ? "데이터를 한눈에."
                      : tab === "table"
                        ? "숫자 뒤의 이야기."
                        : "분석의 시작은, 좋은 데이터."}
                  </h1>
                  <p className="dataset-subtitle">
                    <Database size={15} />
                    <span>{dataset.name}</span>
                    <span className="tag">
                      {dataset.history.length ? "수정됨" : "원본 유지"}
                    </span>
                  </p>
                </div>
                <div className="workspace-actions">
                  <button
                    className="button"
                    disabled={busy || !dataset.history.length}
                    onClick={() => undo()}
                  >
                    <RotateCcw size={15} />
                    되돌리기
                  </button>
                  <details className="popover">
                    <summary className="button">
                      <ArrowDownToLine size={16} />
                      내보내기
                      <ChevronDown size={14} />
                    </summary>
                    <div className="dropdown">
                      <button disabled={busy} onClick={() => exportData("csv")}>
                        데이터 CSV
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => exportData("xlsx")}
                      >
                        Excel (.xlsx)
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => exportData("json")}
                      >
                        JSON (원문 텍스트 유지)
                      </button>
                    </div>
                  </details>
                  {tab === "dashboard" && (
                    <button className="button primary" onClick={newChart}>
                      <Plus size={17} />
                      차트 추가
                    </button>
                  )}
                </div>
              </div>
              <section className="metrics">
                <Metric
                  label="전체 행"
                  value={format(dataset.rowCount)}
                  note={
                    dataset.rowCount !== dataset.originalRows
                      ? `원본 ${format(dataset.originalRows)}행`
                      : "분석할 준비가 되었어요"
                  }
                  icon={<Database size={18} />}
                />
                <Metric
                  label="데이터 열"
                  value={String(dataset.fields.length)}
                  note={`${dataset.fields.filter((f) => f.kind === "number").length}개 숫자 · ${dataset.fields.filter((f) => f.kind === "date").length}개 날짜`}
                  icon={<Columns3 size={18} />}
                />
                <Metric
                  label="빈 셀 비율"
                  value={`${dataset.rowCount && dataset.fields.length ? ((dataset.missing / (dataset.rowCount * dataset.fields.length)) * 100).toFixed(1) : "0"}%`}
                  note={`${format(dataset.missing)}개 빈 셀`}
                  icon={<Activity size={18} />}
                />
                <Metric
                  label="현재 분석 범위"
                  value={view ? format(view.total) : "—"}
                  note={
                    activeFilters.length
                      ? `${activeFilters.length}개 필터 적용 중`
                      : "모든 데이터 포함"
                  }
                  icon={<FilterIcon size={18} />}
                />
              </section>
              <section className="filter-bar">
                <div>
                  <span className="filter-label">
                    <FilterIcon size={15} />
                    필터
                  </span>
                  {activeFilters.length === 0 && (
                    <span className="muted">
                      전체 데이터에서 살펴보고 있어요
                    </span>
                  )}
                  {activeFilters.map((f) => (
                    <button
                      className="filter-chip"
                      key={f.id}
                      title="필터 삭제"
                      onClick={() =>
                        setFilters({
                          ...filters,
                          [active]: activeFilters.filter((v) => v.id !== f.id),
                        })
                      }
                    >
                      {dataset.fields.find((c) => c.id === f.field)?.name} ·{" "}
                      {f.op === "missing"
                        ? "빈 값"
                        : f.op === "present"
                          ? "빈 값 아님"
                          : `${({ eq: "=", ne: "≠", contains: "포함", gt: ">", lt: "<", between: "범위" } as Record<string, string>)[f.op]} ${f.value}`}
                      {f.op === "between" ? ` ~ ${f.end}` : ""}
                      <X size={12} />
                    </button>
                  ))}
                </div>
                <button
                  className="text-button"
                  onClick={() => setModal("filter")}
                >
                  <Plus size={14} />
                  필터 추가
                </button>
              </section>
              {tab === "dashboard" && (
                <>
                  <div className="section-heading">
                    <div>
                      <h2>
                        나의 대시보드 <span>{activeCharts.length}</span>
                      </h2>
                      <p>자동 추천에서 시작해, 원하는 관점으로 바꿔 보세요.</p>
                    </div>
                    <span className="subtle-badge">
                      <Sparkles size={13} />
                      열의 구조로 추천
                    </span>
                  </div>
                  <div className={`chart-grid ${viewBusy ? "updating" : ""}`}>
                    {activeCharts.map((c, i) => (
                      <Suspense
                        key={c.id}
                        fallback={
                          <div className="chart-placeholder">차트 준비 중…</div>
                        }
                      >
                        <ChartCard
                          key={c.id}
                          config={c}
                          result={view?.charts[c.id]}
                          onEdit={() => {
                            setEditing(c);
                            setModal("chart");
                          }}
                          onDelete={() =>
                            setCharts({
                              ...charts,
                              [active]: activeCharts.filter(
                                (v) => v.id !== c.id,
                              ),
                            })
                          }
                          onExport={() => exportData("csv", c)}
                          onMove={(direction) => {
                            const next = [...activeCharts],
                              to = i + direction;
                            if (to >= 0 && to < next.length) {
                              [next[i], next[to]] = [next[to], next[i]];
                              setCharts({ ...charts, [active]: next });
                            }
                          }}
                        />
                      </Suspense>
                    ))}
                    <button className="add-chart-card" onClick={newChart}>
                      <span>
                        <Plus size={23} />
                      </span>
                      <strong>새로운 관점 더하기</strong>
                      <small>8가지 차트로 자유롭게 탐색하세요</small>
                    </button>
                  </div>
                  <div className="workspace-footnote">
                    <ShieldCheck size={14} />
                    파일과 분석 결과는 현재 탭 안에만 있습니다. 보관할 데이터는
                    내보내기로 저장하세요.
                  </div>
                </>
              )}
              {tab === "table" && (
                <section className="panel data-panel">
                  <header className="panel-heading">
                    <div>
                      <h2>데이터 테이블</h2>
                      <p>
                        열 제목을 누르면 정렬됩니다. 한 페이지에 50행씩
                        표시합니다.
                      </p>
                    </div>
                    <label className="search-box">
                      <Search size={16} />
                      <input
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          setPage(0);
                        }}
                        placeholder="현재 테이블에서 검색"
                        aria-label="테이블 검색"
                      />
                    </label>
                  </header>
                  <div className={`table-scroll ${viewBusy ? "updating" : ""}`}>
                    <table>
                      <thead>
                        <tr>
                          <th className="row-number">#</th>
                          {dataset.fields.map((f) => (
                            <th key={f.id}>
                              <button
                                onClick={() => {
                                  setSort({
                                    field: f.id,
                                    direction:
                                      sort?.field === f.id &&
                                      sort.direction === "asc"
                                        ? "desc"
                                        : "asc",
                                  });
                                  setPage(0);
                                }}
                              >
                                <FieldIcon kind={f.kind} />
                                {f.name}
                                <span>
                                  {sort?.field === f.id
                                    ? sort.direction === "asc"
                                      ? "↑"
                                      : "↓"
                                    : "↕"}
                                </span>
                              </button>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {view?.rows.map((row, i) => (
                          <tr key={i}>
                            <td className="row-number">
                              {view.page * 50 + i + 1}
                            </td>
                            {row.map((v, j) => (
                              <td
                                className={
                                  dataset.fields[j]?.kind === "number"
                                    ? "numeric"
                                    : ""
                                }
                                key={j}
                                title={v == null ? "빈 값" : String(v)}
                              >
                                {v === null || v === "" ? (
                                  <span className="null-cell">빈 값</span>
                                ) : typeof v === "boolean" ? (
                                  String(v)
                                ) : typeof v === "number" ? (
                                  format(v)
                                ) : (
                                  String(v)
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {view?.total === 0 && (
                      <p className="empty-table">
                        조건에 맞는 행이 없습니다. 필터나 검색어를 바꿔 주세요.
                      </p>
                    )}
                  </div>
                  <footer className="table-footer">
                    <span>
                      {format(view?.total ?? 0)}행 중{" "}
                      {view?.total ? view.page * 50 + 1 : 0}–
                      {Math.min((view?.page ?? 0) * 50 + 50, view?.total ?? 0)}
                    </span>
                    <div>
                      <button
                        className="icon-button"
                        aria-label="이전 페이지"
                        disabled={!view?.page}
                        onClick={() =>
                          setPage(Math.max(0, (view?.page ?? 0) - 1))
                        }
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <span>
                        {(view?.page ?? 0) + 1} /{" "}
                        {Math.max(1, Math.ceil((view?.total ?? 0) / 50))}
                      </span>
                      <button
                        className="icon-button"
                        aria-label="다음 페이지"
                        disabled={
                          !view || view.page + 1 >= Math.ceil(view.total / 50)
                        }
                        onClick={() => setPage((view?.page ?? 0) + 1)}
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </footer>
                </section>
              )}
              {tab === "prepare" && (
                <>
                  <div className="prepare-layout">
                    <section className="panel profile-panel">
                      <header className="panel-heading">
                        <div>
                          <h2>데이터 프로필</h2>
                          <p>
                            필터 적용 전, 현재 데이터 전체의 열 상태를
                            확인하세요.
                          </p>
                        </div>
                        <button
                          className="button primary"
                          onClick={() => {
                            setInitialOp(undefined);
                            setModal("transform");
                          }}
                        >
                          <WandSparkles size={15} />
                          전처리 작업
                        </button>
                      </header>
                      <div className="table-scroll">
                        <table className="profile-table">
                          <thead>
                            <tr>
                              <th>열 이름 / 자료형</th>
                              <th>비어 있는 값</th>
                              <th>고유값</th>
                              <th>범위 / 예시</th>
                              <th>평균</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {dataset.fields.map((f) => (
                              <tr key={f.id}>
                                <td>
                                  <div className="profile-field">
                                    <span className="field-type">
                                      <FieldIcon kind={f.kind} />
                                    </span>
                                    <div>
                                      <strong>{f.name}</strong>
                                      <small>{kindLabel[f.kind]}</small>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <div className="missing-value">
                                    <span>
                                      {format(f.missing)}{" "}
                                      <small>
                                        (
                                        {dataset.rowCount
                                          ? (
                                              (f.missing / dataset.rowCount) *
                                              100
                                            ).toFixed(1)
                                          : 0}
                                        %)
                                      </small>
                                    </span>
                                    <div className="quality-track">
                                      <span
                                        style={{
                                          width: `${dataset.rowCount ? (f.missing / dataset.rowCount) * 100 : 0}%`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                </td>
                                <td>{format(f.unique)}</td>
                                <td
                                  className="profile-example"
                                  title={f.examples.join(" · ")}
                                >
                                  {f.min !== undefined && f.max !== undefined
                                    ? f.kind === "date"
                                      ? `${new Date(f.min).toISOString().slice(0, 10)} ~ ${new Date(f.max).toISOString().slice(0, 10)}`
                                      : `${format(f.min)} ~ ${format(f.max)}`
                                    : f.examples.slice(0, 2).join(" · ") || "—"}
                                </td>
                                <td>
                                  {f.mean !== undefined ? format(f.mean) : "—"}
                                </td>
                                <td>
                                  <button
                                    className="text-button"
                                    onClick={() => {
                                      setInitialOp({
                                        type: "cast",
                                        field: f.id,
                                        value: f.kind,
                                        extra: "",
                                      });
                                      setModal("transform");
                                    }}
                                  >
                                    편집
                                    <ArrowUpRight size={13} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                    <aside className="prepare-aside">
                      <section className="panel history-panel">
                        <h3>
                          <RotateCcw size={17} />
                          변경 기록 <span>{dataset.history.length}</span>
                        </h3>
                        {dataset.history.length ? (
                          <ol>
                            {dataset.history.map((h, i) => (
                              <li key={i}>
                                <span>{i + 1}</span>
                                {h}
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p>
                            아직 수정한 내용이 없어요.
                            <br />
                            원본 데이터에서 시작하세요.
                          </p>
                        )}
                        <button
                          className="button"
                          disabled={!dataset.history.length || busy}
                          onClick={() => setModal("reset")}
                        >
                          <RotateCcw size={14} />
                          원본으로 복원
                        </button>
                      </section>
                      <section className="tip-card">
                        <Sparkles size={19} />
                        <strong>조금 더 깔끔한 분석</strong>
                        <p>
                          공백 정리 → 자료형 확인 → 빈 값 처리 순서로 데이터를
                          다듬어 보세요.
                        </p>
                        <button
                          className="text-button"
                          onClick={() => {
                            setInitialOp({ type: "trim" });
                            setModal("transform");
                          }}
                        >
                          공백부터 정리하기
                          <ArrowRight size={14} />
                        </button>
                      </section>
                    </aside>
                  </div>
                  <details className="data-notes">
                    <summary>
                      <CircleHelp size={15} />
                      가져오기 안내 ({dataset.notes.length})
                    </summary>
                    {dataset.notes.map((n, i) => (
                      <p key={i}>{n}</p>
                    ))}
                    <button
                      className="text-button danger-text"
                      onClick={() => setModal("remove")}
                    >
                      <Trash2 size={14} />이 데이터셋 닫기
                    </button>
                  </details>
                </>
              )}
            </>
          ) : (
            <EmptyState
              busy={busy}
              onUpload={() => openImport()}
              onSample={sample}
              tab={tab}
            />
          )}
          {error && modal !== "import" && (
            <div className="page-error" role="alert">
              <span>{error}</span>
              <button
                className="icon-button"
                aria-label="오류 닫기"
                onClick={() => setError("")}
              >
                <X size={17} />
              </button>
            </div>
          )}
        </main>
        <footer className="app-footer">
          <span>MINI CAT DATA STUDIO</span>
          <span>데이터에 담긴 가능성을, 누구나.</span>
          <span>v2.0 · 브라우저 분석</span>
        </footer>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Check size={19} />
          <span>{notice}</span>
          <button
            className="icon-button"
            onClick={() => setNotice("")}
            aria-label="알림 닫기"
          >
            <X size={16} />
          </button>
        </div>
      )}
      {(busy || viewBusy) && (
        <div className="working-indicator" role="status">
          <LoaderCircle size={15} className="spin" />
          {busy ? "데이터 처리 중" : "차트 업데이트 중"}
        </div>
      )}
      {drag && (
        <div className="drag-overlay">
          <Upload size={40} />
          <h2>파일을 놓아 분석을 시작하세요</h2>
        </div>
      )}
      {modal === "import" && (
        <ImportDialog
          onClose={() => setModal(null)}
          onImport={importData}
          busy={busy}
          error={error}
          initial={initialFiles}
        />
      )}
      {modal === "chart" && dataset && (
        <ChartDialog
          dataset={dataset}
          chart={editing}
          onClose={() => setModal(null)}
          onSave={(c) => {
            setCharts({
              ...charts,
              [active]: editing
                ? activeCharts.map((v) => (v.id === c.id ? c : v))
                : [...activeCharts, c],
            });
            setModal(null);
          }}
        />
      )}
      {modal === "filter" && dataset && (
        <FilterDialog
          dataset={dataset}
          onClose={() => setModal(null)}
          onSave={(f) => {
            setFilters({ ...filters, [active]: [...activeFilters, f] });
            setPage(0);
            setModal(null);
          }}
        />
      )}
      {modal === "transform" && dataset && (
        <TransformDialog
          dataset={dataset}
          initial={initialOp}
          onClose={() => setModal(null)}
          onApply={process}
        />
      )}
      {modal === "reset" && (
        <Modal
          title="원본으로 복원할까요?"
          subtitle="이 데이터셋에 적용한 모든 전처리 작업을 취소합니다. 차트와 필터 설정은 유지합니다."
          onClose={() => setModal(null)}
        >
          <div className="modal-actions">
            <button className="button" onClick={() => setModal(null)}>
              취소
            </button>
            <button className="button primary" onClick={() => undo(true)}>
              원본으로 복원
            </button>
          </div>
        </Modal>
      )}
      {modal === "remove" && dataset && (
        <Modal
          title="데이터셋을 닫을까요?"
          subtitle="이 탭에서 데이터와 차트 설정을 지웁니다. 필요한 내용은 먼저 내보내기로 저장해 주세요."
          onClose={() => setModal(null)}
        >
          <div className="modal-actions">
            <button className="button" onClick={() => setModal(null)}>
              취소
            </button>
            <button
              className="button primary"
              onClick={async () => {
                await request("remove", { id: active });
                const next = datasets.filter((d) => d.id !== active);
                setDatasets(next);
                setActive(next[0]?.id ?? "");
                setModal(null);
              }}
            >
              데이터셋 닫기
            </button>
          </div>
        </Modal>
      )}
      {modal === "help" && (
        <Modal
          title="파일 하나면, 분석 준비 끝."
          subtitle="Mini Cat 사용 가이드"
          onClose={() => setModal(null)}
        >
          <div className="guide">
            <GuideStep n="01" title="데이터를 가져오세요">
              CSV·TSV·TXT, Excel (XLSX·XLS·XLSM·XLSB), ODS, DBF,
              JSON·JSONL·NDJSON, Parquet을 지원합니다. Excel의 각 시트는 별도
              데이터셋이 됩니다.
            </GuideStep>
            <GuideStep n="02" title="자동 차트에서 자유롭게 탐색하세요">
              열의 자료형에 따라 차트를 제안합니다. 편집 버튼으로 축, 집계,
              그룹, 날짜 단위와 색상을 바꿀 수 있습니다. 필터는 모든 차트와
              내보내기에 적용됩니다.
            </GuideStep>
            <GuideStep n="03" title="데이터를 다듬고 결과를 저장하세요">
              공백·중복·빈 값 처리, 자료형 변환, 계산 열 등을 지원합니다. 변경을
              미리 확인한 뒤 적용하고 되돌릴 수 있습니다. 데이터는
              CSV·Excel·JSON, 차트는 PNG로 내보내세요.
            </GuideStep>
            <div className="guide-note">
              <ShieldCheck size={20} />
              <p>
                파일은 현재 브라우저의 메모리에서만 처리하며 자동 저장하지
                않습니다. 새로고침하거나 탭을 닫기 전에 결과를 내보내세요.
              </p>
            </div>
            <p className="form-help">
              파일당 50MB, 10만 행, 500열, 200만 셀까지 지원합니다. 압축 해제 후
              메모리가 많이 필요한 파일은 기기 사양에 따라 처리가 어려울 수
              있습니다. PDF·이미지·데이터베이스 덤프는 표 형식으로 변환한 뒤
              올려 주세요.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
function Metric({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: string;
  note: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="metric">
      <div>
        <span>{label}</span>
        <span className="metric-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
function GuideStep({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="guide-step">
      <span>{n}</span>
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </div>
  );
}
function EmptyState({
  busy,
  onUpload,
  onSample,
  tab,
}: {
  busy: boolean;
  onUpload: () => void;
  onSample: (s: string) => void;
  tab: string;
}) {
  return (
    <div className="empty-workspace">
      <section className="welcome">
        <div className="welcome-copy">
          <span className="hero-label">
            <span />
            YOUR NEXT INSIGHT STARTS HERE
          </span>
          <h1>
            데이터를 올리면,
            <br />
            <em>인사이트가 보입니다.</em>
          </h1>
          <p>
            복잡한 설정 없이 시작하는 나만의 데이터 스튜디오.
            <br />
            시각화부터 데이터 다듬기까지, 한 공간에서 자유롭게.
          </p>
          <div className="hero-benefits">
            <span>
              <ShieldCheck size={15} />내 브라우저에서만 처리
            </span>
            <span>
              <Sparkles size={15} />
              회원가입 없이 무료로
            </span>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="floating-label">
            <span className="tiny-dot" />
            새로운 가능성을 발견하는 중
          </div>
          <div className="mini-chart">
            <div className="mini-chart-head">
              <span>작은 데이터, 더 큰 발견</span>
              <ChartNoAxesCombined size={17} />
            </div>
            <div className="mini-value">
              Make it clear.<span>차트로 만나는 데이터의 이야기</span>
            </div>
            <svg viewBox="0 0 300 96">
              <defs>
                <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                  <stop stopColor="#3b82f6" stopOpacity=".25" />
                  <stop offset="1" stopColor="#3b82f6" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 72C25 75 35 50 60 56S100 64 120 39S150 58 180 29S210 42 240 17S270 23 300 3V96H0Z"
                fill="url(#area)"
              />
              <path
                d="M0 72C25 75 35 50 60 56S100 64 120 39S150 58 180 29S210 42 240 17S270 23 300 3"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="3"
              />
            </svg>
            <div className="mini-axis">
              <span>UPLOAD</span>
              <span>EXPLORE</span>
              <span>DISCOVER</span>
            </div>
          </div>
          <div className="floating-tile">
            <BarChart3 size={21} />
            <div>
              어떤 관점이든 자유롭게<span>데이터의 다음 장면을 찾아보세요</span>
            </div>
          </div>
        </div>
      </section>
      <section className="upload-zone">
        <div className="upload-zone-copy">
          <div className="upload-orb">
            <Upload size={27} />
          </div>
          <h2>데이터 파일을 여기에 놓아 주세요</h2>
          <p>또는 파일을 선택하면 자동으로 분석을 시작합니다.</p>
          <button className="button primary" onClick={onUpload} disabled={busy}>
            <Plus size={17} />
            파일에서 시작하기
            <ArrowUpRight size={16} />
          </button>
          <div className="format-tags">
            <span>CSV / TSV</span>
            <span>Excel / ODS</span>
            <span>JSON / JSONL</span>
            <span>Parquet</span>
            <span>DBF</span>
          </div>
          <small>
            파일당 최대 50MB · 최대 10만 행 · 파일을 외부로 전송하지 않습니다
          </small>
        </div>
        <div className="upload-decoration" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </section>
      <section className="samples-section">
        <div className="section-heading">
          <div>
            <h2>데이터가 없어도 괜찮아요.</h2>
            <p>가상 샘플로 먼저 둘러보세요. 실제 통계나 관측값이 아닙니다.</p>
          </div>
          <span className="subtle-badge">SAMPLE DATA</span>
        </div>
        <div className="sample-grid">
          {[
            {
              id: "sales",
              icon: BarChart3,
              title: "브랜드 매출 분석",
              desc: "어떤 지역, 어떤 상품이 성장했을까요?",
              meta: "144행 · 6열",
              className: "sales",
            },
            {
              id: "city",
              icon: Activity,
              title: "도시 환경 탐색",
              desc: "시간에 따라 달라지는 도시의 모습",
              meta: "270행 · 5열",
              className: "city",
            },
            {
              id: "survey",
              icon: Table2,
              title: "사용자 설문 다듬기",
              desc: "빈 값과 중복을 정리하고 한눈에",
              meta: "182행 · 6열",
              className: "survey",
            },
          ].map((s) => (
            <button
              className="sample-card"
              key={s.id}
              disabled={busy}
              onClick={() => onSample(s.id)}
            >
              <div className={`sample-icon ${s.className}`}>
                <s.icon size={22} />
              </div>
              <div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
                <small>
                  {s.meta}
                  <span>가상 데이터</span>
                </small>
              </div>
              <ArrowUpRight size={18} />
            </button>
          ))}
        </div>
      </section>
      <div className="empty-footer">
        <span>UPLOAD → EXPLORE → REFINE → SHARE</span>
        <p>발견하는 즐거움에 집중하세요. 도구는 Mini Cat이 준비할게요.</p>
      </div>
      {tab !== "dashboard" && (
        <p className="form-help">
          파일이나 샘플 데이터를 불러오면{" "}
          {tab === "table" ? "데이터 테이블" : "전처리 도구"}를 사용할 수
          있습니다.
        </p>
      )}
    </div>
  );
}
