"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import type { DocumentRequest } from "@/types/database";
import { exportDocumentRequestsToExcel } from "@/lib/excel";

const STATUSES: DocumentRequest["status"][] = ["pending", "processing", "ready", "released", "cancelled"];

export default function AdminDocumentRequestsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isStaff, setIsStaff] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [editRow, setEditRow] = useState<DocumentRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const [promptMessage, setPromptMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function showPrompt(type: "success" | "error", text: string) {
    setPromptMessage({ type, text });
    setTimeout(() => setPromptMessage(null), 3000);
  }

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/auth/login");
        return;
      }
      setUserId(user.id);
      const isAdminEmail = user.email?.toLowerCase() === "admin@demo.com";
      Promise.resolve(
        supabase
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
            loadRequests();
          })
      ).finally(() => setLoading(false));
    });
  }, [router]);

  function loadRequests() {
    const supabase = createClient();
    supabase
      .from("document_requests")
      .select("*")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .then(({ data }) => setRequests((data as DocumentRequest[]) ?? []));
  }

  async function updateStatus(id: string, newStatus: DocumentRequest["status"]) {
    const supabase = createClient();
    const prev = requests.find((r) => r.id === id);
    const updates: Partial<DocumentRequest> = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === "released") updates.completed_at = new Date().toISOString();
    const { error } = await supabase.from("document_requests").update(updates).eq("id", id);
    if (error) {
      showPrompt("error", "Failed to update status: " + (error.message || "Try again."));
      return;
    }
    setRequests((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));
    showPrompt("success", "Status updated successfully.");
    if (prev && prev.status !== newStatus && userId) {
      supabase.from("request_status_logs").insert({
        document_request_id: id,
        from_status: prev.status,
        to_status: newStatus,
        changed_by: userId,
      }).then(({ error: logErr }) => { if (logErr) console.warn("Status log insert failed:", logErr); });
    }
  }

  async function saveNotes(id: string, notes: string | null) {
    const supabase = createClient();
    const { error } = await supabase.from("document_requests").update({ notes: notes || null, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) {
      showPrompt("error", "Failed to save notes: " + (error.message || "Try again."));
      return;
    }
    setRequests((prev) => prev.map((d) => (d.id === id ? { ...d, notes: notes || null } : d)));
    setEditingNotes((e) => ({ ...e, [id]: "" }));
    showPrompt("success", "Notes updated successfully.");
  }

  async function saveEdit(payload: { requester_name: string; requester_email: string; document_type: string | null }) {
    if (!editRow) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("document_requests")
      .update({
        requester_name: payload.requester_name.trim(),
        requester_email: payload.requester_email.trim(),
        document_type: payload.document_type?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editRow.id);
    setSaving(false);
    if (error) {
      showPrompt("error", "Failed to update: " + (error.message || "Try again."));
      return;
    }
    setRequests((prev) => prev.map((d) => (d.id === editRow.id ? { ...d, ...payload } : d)));
    setEditRow(null);
    showPrompt("success", "Request details updated successfully.");
  }

  async function handleDelete(d: DocumentRequest) {
    if (!confirm(`Delete request ${d.tracking_number} by ${d.requester_name}? This cannot be undone.`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("document_requests").delete().eq("id", d.id);
    if (error) {
      showPrompt("error", "Failed to delete: " + (error.message || "Try again."));
      return;
    }
    setRequests((prev) => prev.filter((r) => r.id !== d.id));
    showPrompt("success", "Request deleted.");
  }

  function handleExport() {
    exportDocumentRequestsToExcel(
      requests.map((d) => ({
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
          <button
            type="button"
            onClick={() => setPromptMessage(null)}
            className="shrink-0 p-1 rounded hover:bg-black/5"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/document-requests/new"
          className="inline-flex items-center gap-2 bg-[#1E3A8A] text-white font-semibold py-2.5 px-5 rounded-lg hover:bg-[#1e3a8a]/90 transition"
        >
          <span className="text-lg leading-none">+</span>
          New Request
        </Link>
        <button type="button" onClick={handleExport} className="inline-flex items-center gap-2 border-2 border-[#1E3A8A] text-[#1E3A8A] font-semibold py-2.5 px-5 rounded-lg hover:bg-[#1E3A8A]/5 transition">
          Export Excel
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                <th className="py-3 px-4 font-semibold text-gray-700">Tracking #</th>
                <th className="py-3 px-4 font-semibold text-gray-700">Requester</th>
                <th className="py-3 px-4 font-semibold text-gray-700">Document Type</th>
                <th className="py-3 px-4 font-semibold text-gray-700">Status</th>
                <th className="py-3 px-4 font-semibold text-gray-700">Requested</th>
                <th className="py-3 px-4 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    No document requests yet.
                  </td>
                </tr>
              ) : (
                requests.map((d) => (
                  <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="py-3 px-4 font-mono text-[#1E3A8A]">{d.tracking_number}</td>
                    <td className="py-3 px-4">{d.requester_name}</td>
                    <td className="py-3 px-4">{d.document_type || "—"}</td>
                    <td className="py-3 px-4">
                      <select
                        value={d.status}
                        onChange={(e) => updateStatus(d.id, e.target.value as DocumentRequest["status"])}
                        className="border border-gray-300 rounded px-2 py-1 text-sm capitalize"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {new Date(d.created_at).toLocaleString("en-PH", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          placeholder="Notes"
                          value={editingNotes[d.id] ?? d.notes ?? ""}
                          onChange={(e) => setEditingNotes((p) => ({ ...p, [d.id]: e.target.value }))}
                          className="border border-gray-300 rounded px-2 py-1 text-sm w-24 min-w-0"
                        />
                        <button
                          type="button"
                          onClick={() => saveNotes(d.id, (editingNotes[d.id] ?? d.notes ?? "").trim() || null)}
                          className="bg-[#1E3A8A] text-white text-sm font-medium py-1.5 px-3 rounded hover:bg-[#1e3a8a]/90"
                        >
                          Update
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditRow(d)}
                          className="border border-gray-300 text-gray-700 text-sm font-medium py-1.5 px-3 rounded hover:bg-gray-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(d)}
                          className="border border-red-200 text-red-600 text-sm font-medium py-1.5 px-3 rounded hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editRow && (
        <EditModal
          request={editRow}
          onSave={saveEdit}
          onClose={() => setEditRow(null)}
          saving={saving}
        />
      )}
    </div>
  );
}

function EditModal({
  request,
  onSave,
  onClose,
  saving,
}: {
  request: DocumentRequest;
  onSave: (p: { requester_name: string; requester_email: string; document_type: string | null }) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(request.requester_name);
  const [email, setEmail] = useState(request.requester_email);
  const [docType, setDocType] = useState(request.document_type ?? "");
  useEffect(() => {
    setName(request.requester_name);
    setEmail(request.requester_email);
    setDocType(request.document_type ?? "");
  }, [request.id]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-800">Edit request {request.tracking_number}</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Requester name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Requester email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Document type</label>
          <input
            type="text"
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="input-field w-full"
            placeholder="e.g. good moral"
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => onSave({ requester_name: name, requester_email: email, document_type: docType || null })}
            disabled={saving || !name.trim() || !email.trim()}
            className="bg-[#1E3A8A] text-white text-sm font-medium py-2 px-4 rounded hover:bg-[#1e3a8a]/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={onClose} className="border border-gray-300 text-gray-700 text-sm font-medium py-2 px-4 rounded hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
