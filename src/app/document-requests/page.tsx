"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import type { DocumentRequest } from "@/types/database";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  ready: "Ready for Pickup",
  released: "Released",
  cancelled: "Cancelled",
};

export default function MyDocumentRequestsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function fetchRequests(supabase: ReturnType<typeof createClient>, userId: string, isInitial = false) {
    supabase
      .from("document_requests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data }) => setRequests((data as DocumentRequest[]) ?? []))
      .finally(() => { if (isInitial) setLoading(false); });
  }

  function handleRefresh() {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setLoading(true);
        fetchRequests(supabase, user.id, true);
      }
    });
  }

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!mounted) return;
      if (!user) {
        router.replace("/auth/login");
        return;
      }
      fetchRequests(supabase, user.id, true);
      intervalRef.current = setInterval(() => {
        if (mounted) fetchRequests(supabase, user.id, false);
      }, 5000);
    });
    return () => {
      mounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [router]);

  useEffect(() => {
    const handler = () => {
      if (document.visibilityState !== "visible") return;
      const supabase = createClient();
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) fetchRequests(supabase, user.id, false);
      });
    };
    if (typeof document !== "undefined" && document.addEventListener) {
      document.addEventListener("visibilitychange", handler);
      return () => document.removeEventListener("visibilitychange", handler);
    }
  }, []);

  if (loading) {
    return (
      <div className="card text-center">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/document-requests/new"
          className="inline-flex items-center gap-2 bg-[#1E3A8A] text-white font-semibold py-2.5 px-5 rounded-lg hover:bg-[#1e3a8a]/90 transition"
        >
          <span className="text-lg leading-none">+</span>
          New Request
        </Link>
        <button
          type="button"
          onClick={handleRefresh}
          className="inline-flex items-center gap-2 border-2 border-[#1E3A8A] text-[#1E3A8A] font-semibold py-2.5 px-5 rounded-lg hover:bg-[#1E3A8A]/5 transition"
        >
          Refresh status
        </button>
      </div>

      <div className="card overflow-hidden p-0">
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
                requests.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="py-3 px-4 font-mono text-[#1E3A8A]">{r.tracking_number}</td>
                    <td className="py-3 px-4">{r.requester_name}</td>
                    <td className="py-3 px-4">{r.document_type || "—"}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                          r.status === "released"
                            ? "bg-green-100 text-green-800"
                            : r.status === "cancelled"
                              ? "bg-gray-100 text-gray-600"
                              : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {new Date(r.created_at).toLocaleString("en-PH", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3 px-4">—</td>
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
