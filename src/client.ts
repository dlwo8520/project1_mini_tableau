const worker = new Worker(new URL("./data.worker.ts", import.meta.url), {
  type: "module",
});
const pending = new Map<
  number,
  { resolve: (v: any) => void; reject: (e: Error) => void }
>();
let id = 0;
worker.onmessage = (event) => {
  const { request, result, error } = event.data;
  const p = pending.get(request);
  if (!p) return;
  pending.delete(request);
  if (error) p.reject(new Error(error));
  else p.resolve(result);
};
worker.onerror = () => {
  pending.forEach((p) =>
    p.reject(
      new Error(
        "데이터 처리 작업을 시작하지 못했습니다. 페이지를 새로고침해 주세요.",
      ),
    ),
  );
  pending.clear();
};
export function request<T = any>(cmd: string, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = ++id;
    pending.set(request, { resolve, reject });
    worker.postMessage({ request, cmd, payload });
  });
}
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
