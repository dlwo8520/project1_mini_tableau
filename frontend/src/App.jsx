import { useState } from "react";
import Header from "@/components/Header";
import UploadSidebar from "@/components/UploadSidebar";
import ConfigSidebar from "@/components/ConfigSidebar";
import ChartArea from "@/components/ChartArea";
import { parseFile } from "@/utils/parseFile";

const shell = "w-full max-w-6xl rounded-3xl bg-white shadow-xl flex flex-col gap-4 overflow-hidden";

export default function App() {
  const [columns, setColumns] = useState(null);
  const [rawData, setRawData] = useState([]);
  const [config, setConfig] = useState({ type: "bar", x: "", y: "" });

  const handleFile = async file => {
    const { cols, rows } = await parseFile(file);
    setColumns(cols);
    setRawData(rows);
    setConfig(c => ({ ...c, x: cols[0]?.name || "", y: cols[1]?.name || "" }));
  };

  return (
    <div className="min-h-screen bg-zinc-100 flex justify-center pt-14 pb-160 px-160">
      <div className={shell}>
        <Header />

        <main className="flex-1 flex gap-6 p-6">
          <UploadSidebar columns={columns} onFile={handleFile} />
          <ChartArea columns={columns} data={rawData} config={config} />
          <ConfigSidebar
            columns={columns}
            config={config}
            setConfig={setConfig}
          />
        </main>
      </div>
    </div>
  );
}
