export default function Header() {
  return (
    <header className="bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* 브랜드 */}
        <h1 className="text-2xl md:text-3xl font-heading tracking-tight">
          Mini <span className="text-accent">Tableau</span>
        </h1>

        {/* (선택) 다크모드 토글 자리 */}
        {/* <button …>🌙</button> */}
      </div>
    </header>
  );
}
