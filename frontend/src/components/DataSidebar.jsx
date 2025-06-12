import { Cat, UploadCloud, Search } from "lucide-react";

export default function Header({ onFile }) {
  /** 파일 input → 상위(App)로 전달 */
  const handleChange = e => onFile?.(e.target.files?.[0]);

  return (
    <header className="h-14 flex items-center justify-between px-6 shadow-sm bg-white">
      {/* ─── 로고 ─── */}
      <div className="flex items-center gap-2">
        <Cat className="h-6 w-6 text-primary-600" />
        <span className="font-semibold">Mini Tableau</span>
      </div>

      {/* ─── 업로드 박스 ─── */}
      <label className="relative w-72">
        <input
          type="file"
          accept=".csv,.xlsx"
          onChange={handleChange}
          className="peer absolute inset-0 opacity-0 cursor-pointer"
        />
        <div
          className="h-10 flex items-center gap-2 pl-3 pr-4 rounded-full border
                     text-sm text-gray-500 hover:bg-primary-50/60
                     peer-focus:ring-2 peer-focus:ring-primary-500"
        >
          <UploadCloud className="h-4 w-4" />
          <span className="flex-1 truncate">CSV / Excel 파일 업로드</span>
          <Search className="h-4 w-4" />
        </div>
      </label>

      {/* ─── 프로필 (예시) ─── */}
      <img
        src="/avatar.jpg"
        alt="user"
        className="h-8 w-8 rounded-full border object-cover"
      />
    </header>
  );
}
