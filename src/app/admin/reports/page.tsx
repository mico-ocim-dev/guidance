"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { exportToExcel } from "@/lib/excel";

export default function AdminReportsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [reports, setReports] = useState<Array<{ id: string; report_month: string; report_type: string; data: Record<string, unknown>; created_at: string }>>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/auth/login");
        return;
      }
      const isAdminEmail = user.email?.toLowerCase() === "admin@demo.com";
      supabase.from("profiles").select("role").eq("id", user.id).single().then(({ data }) => {
        if (data?.role !== "admin" && !isAdminEmail) {
          router.replace("/dashboard");
          return;
        }
        setIsAdmin(true);
        supabase.from("monthly_reports").select("*").order("report_month", { ascending: false }).then(({ data }) => setReports((data ?? []) as typeof reports));
      });
    }).finally(() => setLoading(false));
  }, [router]);

  async function generateMonthlyReport() {
    setGenerating(true);
    const supabase = createClient();
    const now = new Date();
    const month = now.toISOString().slice(0, 7) + "-01";
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);

    const [reqRes, prevRes] = await Promise.all([
      supabase.from("document_requests").select("id, status").gte("created_at", month).lt("created_at", new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10)),
      supabase.from("document_requests").select("id, status").gte("created_at", prevMonth).lt("created_at", month),
    ]);

    const requests = (reqRes.data ?? []) as Array<{ id: string; status: string }>;
    const prevRequests = (prevRes.data ?? []) as Array<{ id: string; status: string }>;
    const total = requests.length;
    const completed = requests.filter((r) => r.status === "released").length;
    const prevTotal = prevRequests.length;
    const prevCompleted = prevRequests.filter((r) => r.status === "released").length;
    const changePct = prevTotal > 0 ? (((total - prevTotal) / prevTotal) * 100).toFixed(1) : "0";

    const data = {
      total_requests: total,
      completed,
      pending: total - completed,
      prev_total: prevTotal,
      prev_completed: prevCompleted,
      change_percent: changePct,
    };

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("monthly_reports").upsert({ report_month: month, report_type: "document_requests", data, created_by: user?.id ?? null }, { onConflict: "report_month,report_type" });
    setReports((prev) => [{ id: "", report_month: month, report_type: "document_requests", data, created_at: new Date().toISOString() }, ...prev]);
    setGenerating(false);
  }

  function handleExportReport(r: (typeof reports)[0]) {
    exportToExcel([r.data as Record<string, unknown>], "Report", `report_${r.report_month}`);
  }

  if (loading || !isAdmin) {
    return (
      <div className="max-w-4xl mx-auto card text-center">
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={generateMonthlyReport}
          disabled={generating}
          className="inline-flex items-center gap-2 bg-[#1E3A8A] text-white font-semibold py-2.5 px-5 rounded-lg hover:bg-[#1e3a8a]/90 transition"
        >
          {generating ? "Generating…" : "Generate Report"}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                <th className="py-3 px-4 font-semibold text-gray-700">Report</th>
                <th className="py-3 px-4 font-semibold text-gray-700">Generated</th>
                <th className="py-3 px-4 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-gray-500">
                    No reports yet.
                  </td>
                </tr>
              ) : (
                reports.map((r) => (
                  <tr key={r.id || r.report_month} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="py-3 px-4">
                      {r.report_type === "document_requests" ? "Document Requests" : r.report_type} — {r.report_month}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {new Date(r.created_at).toLocaleString("en-PH", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => handleExportReport(r)}
                        className="text-[#1E3A8A] font-medium hover:underline"
                      >
                        Export
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
