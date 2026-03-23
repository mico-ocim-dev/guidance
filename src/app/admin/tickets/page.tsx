"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import type { Ticket } from "@/types/database";

const STATUSES = ["open", "assigned", "in_progress", "resolved", "closed"] as const;
const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
const TIME_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
];

function isAppointmentTicket(t: Ticket): boolean {
  return !!(t.subject && (t.subject.includes("Appointment cancellation") || t.subject.includes("Appointment schedule change")));
}

function parseTrackingFromDescription(description: string | null): string | null {
  if (!description) return null;
  const m = description.match(/Tracking:\s*(\S+)/);
  return m ? m[1].trim() : null;
}

export default function AdminTicketsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [users, setUsers] = useState<Array<{ id: string; full_name: string | null }>>([]);
  const [filter, setFilter] = useState<"all" | "appointment">("all");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("08:00");

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
          if (data?.role !== "admin" && data?.role !== "staff" && !isAdminEmail) {
            router.replace("/dashboard");
            return;
          }
          setIsAdmin(true);
          supabase.from("tickets").select("*").order("created_at", { ascending: false }).then(({ data }) => setTickets((data as Ticket[]) ?? []));
          supabase.from("profiles").select("id, first_name, last_name").in("role", ["admin", "staff"]).then(({ data }) => {
            const list = (data ?? []).map((p: { id: string; first_name: string; last_name: string }) => ({ id: p.id, full_name: `${p.first_name} ${p.last_name}`.trim() || null }));
            setUsers(list);
          });
        });
      })
    ).finally(() => setLoading(false));
  }, [router]);

  const todayDateStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  const visibleTickets = filter === "appointment" ? tickets.filter(isAppointmentTicket) : tickets;

  async function updateTicket(id: string, updates: Partial<Ticket>) {
    const supabase = createClient();
    if (updates.status === "resolved" || updates.status === "closed") {
      (updates as Partial<Ticket>).resolved_at = new Date().toISOString();
    }
    await supabase.from("tickets").update(updates).eq("id", id);
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  }

  async function handleCancelAppointment(ticket: Ticket) {
    const tracking = parseTrackingFromDescription(ticket.description);
    if (!tracking) {
      setActionMessage({ type: "error", text: "Could not find appointment tracking number in this ticket." });
      return;
    }
    setActionLoading(true);
    setActionMessage(null);
    const supabase = createClient();
    const { data: appt } = await supabase.from("appointments").select("id").eq("tracking_number", tracking).maybeSingle();
    if (!appt) {
      setActionLoading(false);
      setActionMessage({ type: "error", text: "Appointment not found for this tracking number." });
      return;
    }
    const { error: updateErr } = await supabase.from("appointments").update({ status: "cancelled" }).eq("id", (appt as { id: string }).id);
    if (updateErr) {
      setActionLoading(false);
      setActionMessage({ type: "error", text: updateErr.message || "Failed to cancel appointment." });
      return;
    }
    await updateTicket(ticket.id, { status: "resolved" });
    setActionLoading(false);
    setActionMessage({ type: "success", text: "Appointment cancelled and ticket marked resolved." });
    setSelectedTicket((t) => (t?.id === ticket.id ? { ...t, status: "resolved" } : t));
  }

  async function handleReschedule(ticket: Ticket) {
    const tracking = parseTrackingFromDescription(ticket.description);
    if (!tracking || !rescheduleDate) {
      setActionMessage({ type: "error", text: "Missing tracking or new date." });
      return;
    }
    if (rescheduleDate < todayDateStr) {
      setActionMessage({ type: "error", text: "New date cannot be before today." });
      return;
    }
    setActionLoading(true);
    setActionMessage(null);
    const supabase = createClient();
    const { data: appt } = await supabase.from("appointments").select("id").eq("tracking_number", tracking).maybeSingle();
    if (!appt) {
      setActionLoading(false);
      setActionMessage({ type: "error", text: "Appointment not found for this tracking number." });
      return;
    }
    const { error: updateErr } = await supabase.from("appointments").update({
      preferred_date: rescheduleDate,
      preferred_time: rescheduleTime,
    }).eq("id", (appt as { id: string }).id);
    if (updateErr) {
      setActionLoading(false);
      setActionMessage({ type: "error", text: updateErr.message || "Failed to reschedule." });
      return;
    }
    await updateTicket(ticket.id, { status: "resolved" });
    setActionLoading(false);
    setActionMessage({ type: "success", text: "Appointment rescheduled and ticket marked resolved." });
    setRescheduleOpen(false);
    setRescheduleDate("");
    setRescheduleTime("08:00");
    setSelectedTicket((t) => (t?.id === ticket.id ? { ...t, status: "resolved" } : t));
  }

  if (loading || !isAdmin) {
    return (
      <div className="max-w-4xl mx-auto card text-center">
        <p>Loading…</p>
      </div>
    );
  }

  const appointmentCount = tickets.filter(isAppointmentTicket).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gco-primary">Help Desk / Tickets</h1>
        <Link href="/admin/dashboard" className="btn-secondary">Back to Dashboard</Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filter === "all" ? "bg-[#1E3A8A] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
        >
          All tickets
        </button>
        <button
          type="button"
          onClick={() => setFilter("appointment")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filter === "appointment" ? "bg-[#1E3A8A] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
        >
          Appointment requests ({appointmentCount})
        </button>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          {filter === "appointment" ? "Appointment cancellation & schedule change requests" : "All tickets"}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-2">Subject</th>
                <th className="py-2 pr-2">Requester</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Priority</th>
                <th className="py-2 pr-2">Assigned</th>
                <th className="py-2 pr-2">Created</th>
                <th className="py-2 pr-2 w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleTickets.length === 0 ? (
                <tr><td colSpan={8} className="py-4 text-gray-500">No tickets.</td></tr>
              ) : (
                visibleTickets.map((t) => (
                  <tr key={t.id} className="border-b border-gray-100">
                    <td className="py-2 pr-2 font-mono">{t.ticket_number ?? t.id.slice(0, 8)}</td>
                    <td className="py-2 pr-2">{t.subject}</td>
                    <td className="py-2 pr-2">{t.requester_email}</td>
                    <td className="py-2 pr-2">
                      <select value={t.status} onChange={(e) => updateTicket(t.id, { status: e.target.value })} className="border border-gray-300 rounded px-2 py-1 text-sm">
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <select value={t.priority ?? "medium"} onChange={(e) => updateTicket(t.id, { priority: e.target.value })} className="border border-gray-300 rounded px-2 py-1 text-sm">
                        {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <select value={t.assigned_to ?? ""} onChange={(e) => updateTicket(t.id, { assigned_to: e.target.value || null })} className="border border-gray-300 rounded px-2 py-1 text-sm">
                        <option value="">—</option>
                        {users.map((u) => <option key={u.id} value={u.id}>{u.full_name ?? u.id.slice(0, 8)}</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-2">{new Date(t.created_at).toLocaleDateString()}</td>
                    <td className="py-2 pr-2">
                      <button type="button" onClick={() => setSelectedTicket(t)} className="text-[#1E3A8A] font-medium hover:underline text-xs">
                        View & act
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setSelectedTicket(null); setRescheduleOpen(false); setActionMessage(null); }}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">{selectedTicket.subject}</h3>
              <button type="button" onClick={() => { setSelectedTicket(null); setRescheduleOpen(false); setActionMessage(null); }} className="text-gray-500 hover:text-gray-700 p-1" aria-label="Close">✕</button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              <p className="text-sm text-gray-600"><span className="font-medium">Requester:</span> {selectedTicket.requester_name ?? selectedTicket.requester_email}</p>
              <p className="text-sm text-gray-600"><span className="font-medium">Created:</span> {new Date(selectedTicket.created_at).toLocaleString()}</p>
              {selectedTicket.description && (
                <div className="text-sm">
                  <p className="font-medium text-gray-700 mb-1">Details / Reason</p>
                  <pre className="whitespace-pre-wrap bg-gray-50 p-3 rounded-lg text-gray-800 font-sans text-xs">{selectedTicket.description}</pre>
                </div>
              )}
              {actionMessage && (
                <div className={`text-sm px-3 py-2 rounded-lg ${actionMessage.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
                  {actionMessage.text}
                </div>
              )}
              {isAppointmentTicket(selectedTicket) && (selectedTicket.status === "open" || selectedTicket.status === "assigned" || selectedTicket.status === "in_progress") && (
                <div className="pt-2 border-t border-gray-100 space-y-2">
                  <p className="text-sm font-medium text-gray-700">Appointment actions</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleCancelAppointment(selectedTicket)}
                      disabled={actionLoading}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
                    >
                      Cancel appointment
                    </button>
                    <Link
                      href={`/admin/appointments?search=${encodeURIComponent(parseTrackingFromDescription(selectedTicket.description) ?? "")}`}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 inline-block"
                    >
                      View in Appointments
                    </Link>
                    {selectedTicket.subject?.includes("schedule change") && (
                      <button
                        type="button"
                        onClick={() => setRescheduleOpen(true)}
                        disabled={actionLoading}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[#1E3A8A] text-white hover:bg-[#1E3A8A]/90 disabled:opacity-50"
                      >
                        Reschedule appointment
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {rescheduleOpen && selectedTicket && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setRescheduleOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-800">Reschedule appointment</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New date</label>
              <input type="date" min={todayDateStr} value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} className="input-field w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New time</label>
              <select value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} className="input-field w-full">
                {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => handleReschedule(selectedTicket)} disabled={actionLoading || !rescheduleDate} className="btn-primary flex-1">
                {actionLoading ? "Saving…" : "Save & resolve ticket"}
              </button>
              <button type="button" onClick={() => setRescheduleOpen(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
