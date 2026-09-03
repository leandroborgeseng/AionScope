"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCsv, toCsv } from "@/lib/pbi/csv";

export function CsvButton({
  filename,
  rows,
  columns,
}: {
  filename: string;
  rows: Array<Record<string, unknown>>;
  columns?: string[];
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={!rows.length}
      onClick={() => downloadCsv(filename, toCsv(rows, columns))}
    >
      <Download className="h-4 w-4" />
      Exportar CSV
    </Button>
  );
}
