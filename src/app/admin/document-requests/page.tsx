"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import type { DocumentRequest } from "@/types/database";
import { exportDocumentRequestsToExcel } from "@/lib/excel";

const STATUSES: DocumentRequest["status"][] = ["pending", "processing", "ready", "released", "cancelled"];

const STATUS_LABELS: Record<DocumentRequest["status"], string> = {
  pending: "Pending",
  processing: "Processing",
  ready: "Ready for Pickup",
  released: "Released",
  cancelled: "Cancelled",
};

/** Sequential flow (excluding cancelled). Used to determine "previous" vs "next" steps. */
const FLOW_ORDER: DocumentRequest["status"][] = ["pending", "processing", "ready", "released"];

function getFlowIndex(status: DocumentRequest["status"]): number {
  const i = FLOW_ORDER.indexOf(status);
  return i >= 0 ? i : -1;
}

/** True if this option is a step already passed (should be greyed out; reverting requires confirmation). */
function isPastStatus(current: DocumentRequest["status"], optionStatus: DocumentRequest["status"]): boolean {
  if (current === "cancelled") return optionStatus !== "cancelled"; // going back from cancelled = revert
  if (optionStatus === "cancelled") return false; // cancelling is not "past"
  return getFlowIndex(optionStatus) < getFlowIndex(current);
}

/** True if changing from current to newStatus would be a revert to an earlier step. */
function isRevert(current: DocumentRequest["status"], newStatus: DocumentRequest["status"]): boolean {
  if (current === newStatus) return false;
  if (current === "cancelled") return true; // any non-cancelled is "revert" from cancelled
  if (newStatus === "cancelled") return false; // cancelling is allowed without revert confirm
  return getFlowIndex(newStatus) < getFlowIndex(current);
}

/** True if newStatus jumps forward more than one step in the flow (skipping steps). */
function isSkipForward(current: DocumentRequest["status"], newStatus: DocumentRequest["status"]): boolean {
  if (current === newStatus) return false;
  if (newStatus === "cancelled") return false; // cancelling is always allowed
  if (current === "cancelled") return newStatus !== "pending"; // from cancelled, must restart at pending
  const ci = getFlowIndex(current);
  const ni = getFlowIndex(newStatus);
  if (ci < 0 || ni < 0) return false;
  return ni > ci + 1;
}

/**
 * Determine whether an option should be disabled in the dropdown.
 * - Previous steps: allowed (but visually greyed, not disabled)
 * - Next step: allowed
 * - Skipping forward > 1: disabled
 * - Cancelled: always allowed
 * - From cancelled: only allow pending (restart) or keep cancelled
 */
function isDisabledOption(current: DocumentRequest["status"], optionStatus: DocumentRequest["status"]): boolean {
  if (optionStatus === current) return false;
  if (optionStatus === "cancelled") return false;
  if (current === "cancelled") return optionStatus !== "pending";
  if (isPastStatus(current, optionStatus)) return false;
  const ci = getFlowIndex(current);
  const oi = getFlowIndex(optionStatus);
  if (ci < 0 || oi < 0) return false;
  return oi > ci + 1;
}

export default function AdminDocumentRequestsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isStaff, setIsStaff] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [editRow, setEditRow] = useState<DocumentRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const [promptMessage, setPromptMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [batchStatus, setBatchStatus] = useState<DocumentRequest["status"]>("processing");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | DocumentRequest["status"]>("all");

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
      .then(({ data }) => {
        const next = (data as DocumentRequest[]) ?? [];
        setRequests(next);
        // Drop selections that no longer exist in the current list
        setSelectedIds((prev) => {
          if (prev.size === 0) return prev;
          const allowed = new Set(next.map((r) => r.id));
          const out = new Set<string>();
          prev.forEach((id) => { if (allowed.has(id)) out.add(id); });
          return out;
        });
      });
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

  async function batchUpdateStatus(newStatus: DocumentRequest["status"]) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const targets = requests.filter((r) => selectedIds.has(r.id));
    const invalidSkip = targets.filter((r) => isSkipForward(r.status, newStatus));
    if (invalidSkip.length > 0) {
      showPrompt(
        "error",
        `Batch update blocked: ${invalidSkip.length} selected request(s) would skip steps. Move them one step at a time.`
      );
      return;
    }

    const hasRevert = targets.some((r) => isRevert(r.status, newStatus));
    if (hasRevert) {
      const ok = confirm(
        `Some selected requests will be reverted to an earlier step (${STATUS_LABELS[newStatus]}). Continue?`
      );
      if (!ok) return;
    }

    setSaving(true);
    const supabase = createClient();
    const nowIso = new Date().toISOString();

    const results = await Promise.all(
      targets.map(async (r) => {
        const updates: Partial<DocumentRequest> = { status: newStatus, updated_at: nowIso };
        if (newStatus === "released") updates.completed_at = nowIso;
        const { error } = await supabase.from("document_requests").update(updates).eq("id", r.id);
        return { id: r.id, prevStatus: r.status, updates, error };
      })
    );

    const failures = results.filter((x) => x.error);
    const successes = results.filter((x) => !x.error);

    if (successes.length > 0) {
      setRequests((prev) =>
        prev.map((r) => {
          const hit = successes.find((s) => s.id === r.id);
          return hit ? { ...r, ...(hit.updates as Partial<DocumentRequest>) } : r;
        })
      );

      if (userId) {
        Promise.all(
          successes
            .filter((s) => s.prevStatus !== newStatus)
            .map((s) =>
              supabase.from("request_status_logs").insert({
                document_request_id: s.id,
                from_status: s.prevStatus,
                to_status: newStatus,
                changed_by: userId,
              })
            )
        ).then(() => void 0);
      }
    }

    setSaving(false);

    if (failures.length > 0) {
      showPrompt("error", `Updated ${successes.length}/${targets.length}. ${failures.length} failed — please try again.`);
    } else {
      showPrompt("success", `Updated ${targets.length} request(s) to ${STATUS_LABELS[newStatus]}.`);
      // Optional: keep selection, but most UIs clear it after action
      setSelectedIds(new Set());
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

  async function batchDeleteSelected() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const ok = confirm(`Delete ${ids.length} selected request(s)? This cannot be undone.`);
    if (!ok) return;

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("document_requests").delete().in("id", ids);
    setSaving(false);

    if (error) {
      showPrompt("error", "Failed to delete selected requests: " + (error.message || "Try again."));
      return;
    }

    setRequests((prev) => prev.filter((r) => !selectedIds.has(r.id)));
    setSelectedIds(new Set());
    showPrompt("success", `Deleted ${ids.length} request(s).`);
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

  const q = searchQuery.trim().toLowerCase();
  const visibleRequests = requests.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (!q) return true;
    const hay = [
      r.tracking_number,
      r.requester_name,
      r.requester_email,
      r.document_type ?? "",
      STATUS_LABELS[r.status],
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });

  const allVisibleSelected =
    visibleRequests.length > 0 && visibleRequests.every((r) => selectedIds.has(r.id));

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

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[14rem]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tracking #, requester, email, document type…"
            className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | DocumentRequest["status"])}
            className="border border-gray-300 rounded px-2 py-2 text-sm min-w-[12rem]"
          >
            <option value="all">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        {(searchQuery.trim() || statusFilter !== "all") && (
          <button
            type="button"
            onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}
            className="text-sm font-medium text-gray-600 hover:text-gray-800"
          >
            Clear filters
          </button>
        )}
        <div className="text-xs text-gray-500 ml-auto">
          Showing <span className="font-semibold">{visibleRequests.length}</span> of{" "}
          <span className="font-semibold">{requests.length}</span>
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
              onChange={(e) => setBatchStatus(e.target.value as DocumentRequest["status"])}
              className="border border-gray-300 rounded px-2 py-1 text-sm min-w-[12rem]"
              disabled={saving}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
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
                        if (checked) {
                          visibleRequests.forEach((r) => next.add(r.id));
                        } else {
                          visibleRequests.forEach((r) => next.delete(r.id));
                        }
                        return next;
                      });
                    }}
                  />
                </th>
                <th className="py-3 px-4 font-semibold text-gray-700">Tracking #</th>
                <th className="py-3 px-4 font-semibold text-gray-700">Requester</th>
                <th className="py-3 px-4 font-semibold text-gray-700">Document Type</th>
                <th className="py-3 px-4 font-semibold text-gray-700">Status</th>
                <th className="py-3 px-4 font-semibold text-gray-700">Requested</th>
                <th className="py-3 px-4 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    No matching requests.
                  </td>
                </tr>
              ) : (
                visibleRequests.map((d) => (
                  <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="py-3 px-3">
                      <input
                        type="checkbox"
                        aria-label={`Select request ${d.tracking_number}`}
                        checked={selectedIds.has(d.id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (checked) next.add(d.id);
                            else next.delete(d.id);
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td className="py-3 px-4 font-mono text-[#1E3A8A]">{d.tracking_number}</td>
                    <td className="py-3 px-4">{d.requester_name}</td>
                    <td className="py-3 px-4">{d.document_type || "—"}</td>
                    <td className="py-3 px-4">
                      <select
                        value={d.status}
                        onChange={(e) => {
                          const newStatus = e.target.value as DocumentRequest["status"];
                          if (isSkipForward(d.status, newStatus)) {
                            showPrompt("error", "You can’t skip steps. Please move to the next status in order.");
                            return;
                          }
                          if (isRevert(d.status, newStatus)) {
                            const ok = confirm(
                              `Revert status from "${STATUS_LABELS[d.status]}" to "${STATUS_LABELS[newStatus]}"? This moves the request back to an earlier step.`
                            );
                            if (!ok) return;
                          }
                          updateStatus(d.id, newStatus);
                        }}
                        className="border border-gray-300 rounded px-2 py-1 text-sm min-w-[10rem]"
                      >
                        {STATUSES.map((s) => (
                          <option
                            key={s}
                            value={s}
                            disabled={isDisabledOption(d.status, s)}
                            className={isPastStatus(d.status, s) ? "text-gray-400 bg-gray-50" : ""}
                          >
                            {STATUS_LABELS[s]}
                            {isPastStatus(d.status, s) ? " (previous step)" : ""}
                          </option>
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
