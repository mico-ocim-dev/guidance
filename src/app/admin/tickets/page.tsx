"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import type { Ticket } from "@/types/database";

const STATUSES = ["open", "assigned", "in_progress", "resolved", "closed"] as const;
const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export default function AdminTicketsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [users, setUsers] = useState<Array<{ id: string; full_name: string | null }>>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/auth/login");
        return;
      }
      const isAdminEmail = user.email?.toLowerCase() === "admin@demo.com";
      supabase.from("profiles").select("role").eq("id", user.id).single().then(({ data }) => {
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
    }).finally(() => setLoading(false));
  }, [router]);

  async function updateTicket(id: string, updates: Partial<Ticket>) {
    const supabase = createClient();
    if (updates.status === "resolved" || updates.status === "closed") {
      (updates as Partial<Ticket>).resolved_at = new Date().toISOString();
    }
    await supabase.from("tickets").update(updates).eq("id", id);
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  }

  if (loading || !isAdmin) {
    return (
      <div className="max-w-4xl mx-auto card text-center">
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gco-primary">Help Desk / Tickets</h1>
        <Link href="/admin" className="btn-secondary">Back to Admin</Link>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">All tickets</h2>
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
              </tr>
            </thead>
            <tbody>
              {tickets.length === 0 ? (
                <tr><td colSpan={7} className="py-4 text-gray-500">No tickets.</td></tr>
              ) : (
                tickets.map((t) => (
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
