import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useDropzone } from "react-dropzone";

export default function UploadSidebar() {
  /* Dropzone 준비 (UploadChart와 같은 방식) */
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ /* … */ });

  return (
    <Card className="space-y-6">
      <CardHeader className="pb-2">
        <h2 className="font-semibold">데이터 업로드</h2>
      </CardHeader>

      <CardContent>
        <div
          {...getRootProps()}
          className="border-2 border-dashed border-primary-500 rounded-2xl p-6
                     text-center hover:bg-primary-50/40 transition-colors cursor-pointer"
        >
          <input {...getInputProps()} />
          {isDragActive ? 'Drop files here' : 'CSV / Excel 끌어다 놓기'}
        </div>
      </CardContent>
    </Card>
  );
}
