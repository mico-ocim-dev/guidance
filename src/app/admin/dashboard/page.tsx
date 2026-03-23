"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
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

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState({
    pending: 0,
    openTickets: 0,
    appointmentRequestTickets: 0,
    completed: 0,
    visitorsToday: 0,
    totalRequests: 0,
  });
  const [chartData, setChartData] = useState<{ labels: string[]; counts: number[] }>({ labels: [], counts: [] });
  const [appointmentSummary, setAppointmentSummary] = useState<{
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    calendarDays: Record<string, number>;
  }>({
    total: 0,
    byType: {},
    byStatus: {},
    calendarDays: {},
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [appointmentsForDate, setAppointmentsForDate] = useState<Array<{
    id: string;
    tracking_number: string;
    full_name: string;
    appointment_type: string;
    preferred_time: string;
    status: string;
  }>>([]);
  const [loadingAppointmentsForDate, setLoadingAppointmentsForDate] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    Promise.resolve(
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) {
          router.replace("/auth/login");
          return;
        }
        const isAdminEmail = user.email?.toLowerCase() === "admin@demo.com";
        return supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single()
          .then(({ data }) => {
            if (data?.role !== "admin" && !isAdminEmail) {
              router.replace("/dashboard");
              return;
            }
            setIsAdmin(true);
          });
      })
    ).finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!isAdmin) return;
    const supabase = createClient();
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    const from = monthStart.toISOString().slice(0, 10);
    const to = monthEnd.toISOString().slice(0, 10);

    Promise.all([
      supabase
        .from("document_requests")
        .select("id, status, created_at")
        .gte("created_at", from)
        .lte("created_at", to + "T23:59:59"),
      supabase.from("tickets").select("id, subject").or("status.eq.open,status.eq.assigned,status.eq.in_progress"),
      supabase
        .from("appointments")
        .select("id, preferred_date, appointment_type, status")
        .gte("preferred_date", from)
        .lte("preferred_date", to),
    ]).then(([reqRes, tickRes, apptRes]) => {
      const requests = (reqRes.data ?? []) as Array<{ id: string; status: string; created_at: string }>;
      const appointments = (apptRes.data ?? []) as Array<{
        id: string;
        preferred_date: string;
        appointment_type: string;
        status: string;
      }>;

      const totalRequests = requests.length;
      const pending = requests.filter((r) => ["pending", "processing", "ready"].includes(r.status)).length;
      const completed = requests.filter((r) => r.status === "released").length;
      const openTicketsRaw = (tickRes.data ?? []) as Array<{ id: string; subject: string | null }>;
      const openTickets = openTicketsRaw.length;
      const appointmentRequestTickets = openTicketsRaw.filter(
        (t) => t.subject && (t.subject.includes("Appointment cancellation") || t.subject.includes("Appointment schedule change"))
      ).length;

      const appointmentCalendar: Record<string, number> = {};
      const appointmentByType: Record<string, number> = {};
      const appointmentByStatus: Record<string, number> = {};
      appointments.forEach((a) => {
        appointmentCalendar[a.preferred_date] = (appointmentCalendar[a.preferred_date] ?? 0) + 1;
        appointmentByType[a.appointment_type] = (appointmentByType[a.appointment_type] ?? 0) + 1;
        appointmentByStatus[a.status] = (appointmentByStatus[a.status] ?? 0) + 1;
      });
      const visitorsToday = appointmentCalendar[today] ?? 0;

      setStats({ pending, openTickets, appointmentRequestTickets, completed, visitorsToday, totalRequests });
      setAppointmentSummary({
        total: appointments.length,
        byType: appointmentByType,
        byStatus: appointmentByStatus,
        calendarDays: appointmentCalendar,
      });

      const byDay: Record<string, number> = {};
      for (let d = new Date(from); d <= new Date(to); d.setDate(d.getDate() + 1)) {
        byDay[d.toISOString().slice(0, 10)] = 0;
      }
      requests.forEach((r) => {
        const day = r.created_at.slice(0, 10);
        if (byDay[day] !== undefined) byDay[day]++;
      });
      const labels = Object.keys(byDay).sort();
      const counts = labels.map((l) => byDay[l] ?? 0);
      setChartData({ labels, counts });
    });
  }, [isAdmin]);

  useEffect(() => {
    if (!selectedCalendarDate) {
      setAppointmentsForDate([]);
      return;
    }
    setLoadingAppointmentsForDate(true);
    const supabase = createClient();
    supabase
      .from("appointments")
      .select("id, tracking_number, full_name, appointment_type, preferred_time, status")
      .eq("preferred_date", selectedCalendarDate)
      .order("preferred_time")
      .then(
        ({ data }) => {
          setAppointmentsForDate((data ?? []) as Array<{
            id: string;
            tracking_number: string;
            full_name: string;
            appointment_type: string;
            preferred_time: string;
            status: string;
          }>);
          setLoadingAppointmentsForDate(false);
        },
        () => setLoadingAppointmentsForDate(false)
      );
  }, [selectedCalendarDate]);

  if (loading || !isAdmin) {
    return (
      <div className="max-w-5xl mx-auto card text-center py-12">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  const other = Math.max(0, stats.totalRequests - stats.pending - stats.completed);
  const doughnutData = {
    labels: ["Pending", "Completed", "Other"].filter((_, i) => [stats.pending, stats.completed, other][i] > 0),
    datasets: [
      {
        data: [stats.pending, stats.completed, other].filter((n) => n > 0),
        backgroundColor: ["#1E3A8A", "#22c55e", "#94a3b8"],
        borderWidth: 0,
      },
    ],
  };

  const lineChartData = {
    labels: chartData.labels.map((l) => {
      const d = new Date(l);
      return d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
    }),
    datasets: [
      {
        label: "Requests",
        data: chartData.counts,
        borderColor: "#1E3A8A",
        backgroundColor: "rgba(30, 58, 138, 0.1)",
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" as const },
    },
    scales: {
      y: { beginAtZero: true },
    },
  };

  const todayDate = new Date();
  const monthStartDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
  const monthEndDate = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0);
  const monthLabel = monthStartDate.toLocaleDateString("en-PH", { month: "long", year: "numeric" });
  const startWeekday = monthStartDate.getDay(); // 0 (Sun) - 6 (Sat)
  const daysInMonth = monthEndDate.getDate();
  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  const appointmentTypeLabels = Object.keys(appointmentSummary.byType);
  const appointmentTypeData = Object.values(appointmentSummary.byType);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-xl border border-gray-100 shadow-md p-6">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">Pending Requests</p>
          <p className="text-3xl font-bold text-gray-800">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-md p-6">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">Open Tickets</p>
          <p className="text-3xl font-bold text-gray-800">{stats.openTickets}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-md p-6">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">Completed Requests</p>
          <p className="text-3xl font-bold text-gray-800">{stats.completed}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-md p-6">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">Visitors Today</p>
          <p className="text-3xl font-bold text-gray-800">{stats.visitorsToday}</p>
        </div>
      </div>

      {stats.appointmentRequestTickets > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-amber-800 font-medium">
            {stats.appointmentRequestTickets} appointment request(s) (cancellation or schedule change) need your attention in Help Desk.
          </p>
          <Link href="/admin/tickets" className="btn-primary whitespace-nowrap">
            Open Help Desk
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-md p-6">
          <h3 className="font-semibold text-gray-800 text-base mb-4">Request Status Distribution</h3>
          {stats.totalRequests > 0 ? (
            <div className="h-72 flex items-center justify-center">
              <Doughnut
                data={doughnutData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: "bottom" } },
                }}
              />
            </div>
          ) : (
            <div className="h-72 flex items-center justify-center text-gray-400">No requests yet</div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-md p-6">
          <h3 className="font-semibold text-gray-800 text-base mb-4">Monthly Trend (Requests)</h3>
          <div className="h-72">
            <Line data={lineChartData} options={chartOptions} />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-md p-6">
          <h3 className="font-semibold text-gray-800 text-base mb-4">Appointments by type (this month)</h3>
          {appointmentTypeLabels.length > 0 ? (
            <div className="h-72">
              <Bar
                data={{
                  labels: appointmentTypeLabels,
                  datasets: [
                    {
                      label: "Appointments",
                      data: appointmentTypeData,
                      backgroundColor: "rgba(30, 58, 138, 0.15)",
                      borderColor: "#1E3A8A",
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
            <div className="h-72 flex items-center justify-center text-gray-400 text-sm">No appointments this month</div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 text-base">Appointments calendar</h3>
          <p className="text-sm text-gray-500">{monthLabel}</p>
        </div>
        <div className="grid grid-cols-7 gap-1 text-xs text-gray-500 mb-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-center py-1 font-medium">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 text-sm">
          {calendarCells.map((day, idx) => {
            if (day === null) {
              return <div key={idx} className="h-14" />;
            }
            const y = todayDate.getFullYear();
            const m = todayDate.getMonth();
            const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const count = appointmentSummary.calendarDays[dateStr] ?? 0;
            const todayStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, "0")}-${String(todayDate.getDate()).padStart(2, "0")}`;
            const isToday = dateStr === todayStr;
            const hasAppointments = count > 0;
            return (
              <button
                type="button"
                key={idx}
                onClick={() => setSelectedCalendarDate(dateStr)}
                className={`h-14 rounded-lg flex flex-col items-center justify-center border text-xs text-center transition-colors cursor-pointer ${
                  isToday
                    ? "bg-amber-100 border-amber-500 ring-2 ring-amber-500 text-amber-900 font-bold shadow-sm"
                    : hasAppointments
                      ? "border-[#1E3A8A]/50 bg-[#1E3A8A]/10 text-gray-800 hover:bg-[#1E3A8A]/20"
                      : "border-gray-200 bg-gray-50/50 text-gray-700 hover:bg-gray-100"
                }`}
                title={hasAppointments ? `View ${count} appointment(s)` : `View ${dateStr}`}
              >
                <span className="text-base font-semibold tabular-nums block text-center w-full" aria-label={`Date: ${day}`}>
                  {day}
                </span>
                {hasAppointments && (
                  <span className="mt-0.5 text-[10px] font-normal text-[#1E3A8A] opacity-90 block text-center w-full" aria-label={`${count} appointment(s)`}>
                    {count} {count === 1 ? "appt" : "appts"}
                  </span>
                )}
                {isToday && (
                  <span className="mt-0.5 text-[9px] font-semibold uppercase text-amber-700 block text-center w-full">Today</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedCalendarDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedCalendarDate(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">
                Appointments on {new Date(selectedCalendarDate + "T12:00:00").toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedCalendarDate(null)}
                className="text-gray-500 hover:text-gray-700 p-1 rounded"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {loadingAppointmentsForDate ? (
                <p className="text-gray-500 text-sm">Loading…</p>
              ) : appointmentsForDate.length === 0 ? (
                <p className="text-gray-500 text-sm">No appointments scheduled for this day.</p>
              ) : (
                <ul className="space-y-3">
                  {appointmentsForDate.map((apt) => (
                    <li key={apt.id} className="border border-gray-100 rounded-lg p-3 text-sm">
                      <div className="font-medium text-gray-800">{apt.tracking_number}</div>
                      <div className="text-gray-600">{apt.full_name}</div>
                      <div className="flex flex-wrap gap-2 mt-1 text-xs">
                        <span className="text-gray-500">{apt.appointment_type}</span>
                        <span className="text-gray-500">{apt.preferred_time}</span>
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">{apt.status}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
