"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export default function NewTicketPage() {
  const router = useRouter();
  const [form, setForm] = useState({ subject: "", description: "", requester_email: "", requester_name: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase.from("tickets").insert({
      subject: form.subject,
      description: form.description || null,
      requester_email: form.requester_email,
      requester_name: form.requester_name || null,
      created_by: user?.id ?? null,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSuccess(true);
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto card text-center">
        <h2 className="text-xl font-bold text-gco-primary mb-2">Ticket submitted</h2>
        <p className="text-gray-600 mb-4">We will get back to you at {form.requester_email}.</p>
        <Link href="/" className="btn-primary inline-block">Back to home</Link>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="card">
        <h2 className="text-xl font-bold text-gco-primary mb-4">Submit a ticket</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
            <input value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="input-field min-h-[100px]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your email *</label>
            <input type="email" value={form.requester_email} onChange={(e) => setForm((p) => ({ ...p, requester_email: e.target.value }))} className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
            <input value={form.requester_name} onChange={(e) => setForm((p) => ({ ...p, requester_name: e.target.value }))} className="input-field" />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? "Submitting…" : "Submit"}</button>
        </form>
        <p className="mt-4 text-center text-sm">
          <Link href="/auth/login" className="text-gco-primary font-medium hover:underline">Staff login</Link>
        </p>
      </div>
    </div>
  );
}
