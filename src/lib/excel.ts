import * as XLSX from "xlsx";

export function exportToExcel<T extends Record<string, unknown>>(
  data: T[],
  sheetName: string,
  fileName: string
): void {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

export function exportDocumentRequestsToExcel(rows: Array<{
  tracking_number: string;
  requester_name: string;
  requester_email: string;
  document_type: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
}>, fileName = "document_requests"): void {
  const data = rows.map((r) => ({
    "Tracking #": r.tracking_number,
    "Requester": r.requester_name,
    "Email": r.requester_email,
    "Document Type": r.document_type ?? "",
    "Status": r.status,
    "Created": r.created_at,
    "Completed": r.completed_at ?? "",
  }));
  exportToExcel(data, "Document Requests", fileName);
}
