import { Cat } from "lucide-react";

export default function Header() {
  return (
    <header className="h-14 flex items-center justify-between px-6 mb-4">
      {/* 로고 + 제목 */}
      <div className="flex items-center gap-2">
        <Cat className="h-6 w-6 text-primary-600" />
        <span className="font-semibold text-lg">Mini Tableau</span>
      </div>

      {/* (원한다면) 잔고 · 아바타 영역 */}
      <div className="flex items-center gap-3">
        {/* … */}
      </div>
    </header>
  );
}
