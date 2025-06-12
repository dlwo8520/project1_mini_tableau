import { Cat } from "lucide-react";

export default function Header() {
  return (
    <header className="h-14 flex items-center justify-between px-6 shadow-sm">
      <div className="flex items-center gap-2">
        <Cat className="h-6 w-6 text-primary-600" />
        <span className="font-semibold">Mini Tableau</span>
      </div>

      {/* 예시 아바타 */}
      <img
        src="/avatar.jpg"
        alt="user"
        className="h-8 w-8 rounded-full border object-cover"
      />
    </header>
  );
}
