"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler,
} from "chart.js";
import { Doughnut, Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
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
    completed: 0,
    visitorsToday: 0,
    totalRequests: 0,
  });
  const [chartData, setChartData] = useState<{ labels: string[]; counts: number[] }>({ labels: [], counts: [] });

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
    const from = monthStart.toISOString().slice(0, 10);
    const to = new Date().toISOString().slice(0, 10);

    Promise.all([
      supabase.from("document_requests").select("id, status, created_at").gte("created_at", from).lte("created_at", to + "T23:59:59"),
      supabase.from("tickets").select("id").or("status.eq.open,status.eq.assigned,status.eq.in_progress"),
      supabase.from("appointments").select("id, preferred_date").eq("preferred_date", today),
    ]).then(([reqRes, tickRes, visitorsRes]) => {
      const requests = (reqRes.data ?? []) as Array<{ id: string; status: string; created_at: string }>;
      const totalRequests = requests.length;
      const pending = requests.filter((r) => ["pending", "processing", "ready"].includes(r.status)).length;
      const completed = requests.filter((r) => r.status === "released").length;
      const openTickets = (tickRes.data ?? []).length;
      const visitorsToday = (visitorsRes.data ?? []).length;

      setStats({ pending, openTickets, completed, visitorsToday, totalRequests });

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
      </div>
    </div>
  );
}
