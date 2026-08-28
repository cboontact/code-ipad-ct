export type SpreadsheetRow = Record<string, unknown>;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], value = "", quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index], next = text[index + 1];
    if (char === '"' && quoted && next === '"') { value += '"'; index++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(value); value = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index++;
      row.push(value); if (row.some((cell) => cell.length)) rows.push(row); row = []; value = "";
    } else value += char;
  }
  row.push(value); if (row.some((cell) => cell.length)) rows.push(row);
  return rows;
}

function matrixToRows(matrix: unknown[][]): SpreadsheetRow[] {
  const headers = (matrix[0] ?? []).map((cell) => String(cell ?? "").trim());
  return matrix.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
}

export async function readTabularFile(file: File): Promise<SpreadsheetRow[]> {
  if (file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv") return matrixToRows(parseCsv(await file.text()));
  const { default: readXlsxFile } = await import("read-excel-file/browser");
  const sheets = await readXlsxFile(file);
  return matrixToRows((sheets[0]?.data ?? []) as unknown[][]);
}

export async function writeXlsxRows(rows: SpreadsheetRow[], fileName: string): Promise<void> {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const sheet = [
    headers.map((value) => ({ value, fontWeight: "bold" as const, backgroundColor: "#DFF4FC" })),
    ...rows.map((row) => headers.map((key) => ({ value: row[key] == null ? "" : String(row[key]) }))),
  ];
  await writeXlsxFile(sheet, { columns: headers.map((header) => ({ width: Math.min(32, Math.max(12, header.length + 4)) })), stickyRowsCount: 1 }).toFile(fileName);
}

export function downloadCsv(rows: SpreadsheetRow[], fileName: string): void {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = "\ufeff" + [headers.map(escape).join(","), ...rows.map((row) => headers.map((key) => escape(row[key])).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })), anchor = document.createElement("a");
  anchor.href = url; anchor.download = fileName; anchor.click(); URL.revokeObjectURL(url);
}
