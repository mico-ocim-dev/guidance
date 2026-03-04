"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export default function NewDocumentRequestPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<{ first_name?: string; last_name?: string } | null>(null);
  const [form, setForm] = useState({
    requester_name: "",
    requester_email: "",
    document_type: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ tracking_number: string } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) {
        router.replace("/auth/login");
        return;
      }
      setUser(u);
      setForm((p) => ({
        ...p,
        requester_email: u.email ?? "",
        requester_name: "",
      }));
      supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", u.id)
        .single()
        .then(({ data }) => {
          if (data) {
            const name = [data.first_name, data.last_name].filter(Boolean).join(" ");
            setForm((prev) => ({ ...prev, requester_name: name }));
          }
        });
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("document_requests")
      .insert({
        user_id: user.id,
        requester_name: form.requester_name,
        requester_email: form.requester_email,
        document_type: form.document_type || null,
        notes: form.notes || null,
      })
      .select("tracking_number")
      .single();
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setCreated(data);
  }

  if (!user) return null;

  if (created) {
    return (
      <div className="max-w-md mx-auto">
        <div className="card text-center">
          <h2 className="text-xl font-bold text-gco-primary mb-2">Document Request Submitted</h2>
          <p className="text-gray-600 mb-2">Save your tracking number to check status later:</p>
          <p className="font-mono text-2xl font-bold text-gco-primary my-4">{created.tracking_number}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/dashboard" className="btn-primary">Dashboard</Link>
            <Link href="/document-requests" className="btn-secondary">My Requests</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="card">
        <h2 className="text-xl font-bold text-gco-primary mb-4">Request Document</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your Name *</label>
            <input
              value={form.requester_name}
              onChange={(e) => setForm((p) => ({ ...p, requester_name: e.target.value }))}
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              type="email"
              value={form.requester_email}
              onChange={(e) => setForm((p) => ({ ...p, requester_email: e.target.value }))}
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Document Type</label>
            <input
              value={form.document_type}
              onChange={(e) => setForm((p) => ({ ...p, document_type: e.target.value }))}
              className="input-field"
              placeholder="e.g. Good Moral, Form 137"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              className="input-field min-h-[80px]"
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Submitting…" : "Submit Request"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm">
          <Link href="/dashboard" className="text-gco-primary font-medium hover:underline">Back to Dashboard</Link>
        </p>
      </div>
    </div>
  );
}
