// src/components/Header.jsx
import React from "react";
import { Cat } from "lucide-react";

export default function Header() {
  return (
    <header
      className="
        w-full 
        bg-white 
        shadow-card 
        py-32           /* 상하 8rem 패딩 */
        px-6 
        min-h-[6rem]   /* 최소 높이 12rem 보장 */
      "
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px"    /* 아이콘↔텍스트 간격 16px */
        }}
      >
        <Cat size={40} className="text-primary-500" />
        <h1 className="text-3xl font-semibold text-primary-600">
          Mini Cat
        </h1>
      </div>
    </header>
  );
}
