import { useDropzone } from "react-dropzone";
import { UploadCloud } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

export default function UploadSidebar({ columns, onFile }) {
  /* 드래그 & 드롭 설정 */
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "text/csv": [],
      "application/vnd.ms-excel": []
    },
    multiple: false,
    onDrop: files => onFile(files[0])
  });

  return (
    <aside className="w-64 shrink-0 flex flex-col gap-4 self-stretch">
      <Card className="p-4 shadow-card rounded-2xl flex flex-col h-full">
        {/* 업로드 박스 */}
        <CardContent>
          <div
            {...getRootProps()}
            className="
              w-full
              min-h-[160px]            /* 최소 높이로 충분한 내부 공간 확보 */
              flex flex-col items-center justify-center
              gap-4                   /* 아이콘 ↔ 텍스트 간격 */
              px-6 py-8               /* 좌우/상하 패딩 추가 */
              rounded-xl
              border-2 border-dashed border-primary-300/70
              bg-primary-50/30
              text-xs text-primary-700
              hover:bg-primary-50/60
              transition-colors
              cursor-pointer
            "
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
