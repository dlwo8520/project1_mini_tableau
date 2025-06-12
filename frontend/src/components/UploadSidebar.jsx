import { useDropzone } from "react-dropzone";
import { UploadCloud } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

export default function UploadSidebar({ columns, onFile }) {
  /* 드래그&드롭 설정 */
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "text/csv": [], "application/vnd.ms-excel": [] },
    multiple: false,
    onDrop: files => onFile(files[0]),
  });

  return (
    <aside className="w-64 shrink-0 flex flex-col gap-4">
      <Card className="space-y-4 shadow-card mt-1">
        {/* 업로드 박스 */}
        <CardHeader className="text-sm">데이터 업로드</CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className="h-32 flex flex-col items-center justify-center gap-2
               rounded-xl border-2 border-dashed border-primary-300/70
               bg-primary-50/30 text-xs text-primary-700
               hover:bg-primary-50/60 transition-colors cursor-pointer"
          >
            <input {...getInputProps()} />
            <UploadCloud className="h-5 w-5 text-primary-500" />
            {isDragActive ? "놓으세요" : "CSV / Excel 드래그 또는 클릭"}
          </div>
        </CardContent>

        {/* 컬럼 리스트 */}
        {columns && (
          <>
            <CardHeader className="text-sm">컬럼</CardHeader>
            <CardContent className="space-y-1 text-xs">
              {columns.map(c => (
                <div key={c.name} className="truncate">
                  {c.name} ({c.dtype})
                </div>
              ))}
            </CardContent>
          </>
        )}
      </Card>
    </aside>
  );
}
