export function toCsv(rows: Array<Record<string, unknown>>, columns?: string[]): string {
  if (!rows.length) return "";
  const keys = columns ?? Object.keys(rows[0]);
  const header = keys.map(escapeCsv).join(";");
  const body = rows
    .map((row) => keys.map((key) => escapeCsv(row[key])).join(";"))
    .join("\n");
  return `\uFEFF${header}\n${body}`;
}

function escapeCsv(value: unknown): string {
  const text = value == null ? "" : String(value).replace(/\r?\n/g, " ");
  if (/[;"\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
