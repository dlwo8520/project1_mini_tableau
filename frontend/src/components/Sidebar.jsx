// src/components/Sidebar.jsx
import { Card, CardHeader, CardContent } from "@/components/ui/card";

export default function Sidebar() {
  return (
    <aside className="w-64 shrink-0 flex flex-col gap-4">
      <Card>
        <CardHeader className="text-sm">Watchlist</CardHeader>
        <CardContent className="text-xs text-gray-500" />
      </Card>

      <Card>
        <CardHeader className="text-sm">Alerts</CardHeader>
        <CardContent className="text-xs text-gray-500" />
      </Card>
    </aside>
  );
}
