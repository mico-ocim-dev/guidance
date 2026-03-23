"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import type { Appointment } from "@/types/database";

const APPOINTMENT_STATUSES: Appointment["status"][] = ["pending", "confirmed", "cancelled", "completed"];

const STATUS_LABELS: Record<Appointment["status"], string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  completed: "Completed",
};

/** Sequential flow (excluding cancelled). */
const FLOW_ORDER: Appointment["status"][] = ["pending", "confirmed", "completed"];

function getFlowIndex(status: Appointment["status"]): number {
  const i = FLOW_ORDER.indexOf(status);
  return i >= 0 ? i : -1;
}

function isPastStatus(current: Appointment["status"], optionStatus: Appointment["status"]): boolean {
  if (current === "cancelled") return optionStatus !== "cancelled";
  if (optionStatus === "cancelled") return false;
  return getFlowIndex(optionStatus) < getFlowIndex(current);
}

function isRevert(current: Appointment["status"], newStatus: Appointment["status"]): boolean {
  if (current === newStatus) return false;
  if (current === "cancelled") return true;
  if (newStatus === "cancelled") return false;
  return getFlowIndex(newStatus) < getFlowIndex(current);
}

function isSkipForward(current: Appointment["status"], newStatus: Appointment["status"]): boolean {
  if (current === newStatus) return false;
  if (newStatus === "cancelled") return false;
  if (current === "cancelled") return newStatus !== "pending";
  const ci = getFlowIndex(current);
  const ni = getFlowIndex(newStatus);
  if (ci < 0 || ni < 0) return false;
  return ni > ci + 1;
}

function isDisabledOption(current: Appointment["status"], optionStatus: Appointment["status"]): boolean {
  if (optionStatus === current) return false;
  if (optionStatus === "cancelled") return false;
  if (current === "cancelled") return optionStatus !== "pending";
  if (isPastStatus(current, optionStatus)) return false;
  const ci = getFlowIndex(current);
  const oi = getFlowIndex(optionStatus);
  if (ci < 0 || oi < 0) return false;
  return oi > ci + 1;
}

export default function AdminAppointmentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isStaff, setIsStaff] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [promptMessage, setPromptMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [batchStatus, setBatchStatus] = useState<Appointment["status"]>("confirmed");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Appointment["status"]>("all");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("search");
    if (q) setSearchQuery(q);
  }, []);

  function showPrompt(type: "success" | "error", text: string) {
    setPromptMessage({ type, text });
    setTimeout(() => setPromptMessage(null), 3000);
  }

  useEffect(() => {
    const supabase = createClient();
    const p = supabase.auth.getUser().then(({ data: { user } }) => {
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
          if (data?.role !== "admin" && data?.role !== "staff" && !isAdminEmail) {
            router.replace("/dashboard");
            return;
          }
          setIsStaff(true);
          return supabase
            .from("appointments")
            .select("*")
            .order("created_at", { ascending: false })
            .then(({ data }) => {
              const next = (data as Appointment[]) ?? [];
              setAppointments(next);
              setSelectedIds((prev) => {
                if (prev.size === 0) return prev;
                const allowed = new Set(next.map((r) => r.id));
                const out = new Set<string>();
                prev.forEach((id) => {
                  if (allowed.has(id)) out.add(id);
                });
                return out;
              });
            });
        });
    });
    Promise.resolve(p).finally(() => setLoading(false));
  }, [router]);

  const q = searchQuery.trim().toLowerCase();
  const visibleAppointments = appointments.filter((a) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (!q) return true;
    const hay = [a.tracking_number, a.full_name, a.email, a.appointment_type, a.purpose ?? "", a.preferred_date, a.preferred_time, STATUS_LABELS[a.status]].join(" ").toLowerCase();
    return hay.includes(q);
  });

  const allVisibleSelected = visibleAppointments.length > 0 && visibleAppointments.every((a) => selectedIds.has(a.id));

  async function updateStatus(id: string, newStatus: Appointment["status"]) {
    if (isSkipForward(appointments.find((a) => a.id === id)?.status ?? "pending", newStatus)) {
      showPrompt("error", "You can't skip steps. Please move to the next status in order.");
      return;
    }
    const current = appointments.find((a) => a.id === id)?.status;
    if (current && isRevert(current, newStatus)) {
      const ok = confirm(`Revert status from "${STATUS_LABELS[current]}" to "${STATUS_LABELS[newStatus]}"? This moves the appointment back to an earlier step.`);
      if (!ok) return;
    }
    const supabase = createClient();
    const { error } = await supabase.from("appointments").update({ status: newStatus }).eq("id", id);
    if (error) {
      showPrompt("error", "Failed to update status: " + (error.message || "Try again."));
      return;
    }
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a)));
    showPrompt("success", "Status updated successfully.");
  }

  async function batchUpdateStatus(newStatus: Appointment["status"]) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const targets = appointments.filter((a) => selectedIds.has(a.id));
    const invalidSkip = targets.filter((a) => isSkipForward(a.status, newStatus));
    if (invalidSkip.length > 0) {
      showPrompt("error", `Batch update blocked: ${invalidSkip.length} selected appointment(s) would skip steps. Move them one step at a time.`);
      return;
    }
    const hasRevert = targets.some((a) => isRevert(a.status, newStatus));
    if (hasRevert) {
      const ok = confirm(`Some selected appointments will be reverted to an earlier step (${STATUS_LABELS[newStatus]}). Continue?`);
      if (!ok) return;
    }
    setSaving(true);
    const supabase = createClient();
    const results = await Promise.all(
      targets.map(async (a) => {
        const { error } = await supabase.from("appointments").update({ status: newStatus }).eq("id", a.id);
        return { id: a.id, error };
      })
    );
    const failures = results.filter((x) => x.error);
    const successes = results.filter((x) => !x.error);
    if (successes.length > 0) {
      setAppointments((prev) => prev.map((a) => (selectedIds.has(a.id) ? { ...a, status: newStatus } : a)));
      showPrompt("success", `Updated ${successes.length} appointment(s) to ${STATUS_LABELS[newStatus]}.`);
      setSelectedIds(new Set());
    }
    if (failures.length > 0) {
      showPrompt("error", `Updated ${successes.length}/${targets.length}. ${failures.length} failed — please try again.`);
    }
    setSaving(false);
  }

  async function batchDeleteSelected() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const ok = confirm(`Delete ${ids.length} selected appointment(s)? This cannot be undone.`);
    if (!ok) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("appointments").delete().in("id", ids);
    setSaving(false);
    if (error) {
      showPrompt("error", "Failed to delete selected appointments: " + (error.message || "Try again."));
      return;
    }
    setAppointments((prev) => prev.filter((a) => !selectedIds.has(a.id)));
    setSelectedIds(new Set());
    showPrompt("success", `Deleted ${ids.length} appointment(s).`);
  }

  if (loading || !isStaff) {
    return (
      <div className="max-w-5xl mx-auto card text-center py-12">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {promptMessage && (
        <div
          role="alert"
          className={`rounded-lg px-4 py-3 flex items-center justify-between gap-3 ${
            promptMessage.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <span className="font-medium">{promptMessage.text}</span>
          <button type="button" onClick={() => setPromptMessage(null)} className="shrink-0 p-1 rounded hover:bg-black/5" aria-label="Dismiss">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/appointments/book"
          className="inline-flex items-center gap-2 bg-[#1E3A8A] text-white font-semibold py-2.5 px-5 rounded-lg hover:bg-[#1e3a8a]/90 transition"
        >
          <span className="text-lg leading-none">+</span>
          Book Appointment
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[14rem]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search requester, email, type, date, status…"
            className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | Appointment["status"])}
            className="border border-gray-300 rounded px-2 py-2 text-sm min-w-[12rem]"
          >
            <option value="all">All</option>
            {APPOINTMENT_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        {(searchQuery.trim() || statusFilter !== "all") && (
          <button type="button" onClick={() => { setSearchQuery(""); setStatusFilter("all"); }} className="text-sm font-medium text-gray-600 hover:text-gray-800">
            Clear filters
          </button>
        )}
        <div className="text-xs text-gray-500 ml-auto">
          Showing <span className="font-semibold">{visibleAppointments.length}</span> of <span className="font-semibold">{appointments.length}</span>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="text-sm text-gray-700">
            <span className="font-semibold">{selectedIds.size}</span> selected
          </div>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="inline-flex items-center gap-2 border border-gray-300 bg-white text-gray-700 text-sm font-medium py-1.5 px-3 rounded hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50"
            disabled={saving}
          >
            Clear
          </button>
          <button
            type="button"
            onClick={batchDeleteSelected}
            disabled={saving || selectedIds.size === 0}
            className="inline-flex items-center gap-2 border border-red-200 bg-white text-red-600 text-sm font-medium py-1.5 px-3 rounded hover:bg-red-50 active:bg-red-100 disabled:opacity-50"
          >
            Delete selected
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <select
              value={batchStatus}
              onChange={(e) => setBatchStatus(e.target.value as Appointment["status"])}
              className="border border-gray-300 rounded px-2 py-1 text-sm min-w-[12rem]"
              disabled={saving}
            >
              {APPOINTMENT_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => batchUpdateStatus(batchStatus)}
              disabled={saving || selectedIds.size === 0}
              className="bg-[#1E3A8A] text-white text-sm font-medium py-2 px-4 rounded hover:bg-[#1e3a8a]/90 disabled:opacity-50"
            >
              {saving ? "Applying…" : "Apply to selected"}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                <th className="py-3 px-3 font-semibold text-gray-700 w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allVisibleSelected}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (checked) visibleAppointments.forEach((a) => next.add(a.id));
                        else visibleAppointments.forEach((a) => next.delete(a.id));
                        return next;
                      });
                    }}
                  />
                </th>
                <th className="py-3 px-4 font-semibold text-gray-700">Tracking #</th>
                <th className="py-3 px-4 font-semibold text-gray-700">Requester</th>
                <th className="py-3 px-4 font-semibold text-gray-700">Type</th>
                <th className="py-3 px-4 font-semibold text-gray-700">Requested</th>
                <th className="py-3 px-4 font-semibold text-gray-700">Appointment date</th>
                <th className="py-3 px-4 font-semibold text-gray-700">Time</th>
                <th className="py-3 px-4 font-semibold text-gray-700">Status</th>
                <th className="py-3 px-4 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleAppointments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-500">
                    No matching appointments.
                  </td>
                </tr>
              ) : (
                visibleAppointments.map((a) => (
                  <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="py-3 px-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${a.full_name}`}
                        checked={selectedIds.has(a.id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (checked) next.add(a.id);
                            else next.delete(a.id);
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td className="py-3 px-4 font-mono text-[#1E3A8A]">{a.tracking_number}</td>
                    <td className="py-3 px-4">{a.full_name}</td>
                    <td className="py-3 px-4">{a.appointment_type}</td>
                    <td className="py-3 px-4 text-gray-600">
                      {new Date(a.created_at).toLocaleDateString("en-PH", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      })}
                    </td>
                    <td className="py-3 px-4">{a.preferred_date}</td>
                    <td className="py-3 px-4">{typeof a.preferred_time === "string" ? a.preferred_time.slice(0, 5) : a.preferred_time}</td>
                    <td className="py-3 px-4">
                      <select
                        value={a.status}
                        onChange={(e) => {
                          const newStatus = e.target.value as Appointment["status"];
                          if (isSkipForward(a.status, newStatus)) {
                            showPrompt("error", "You can't skip steps. Please move to the next status in order.");
                            return;
                          }
                          if (isRevert(a.status, newStatus)) {
                            const ok = confirm(
                              `Revert status from "${STATUS_LABELS[a.status]}" to "${STATUS_LABELS[newStatus]}"? This moves the appointment back to an earlier step.`
                            );
                            if (!ok) return;
                          }
                          updateStatus(a.id, newStatus);
                        }}
                        className="border border-gray-300 rounded px-2 py-1 text-sm min-w-[10rem]"
                      >
                        {APPOINTMENT_STATUSES.map((s) => (
                          <option key={s} value={s} disabled={isDisabledOption(a.status, s)} className={isPastStatus(a.status, s) ? "text-gray-400 bg-gray-50" : ""}>
                            {STATUS_LABELS[s]}
                            {isPastStatus(a.status, s) ? " (previous step)" : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4 text-gray-500">—</td>
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
