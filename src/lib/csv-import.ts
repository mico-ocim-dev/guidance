import { createClient } from "./supabase";

export interface ImportResult {
  totalRows: number;
  importedRows: number;
  failedRows: number;
  errors: Array<{ row: number; message: string }>;
}

export async function logImport(
  importType: string,
  fileName: string,
  result: ImportResult,
  userId: string | null
): Promise<void> {
  const supabase = createClient();
  await supabase.from("import_logs").insert({
    import_type: importType,
    file_name: fileName,
    total_rows: result.totalRows,
    imported_rows: result.importedRows,
    failed_rows: result.failedRows,
    errors: result.errors.length ? result.errors : null,
    imported_by: userId,
  });
}

export function parseCsvFile(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const rows = text.split(/\r?\n/).map((row) => row.split(",").map((cell) => cell.trim().replace(/^"|"$/g, "")));
      resolve(rows);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function parseCsvText(csvText: string): string[][] {
  return csvText.split(/\r?\n/).map((row) => row.split(",").map((cell) => cell.trim().replace(/^"|"$/g, "")));
}
