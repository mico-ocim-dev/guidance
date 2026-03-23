"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { exportToExcel } from "@/lib/excel";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler,
} from "chart.js";
import { Doughnut, Line, Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

type ReportRow = {
  id: string;
  report_month: string;
  report_type: string;
  data: Record<string, unknown>;
  created_at: string;
};

type Analytics = {
  docRequests: { total: number; byStatus: Record<string, number>; trend: { month: string; count: number }[] };
  appointments: { total: number; byStatus: Record<string, number>; byType: Record<string, number> };
  tickets: { total: number; open: number; byStatus: Record<string, number> };
  users: { total: number; byRole: Record<string, number> };
};

const DOC_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  ready: "Ready",
  released: "Released",
  cancelled: "Cancelled",
};

const APPT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

const TICKET_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  assigned: "Assigned",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

const CHART_COLORS = {
  primary: "#1E3A8A",
  primaryLight: "rgba(30, 58, 138, 0.15)",
  success: "#16a34a",
  warning: "#ca8a04",
  neutral: "#64748b",
  palette: ["#1E3A8A", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#c7d2fe"],
};

export default function AdminReportsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [generating, setGenerating] = useState(false);
  const [analyticsOn, setAnalyticsOn] = useState(true);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    Promise.resolve(
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) {
          router.replace("/auth/login");
          return;
        }
        const isAdminEmail = user.email?.toLowerCase() === "admin@demo.com";
        return supabase.from("profiles").select("role").eq("id", user.id).single().then(({ data }) => {
          if (data?.role !== "admin" && !isAdminEmail) {
            router.replace("/dashboard");
            return;
          }
          setIsAdmin(true);
          supabase.from("monthly_reports").select("*").order("report_month", { ascending: false }).then(({ data }) => setReports((data ?? []) as ReportRow[]));
        });
      })
    ).finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!isAdmin || !analyticsOn) {
      setAnalytics(null);
      return;
    }
    setAnalyticsLoading(true);
    const supabase = createClient();
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const from = sixMonthsAgo.toISOString().slice(0, 10);
    const to = now.toISOString().slice(0, 10);

    Promise.all([
      supabase.from("document_requests").select("id, status, created_at").gte("created_at", from).lte("created_at", to + "T23:59:59").is("archived_at", null),
      supabase.from("appointments").select("id, status, appointment_type, created_at").gte("created_at", from).lte("created_at", to + "T23:59:59"),
      supabase.from("tickets").select("id, status"),
      supabase.from("profiles").select("id, role"),
    ]).then(([docRes, apptRes, ticketRes, profilesRes]) => {
      const docs = (docRes.data ?? []) as Array<{ id: string; status: string; created_at: string }>;
      const appts = (apptRes.data ?? []) as Array<{ id: string; status: string; appointment_type: string; created_at: string }>;
      const tickets = (ticketRes.data ?? []) as Array<{ id: string; status: string }>;
      const profiles = (profilesRes.data ?? []) as Array<{ id: string; role: string }>;

      const docByStatus: Record<string, number> = {};
      const trendByMonth: Record<string, number> = {};
      for (const d of docs) {
        docByStatus[d.status] = (docByStatus[d.status] ?? 0) + 1;
        const month = d.created_at.slice(0, 7);
        trendByMonth[month] = (trendByMonth[month] ?? 0) + 1;
      }
      const trendMonths = Object.keys(trendByMonth).sort();
      const trend = trendMonths.map((month) => ({ month, count: trendByMonth[month] ?? 0 }));

      const apptByStatus: Record<string, number> = {};
      const apptByType: Record<string, number> = {};
      for (const a of appts) {
        apptByStatus[a.status] = (apptByStatus[a.status] ?? 0) + 1;
        apptByType[a.appointment_type] = (apptByType[a.appointment_type] ?? 0) + 1;
      }

      const ticketByStatus: Record<string, number> = {};
      let openTickets = 0;
      for (const t of tickets) {
        ticketByStatus[t.status] = (ticketByStatus[t.status] ?? 0) + 1;
        if (["open", "assigned", "in_progress"].includes(t.status)) openTickets++;
      }

      const byRole: Record<string, number> = {};
      for (const p of profiles) {
        const r = p.role ?? "user";
        byRole[r] = (byRole[r] ?? 0) + 1;
      }

      setAnalytics({
        docRequests: { total: docs.length, byStatus: docByStatus, trend },
        appointments: { total: appts.length, byStatus: apptByStatus, byType: apptByType },
        tickets: { total: tickets.length, open: openTickets, byStatus: ticketByStatus },
        users: { total: profiles.length, byRole },
      });
      setAnalyticsLoading(false);
    });
  }, [isAdmin, analyticsOn]);

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
    const changePct = prevTotal > 0 ? (((total - prevTotal) / prevTotal) * 100).toFixed(1) : "0";

    const data = {
      total_requests: total,
      completed,
      pending: total - completed,
      prev_total: prevTotal,
      prev_completed: prevRequests.filter((r) => r.status === "released").length,
      change_percent: changePct,
    };

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("monthly_reports").upsert({ report_month: month, report_type: "document_requests", data, created_by: user?.id ?? null }, { onConflict: "report_month,report_type" });
    setReports((prev) => [{ id: "", report_month: month, report_type: "document_requests", data, created_at: new Date().toISOString() }, ...prev]);
    setGenerating(false);
  }

  function handleExportReport(r: ReportRow) {
    exportToExcel([r.data as Record<string, unknown>], "Report", `report_${r.report_month}`);
  }

  if (loading || !isAdmin) {
    return (
      <div className="max-w-4xl mx-auto card text-center py-12">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top bar: toggle + Generate button */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-600">Analytics</span>
          <button
            type="button"
            role="switch"
            aria-checked={analyticsOn}
            onClick={() => setAnalyticsOn((v) => !v)}
            className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] focus:ring-offset-2 ${
              analyticsOn ? "bg-[#1E3A8A]" : "bg-gray-200"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform mt-1 ${
                analyticsOn ? "translate-x-6 ml-0.5" : "translate-x-1 ml-0.5"
              }`}
            />
          </button>
          <span className="text-sm text-gray-500">{analyticsOn ? "On" : "Off"}</span>
        </div>
        <button
          type="button"
          onClick={generateMonthlyReport}
          disabled={generating}
          className="inline-flex items-center gap-2 bg-[#1E3A8A] text-white font-semibold py-2.5 px-5 rounded-lg hover:bg-[#1e3a8a]/90 transition shadow-sm"
        >
          {generating ? "Generating…" : "Generate monthly report"}
        </button>
      </div>

      {/* Analytics section (when toggled on) */}
      {analyticsOn && (
        <div className="space-y-6">
          {analyticsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-2/3 mb-3" />
                  <div className="h-8 bg-gray-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : analytics ? (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Document requests</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.docRequests.total}</p>
                  <p className="text-xs text-gray-500 mt-1">Last 6 months</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Appointments</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.appointments.total}</p>
                  <p className="text-xs text-gray-500 mt-1">Last 6 months</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Open tickets</p>
                  <p className="text-2xl font-bold text-amber-600">{analytics.tickets.open}</p>
                  <p className="text-xs text-gray-500 mt-1">of {analytics.tickets.total} total</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Registered users</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.users.total}</p>
                  <p className="text-xs text-gray-500 mt-1">By role</p>
                </div>
              </div>

              {/* Charts row 1: Document requests + Appointments status */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h3 className="text-base font-semibold text-gray-800 mb-4">Document requests by status</h3>
                  {analytics.docRequests.total > 0 ? (
                    <div className="h-64 flex items-center justify-center">
                      <Doughnut
                        data={{
                          labels: Object.entries(analytics.docRequests.byStatus).map(([k]) => DOC_STATUS_LABELS[k] ?? k),
                          datasets: [
                            {
                              data: Object.values(analytics.docRequests.byStatus),
                              backgroundColor: CHART_COLORS.palette,
                              borderWidth: 0,
                            },
                          ],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: { legend: { position: "bottom" } },
                        }}
                      />
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No data in period</div>
                  )}
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h3 className="text-base font-semibold text-gray-800 mb-4">Appointments by status</h3>
                  {analytics.appointments.total > 0 ? (
                    <div className="h-64 flex items-center justify-center">
                      <Doughnut
                        data={{
                          labels: Object.entries(analytics.appointments.byStatus).map(([k]) => APPT_STATUS_LABELS[k] ?? k),
                          datasets: [
                            {
                              data: Object.values(analytics.appointments.byStatus),
                              backgroundColor: ["#1E3A8A", "#16a34a", "#64748b", "#dc2626"],
                              borderWidth: 0,
                            },
                          ],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: { legend: { position: "bottom" } },
                        }}
                      />
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No data in period</div>
                  )}
                </div>
              </div>

              {/* Charts row 2: Doc trend + Appointment types + Tickets */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 lg:col-span-2">
                  <h3 className="text-base font-semibold text-gray-800 mb-4">Document requests trend (last 6 months)</h3>
                  {analytics.docRequests.trend.length > 0 ? (
                    <div className="h-56">
                      <Line
                        data={{
                          labels: analytics.docRequests.trend.map(({ month }) => {
                            const [y, m] = month.split("-");
                            return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-PH", { month: "short", year: "2-digit" });
                          }),
                          datasets: [
                            {
                              label: "Requests",
                              data: analytics.docRequests.trend.map(({ count }) => count),
                              borderColor: CHART_COLORS.primary,
                              backgroundColor: CHART_COLORS.primaryLight,
                              fill: true,
                              tension: 0.3,
                            },
                          ],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: { legend: { display: false } },
                          scales: { y: { beginAtZero: true } },
                        }}
                      />
                    </div>
                  ) : (
                    <div className="h-56 flex items-center justify-center text-gray-400 text-sm">No data in period</div>
                  )}
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h3 className="text-base font-semibold text-gray-800 mb-4">Tickets by status</h3>
                  {analytics.tickets.total > 0 ? (
                    <div className="h-56 flex items-center justify-center">
                      <Doughnut
                        data={{
                          labels: Object.entries(analytics.tickets.byStatus).map(([k]) => TICKET_STATUS_LABELS[k] ?? k),
                          datasets: [
                            {
                              data: Object.values(analytics.tickets.byStatus),
                              backgroundColor: ["#dc2626", "#ca8a04", "#1E3A8A", "#16a34a", "#64748b"],
                              borderWidth: 0,
                            },
                          ],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: { legend: { position: "bottom" } },
                        }}
                      />
                    </div>
                  ) : (
                    <div className="h-56 flex items-center justify-center text-gray-400 text-sm">No tickets</div>
                  )}
                </div>
              </div>

              {/* Appointment types bar + Users by role */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h3 className="text-base font-semibold text-gray-800 mb-4">Appointments by type</h3>
                  {Object.keys(analytics.appointments.byType).length > 0 ? (
                    <div className="h-56">
                      <Bar
                        data={{
                          labels: Object.keys(analytics.appointments.byType),
                          datasets: [
                            {
                              label: "Count",
                              data: Object.values(analytics.appointments.byType),
                              backgroundColor: CHART_COLORS.primaryLight,
                              borderColor: CHART_COLORS.primary,
                              borderWidth: 1,
                            },
                          ],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: { legend: { display: false } },
                          scales: { y: { beginAtZero: true } },
                        }}
                      />
                    </div>
                  ) : (
                    <div className="h-56 flex items-center justify-center text-gray-400 text-sm">No data in period</div>
                  )}
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h3 className="text-base font-semibold text-gray-800 mb-4">Users by role</h3>
                  {analytics.users.total > 0 ? (
                    <div className="h-56">
                      <Bar
                        data={{
                          labels: Object.keys(analytics.users.byRole).map((r) => r.charAt(0).toUpperCase() + r.slice(1)),
                          datasets: [
                            {
                              label: "Users",
                              data: Object.values(analytics.users.byRole),
                              backgroundColor: ["#1E3A8A", "#2563eb", "#64748b"],
                              borderWidth: 0,
                            },
                          ],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: { legend: { display: false } },
                          scales: { y: { beginAtZero: true } },
                        }}
                      />
                    </div>
                  ) : (
                    <div className="h-56 flex items-center justify-center text-gray-400 text-sm">No users</div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Reports table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <h2 className="text-lg font-semibold text-gray-800 px-4 py-3 border-b border-gray-100">Monthly reports</h2>
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
                    No reports yet. Use &quot;Generate monthly report&quot; to create one.
                  </td>
                </tr>
              ) : (
                reports.map((r) => (
                  <tr key={r.id || r.report_month} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="py-3 px-4">
                      {r.report_type === "document_requests" ? "Document requests" : r.report_type} — {r.report_month}
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
