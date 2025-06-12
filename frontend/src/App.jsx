// src/App.jsx
import { useState } from "react";
import Header        from "@/components/Header";
import UploadSidebar from "@/components/UploadSidebar";
import ConfigSidebar from "@/components/ConfigSidebar";
import ChartArea     from "@/components/ChartArea";
import { parseFile } from "@/utils/parseFile";

export default function App() {
  const [columns, setColumns] = useState(null);
  const [rawData, setRawData] = useState([]);
  const [config,  setConfig]  = useState({ type: "bar", x: "", y: "" });

  /* 파일 업로드 처리 */
  const handleFile = async file => {
    const { cols, rows } = await parseFile(file);
    setColumns(cols);
    setRawData(rows);
    setConfig(c => ({
      ...c,
      x: cols[0]?.name || "",
      y: cols[1]?.name || ""
    }));
  };

  return (
    // ① 최상위는 flex로 가운데 정렬
    <div className="min-h-screen bg-zinc-50 flex justify-center">
      {
        /* ② 헤더 + 그리드를 함께 묶는 고정폭 컨테이너
           — grid 폭: 240 + 900 + 200 + gap(32*2) + px(24*2) = 약 1,428px */
      }
      <div className="w-full max-w-[1428px] px-6 py-6 flex flex-col gap-6">
        {/* 헤더도 이 안에 들어가서 같이 움직입니다 */}
        <Header />

        {/* 기존 grid */}
        <div className="grid grid-cols-[240px_minmax(0,900px)_200px] gap-8 flex-1">
          <UploadSidebar
            className="h-[calc(100vh-64px-48px)]"
            onFile={handleFile}
            columns={columns}
          />

          <ChartArea
            className="h-[calc(100vh-64px-48px)]"
            columns={columns}
            data={rawData}
            config={config}
          />

          <ConfigSidebar
            className="h-[calc(100vh-64px-48px)]"
            columns={columns}
            config={config}
            setConfig={setConfig}
          />
        </div>
      </div>
    </div>
  );
}
