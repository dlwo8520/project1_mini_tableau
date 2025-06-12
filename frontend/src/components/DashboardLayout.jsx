import { Search, Bell } from "lucide-react";   // npm i lucide-react

export default function DashboardLayout({ sidebar, children }) {
  return (
    <div className="h-screen w-screen bg-[#f2f3f7] flex flex-col overflow-hidden">
      {/* ── Top Bar ── */}
      <header className="h-14 shrink-0 bg-white/90 backdrop-blur shadow-sm
                         px-6 flex items-center justify-between">
        <h1 className="font-heading text-xl tracking-tight">
          Mini <span className="text-accent">Tableau</span>
        </h1>

        <div className="flex items-center gap-4">
          {/* 검색 입력 */}
          <div className="relative text-gray-500">
            <input
              type="text"
              placeholder="Search…"
              className="pl-10 pr-3 py-1.5 text-sm rounded-full bg-gray-100
                         focus:bg-white focus:outline-none"
            />
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
          {/* 알림 아이콘 */}
          <Bell className="w-5 h-5 text-gray-600 hover:text-primary-600 cursor-pointer" />
        </div>
      </header>

      {/* ── 본문 레이아웃 ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* 왼쪽 사이드바 */}
        <aside className="hidden lg:block w-80 shrink-0 overflow-y-auto p-6">
          {sidebar}
        </aside>

        {/* 메인 콘텐츠 */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
