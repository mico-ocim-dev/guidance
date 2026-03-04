"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import type { Appointment, DocumentRequest } from "@/types/database";
import { exportDocumentRequestsToExcel } from "@/lib/excel";

const APPOINTMENT_STATUSES: Appointment["status"][] = ["pending", "confirmed", "cancelled", "completed"];
const DOC_REQUEST_STATUSES: DocumentRequest["status"][] = ["pending", "processing", "ready", "released", "cancelled"];

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [docRequests, setDocRequests] = useState<DocumentRequest[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/auth/login");
        return;
      }
      setUserId(user.id);
      const isAdminEmail = user.email?.toLowerCase() === "admin@demo.com";
      supabase
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
          supabase
            .from("appointments")
            .select("*")
            .order("created_at", { ascending: false })
            .then(({ data }) => setAppointments((data as Appointment[]) ?? []));
          supabase
            .from("document_requests")
            .select("*")
            .order("created_at", { ascending: false })
            .then(({ data }) => setDocRequests((data as DocumentRequest[]) ?? []));
        });
    }).finally(() => setLoading(false));
  }, [router]);

  async function updateAppointmentStatus(id: string, status: Appointment["status"]) {
    const supabase = createClient();
    await supabase.from("appointments").update({ status }).eq("id", id);
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  }

  async function updateDocRequestStatus(id: string, newStatus: DocumentRequest["status"], previousStatus: string) {
    const supabase = createClient();
    const updates: Partial<DocumentRequest> = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === "released") updates.completed_at = new Date().toISOString();
    await supabase.from("document_requests").update(updates).eq("id", id);
    await supabase.from("request_status_logs").insert({
      document_request_id: id,
      from_status: previousStatus,
      to_status: newStatus,
      changed_by: userId,
    });
    setDocRequests((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));
  }

  async function archiveDocRequest(id: string) {
    const supabase = createClient();
    await supabase.from("document_requests").update({ archived_at: new Date().toISOString(), archived_by: userId }).eq("id", id);
    setDocRequests((prev) => prev.map((d) => (d.id === id ? { ...d, archived_at: new Date().toISOString() } : d)));
  }

  function handleExportDocRequests() {
    const list = showArchived ? docRequests : docRequests.filter((d) => !d.archived_at);
    exportDocumentRequestsToExcel(
      list.map((d) => ({
        tracking_number: d.tracking_number,
        requester_name: d.requester_name,
        requester_email: d.requester_email,
        document_type: d.document_type,
        status: d.status,
        created_at: d.created_at,
        completed_at: d.completed_at ?? null,
      }))
    );
  }

  const docRequestsFiltered = showArchived ? docRequests : docRequests.filter((d) => !d.archived_at);

  if (loading || !isAdmin) {
    return (
      <div className="max-w-4xl mx-auto card text-center">
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gco-primary">Admin</h1>
        <Link href="/dashboard" className="btn-secondary">Back to Dashboard</Link>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">All Appointments</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="py-2 pr-2">Date</th>
                <th className="py-2 pr-2">Time</th>
                <th className="py-2 pr-2">Name</th>
                <th className="py-2 pr-2">Email</th>
                <th className="py-2 pr-2">Type</th>
                <th className="py-2 pr-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {appointments.length === 0 ? (
                <tr><td colSpan={6} className="py-4 text-gray-500">No appointments.</td></tr>
              ) : (
                appointments.map((a) => (
                  <tr key={a.id} className="border-b border-gray-100">
                    <td className="py-2 pr-2">{a.preferred_date}</td>
                    <td className="py-2 pr-2">{a.preferred_time}</td>
                    <td className="py-2 pr-2">{a.full_name}</td>
                    <td className="py-2 pr-2">{a.email}</td>
                    <td className="py-2 pr-2">{a.appointment_type}</td>
                    <td className="py-2 pr-2">
                      <select
                        value={a.status}
                        onChange={(e) => updateAppointmentStatus(a.id, e.target.value as Appointment["status"])}
                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                      >
                        {APPOINTMENT_STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-800">All Document Requests</h2>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="rounded border-gray-300 text-gco-primary"
              />
              Show archived
            </label>
            <button type="button" onClick={handleExportDocRequests} className="btn-secondary text-sm py-1.5 px-3">
              Export to Excel
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="py-2 pr-2">Tracking #</th>
                <th className="py-2 pr-2">Requester</th>
                <th className="py-2 pr-2">Email</th>
                <th className="py-2 pr-2">Document</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Processing time</th>
                <th className="py-2 pr-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {docRequestsFiltered.length === 0 ? (
                <tr><td colSpan={7} className="py-4 text-gray-500">No document requests.</td></tr>
              ) : (
                docRequestsFiltered.map((d) => {
                  const created = new Date(d.created_at).getTime();
                  const completed = d.completed_at ? new Date(d.completed_at).getTime() : null;
                  const hours = completed ? ((completed - created) / (1000 * 60 * 60)).toFixed(1) : "—";
                  return (
                    <tr key={d.id} className="border-b border-gray-100">
                      <td className="py-2 pr-2 font-mono">{d.tracking_number}</td>
                      <td className="py-2 pr-2">{d.requester_name}</td>
                      <td className="py-2 pr-2">{d.requester_email}</td>
                      <td className="py-2 pr-2">{d.document_type || "—"}</td>
                      <td className="py-2 pr-2">
                        <select
                          value={d.status}
                          onChange={(e) => updateDocRequestStatus(d.id, e.target.value as DocumentRequest["status"], d.status)}
                          className="border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                          {DOC_REQUEST_STATUSES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-2">{hours}h</td>
                      <td className="py-2 pr-2">
                        {!d.archived_at && (
                          <button
                            type="button"
                            onClick={() => archiveDocRequest(d.id)}
                            className="text-amber-600 hover:underline text-xs"
                          >
                            Archive
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/admin/users" className="btn-primary">User roles</Link>
        <Link href="/admin/dashboard" className="btn-secondary">Office Dashboard</Link>
        <Link href="/admin/reports" className="btn-secondary">Monthly Reports</Link>
      </div>
    </div>
  );
}
