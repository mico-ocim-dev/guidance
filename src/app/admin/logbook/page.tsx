"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import type { LogbookEntry } from "@/types/database";

export default function AdminLogbookPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [entries, setEntries] = useState<LogbookEntry[]>([]);
  const [form, setForm] = useState({ visitor_name: "", visitor_email: "", visitor_phone: "", purpose: "" });

  useEffect(() => {
    const supabase = createClient();
    Promise.resolve(
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) {
          router.replace("/auth/login");
          return;
        }
        setUserId(user.id);
        const isAdminEmail = user.email?.toLowerCase() === "admin@demo.com";
        return supabase.from("profiles").select("role").eq("id", user.id).single().then(({ data }) => {
          if (data?.role !== "admin" && data?.role !== "staff" && !isAdminEmail) {
            router.replace("/dashboard");
            return;
          }
          setIsAdmin(true);
          loadEntries(supabase);
        });
      })
    ).finally(() => setLoading(false));
  }, [router]);

  function loadEntries(supabase: ReturnType<typeof createClient>) {
    supabase.from("logbook_entries").select("*").order("check_in_at", { ascending: false }).limit(100).then(({ data }) => setEntries((data as LogbookEntry[]) ?? []));
  }

  async function handleCheckIn(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    await supabase.from("logbook_entries").insert({
      visitor_name: form.visitor_name,
      visitor_email: form.visitor_email || null,
      visitor_phone: form.visitor_phone || null,
      purpose: form.purpose || null,
      checked_in_by: userId,
    });
    setForm({ visitor_name: "", visitor_email: "", visitor_phone: "", purpose: "" });
    loadEntries(supabase);
  }

  async function handleCheckOut(id: string) {
    const supabase = createClient();
    await supabase.from("logbook_entries").update({ check_out_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
    loadEntries(supabase);
  }

  const activeVisitors = entries.filter((e) => !e.check_out_at);

  if (loading || !isAdmin) {
    return (
      <div className="max-w-4xl mx-auto card text-center">
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gco-primary">Digital Logbook</h1>
        <Link href="/admin" className="btn-secondary">Back to Admin</Link>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Check-in visitor</h2>
        <form onSubmit={handleCheckIn} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input value={form.visitor_name} onChange={(e) => setForm((p) => ({ ...p, visitor_name: e.target.value }))} className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={form.visitor_email} onChange={(e) => setForm((p) => ({ ...p, visitor_email: e.target.value }))} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input value={form.visitor_phone} onChange={(e) => setForm((p) => ({ ...p, visitor_phone: e.target.value }))} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
            <input value={form.purpose} onChange={(e) => setForm((p) => ({ ...p, purpose: e.target.value }))} className="input-field" />
          </div>
          <div className="md:col-span-2">
            <button type="submit" className="btn-primary">Check in</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Active visitors ({activeVisitors.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="py-2 pr-2">Name</th>
                <th className="py-2 pr-2">Check-in</th>
                <th className="py-2 pr-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {activeVisitors.length === 0 ? (
                <tr><td colSpan={3} className="py-4 text-gray-500">No active visitors.</td></tr>
              ) : (
                activeVisitors.map((e) => (
                  <tr key={e.id} className="border-b border-gray-100">
                    <td className="py-2 pr-2">{e.visitor_name}</td>
                    <td className="py-2 pr-2">{new Date(e.check_in_at).toLocaleString()}</td>
                    <td className="py-2 pr-2">
                      <button type="button" onClick={() => handleCheckOut(e.id)} className="text-amber-600 hover:underline">Check out</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent entries</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="py-2 pr-2">Name</th>
                <th className="py-2 pr-2">Check-in</th>
                <th className="py-2 pr-2">Check-out</th>
              </tr>
            </thead>
            <tbody>
              {entries.slice(0, 20).map((e) => (
                <tr key={e.id} className="border-b border-gray-100">
                  <td className="py-2 pr-2">{e.visitor_name}</td>
                  <td className="py-2 pr-2">{new Date(e.check_in_at).toLocaleString()}</td>
                  <td className="py-2 pr-2">{e.check_out_at ? new Date(e.check_out_at).toLocaleString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
