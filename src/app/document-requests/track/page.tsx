"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

const DOC_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  ready: "Ready for Pickup",
  released: "Released",
  cancelled: "Cancelled",
};

const TICKET_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  assigned: "Assigned",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

type DocResult = {
  type: "document";
  tracking_number: string;
  requester_name: string;
  status: string;
  created_at: string;
  document_type?: string | null;
};

type TicketResult = {
  type: "ticket";
  ticket_number: string | null;
  id: string;
  subject: string;
  status: string;
  requester_email: string;
  requester_name: string | null;
  created_at: string;
};

type AppointmentResult = {
  type: "appointment";
  id: string;
  full_name: string;
  email: string;
  preferred_date: string;
  preferred_time: string;
  status: string;
  appointment_type: string;
  created_at: string;
};

type TrackResult = DocResult | TicketResult | AppointmentResult;

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
}

export default function TrackRequestPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TrackResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResults([]);
    setSearched(false);
    const q = query.trim();
    if (!q) {
      setError("Enter a tracking or reference number.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const upper = q.toUpperCase();
    const isId = isUuid(q);

    try {
      const [docRes, ticketByNumRes, ticketByIdRes, appointmentRes] = await Promise.all([
        supabase
          .from("document_requests")
          .select("tracking_number, requester_name, status, created_at, document_type")
          .ilike("tracking_number", upper)
          .maybeSingle(),
        q.length >= 2 && !isId
          ? supabase
              .from("tickets")
              .select("id, ticket_number, subject, status, requester_email, requester_name, created_at")
              .ilike("ticket_number", `%${q}%`)
              .limit(1)
          : { data: [] as unknown[], error: null },
        isId
          ? supabase
              .from("tickets")
              .select("id, ticket_number, subject, status, requester_email, requester_name, created_at")
              .eq("id", q)
              .maybeSingle()
          : { data: null, error: null },
        isId
          ? supabase
              .from("appointments")
              .select("id, full_name, email, preferred_date, preferred_time, status, appointment_type, created_at")
              .eq("id", q)
              .maybeSingle()
          : { data: null, error: null },
      ]);

      const found: TrackResult[] = [];

      if (docRes.data) {
        found.push({ type: "document", ...docRes.data } as DocResult);
      }
      const ticketData = Array.isArray(ticketByNumRes.data) && ticketByNumRes.data[0]
        ? ticketByNumRes.data[0]
        : ticketByIdRes.data;
      if (ticketData) {
        found.push({ type: "ticket", ...ticketData } as TicketResult);
      }
      if (appointmentRes.data) {
        found.push({ type: "appointment", ...appointmentRes.data } as AppointmentResult);
      }

      setResults(found);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="card mb-6 text-center">
        <h2 className="text-2xl font-bold text-[#1E3A8A]">Track Request</h2>
        <p className="text-gray-600 mt-1">
          Enter a tracking number (e.g. GCO-123456), ticket number, or reference ID to check status of document requests, tickets, or appointments.
        </p>
      </div>
      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tracking or reference number</label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input-field w-full"
              placeholder="e.g. GCO-123456 or ticket/appointment ID"
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Searching…" : "Track"}
          </button>
        </form>

        {searched && (
          <div className="mt-6 pt-6 border-t border-gray-200 space-y-4">
            {results.length === 0 ? (
              <p className="text-gray-600 text-center py-2">No request found for this reference.</p>
            ) : (
              results.map((r, idx) => (
                <div
                  key={r.type + (r.type === "document" ? r.tracking_number : r.id) + idx}
                  className="bg-gray-50 rounded-lg p-4 space-y-2"
                >
                  {r.type === "document" && (
                    <>
                      <p className="text-xs font-semibold text-[#1E3A8A] uppercase tracking-wide">Document Request</p>
                      <p><span className="text-gray-500">Tracking:</span> {r.tracking_number}</p>
                      <p><span className="text-gray-500">Requester:</span> {r.requester_name}</p>
                      <p>
                        <span className="text-gray-500">Status:</span>{" "}
                        <span className="font-medium">{DOC_STATUS_LABELS[r.status] ?? r.status}</span>
                      </p>
                      {r.document_type && <p><span className="text-gray-500">Document:</span> {r.document_type}</p>}
                      <p className="text-sm text-gray-500">Submitted: {new Date(r.created_at).toLocaleDateString()}</p>
                    </>
                  )}
                  {r.type === "ticket" && (
                    <>
                      <p className="text-xs font-semibold text-[#1E3A8A] uppercase tracking-wide">Help Desk Ticket</p>
                      {r.ticket_number && <p><span className="text-gray-500">Ticket #:</span> {r.ticket_number}</p>}
                      <p><span className="text-gray-500">Subject:</span> {r.subject}</p>
                      <p><span className="text-gray-500">Requester:</span> {r.requester_name || r.requester_email}</p>
                      <p>
                        <span className="text-gray-500">Status:</span>{" "}
                        <span className="font-medium">{TICKET_STATUS_LABELS[r.status] ?? r.status}</span>
                      </p>
                      <p className="text-sm text-gray-500">Submitted: {new Date(r.created_at).toLocaleDateString()}</p>
                    </>
                  )}
                  {r.type === "appointment" && (
                    <>
                      <p className="text-xs font-semibold text-[#1E3A8A] uppercase tracking-wide">Appointment</p>
                      <p><span className="text-gray-500">Name:</span> {r.full_name}</p>
                      <p><span className="text-gray-500">Type:</span> {r.appointment_type}</p>
                      <p><span className="text-gray-500">Date:</span> {r.preferred_date}</p>
                      <p><span className="text-gray-500">Time:</span> {r.preferred_time}</p>
                      <p><span className="text-gray-500">Status:</span> <span className="font-medium capitalize">{r.status}</span></p>
                      <p className="text-sm text-gray-500">Requested: {new Date(r.created_at).toLocaleDateString()}</p>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        <p className="mt-4 text-center text-sm text-gray-600">
          <Link href="/auth/login" className="text-[#1E3A8A] font-medium hover:underline">Staff Login</Link>
        </p>
      </div>
    </div>
  );
}
