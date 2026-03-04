"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import type { Appointment } from "@/types/database";

const APPOINTMENT_TYPES = [
  "Online",
  "Walk-in",
  "Consultation",
  "Counseling",
  "Document Request",
  "Others",
] as const;

const TIME_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
];

export default function BookAppointmentPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    appointment_type: "",
    purpose: "",
    preferred_date: "",
    preferred_time: "08:00",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formMinimized, setFormMinimized] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u ?? null);
      if (u) {
        supabase
          .from("appointments")
          .select("*")
          .eq("user_id", u.id)
          .order("created_at", { ascending: false })
          .then(({ data }) => setAppointments((data as Appointment[]) ?? []))
          .finally(() => setAppointmentsLoading(false));
      } else {
        setAppointmentsLoading(false);
      }
    });
  }, []);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase.from("appointments").insert({
      user_id: user?.id ?? null,
      full_name: form.full_name,
      email: form.email,
      phone: form.phone || null,
      appointment_type: form.appointment_type,
      purpose: form.purpose || null,
      preferred_date: form.preferred_date,
      preferred_time: form.preferred_time,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (user) {
      supabase
        .from("appointments")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .then(({ data }) => setAppointments((data as Appointment[]) ?? []));
    }
    setSuccess(true);
    setForm({
      full_name: "",
      email: "",
      phone: "",
      appointment_type: "",
      purpose: "",
      preferred_date: "",
      preferred_time: "08:00",
    });
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto">
        <div className="card text-center">
          <h2 className="text-xl font-bold text-gco-primary mb-2">Booking Request Submitted</h2>
          <p className="text-gray-600 mb-4">
            Your appointment request has been received. The Guidance Office will confirm via email.
          </p>
          <Link href="/appointments/book" className="btn-primary inline-block" onClick={() => setSuccess(false)}>
            Book Another
          </Link>
          {" "}
          <Link href={user ? "/dashboard" : "/"} className="btn-secondary inline-block">
            {user ? "My Dashboard" : "Back to Home"}
          </Link>
        </div>
      </div>
    );
  }

  const showMyAppointments = user !== null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {showMyAppointments && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="#book-form"
              className="inline-flex items-center gap-2 bg-[#1E3A8A] text-white font-semibold py-2.5 px-5 rounded-lg hover:bg-[#1e3a8a]/90 transition"
            >
              <span className="text-lg leading-none">+</span>
              Book Appointment
            </a>
          </div>
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left">
                    <th className="py-3 px-4 font-semibold text-gray-700">Requester</th>
                    <th className="py-3 px-4 font-semibold text-gray-700">Type</th>
                    <th className="py-3 px-4 font-semibold text-gray-700">Date</th>
                    <th className="py-3 px-4 font-semibold text-gray-700">Time</th>
                    <th className="py-3 px-4 font-semibold text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {appointmentsLoading ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-gray-500">Loading…</td>
                    </tr>
                  ) : appointments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">No appointments yet.</td>
                    </tr>
                  ) : (
                    appointments.map((a) => (
                      <tr key={a.id} className="border-b border-gray-100">
                        <td className="py-3 px-4">{a.full_name}</td>
                        <td className="py-3 px-4">{a.appointment_type}</td>
                        <td className="py-3 px-4">{a.preferred_date}</td>
                        <td className="py-3 px-4">{a.preferred_time}</td>
                        <td className="py-3 px-4 capitalize">{a.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div id="book-form" className="card overflow-hidden">
        <button
          type="button"
          onClick={() => setFormMinimized((m) => !m)}
          className="w-full flex items-center justify-between gap-3 text-left py-2 -mx-4 px-4 hover:bg-gray-50 rounded-lg transition"
          aria-expanded={!formMinimized}
        >
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              {showMyAppointments ? "Book new appointment" : "Book Appointment"}
            </h2>
            {!showMyAppointments && (
              <p className="text-sm text-gray-600 mt-0.5">Online scheduling - no manual booking needed.</p>
            )}
          </div>
          <span className="text-gray-500 shrink-0" aria-hidden>
            {formMinimized ? "▼ Expand" : "▲ Minimize"}
          </span>
        </button>
        {!formMinimized && (
          <>
        {!showMyAppointments && (
          <div className="mb-4 text-center">
            <p className="text-gray-600 text-sm">Fill in the form below to request an appointment.</p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input
              name="full_name"
              value={form.full_name}
              onChange={handleChange}
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Appointment Type *</label>
            <select
              name="appointment_type"
              value={form.appointment_type}
              onChange={handleChange}
              className="input-field"
              required
            >
              <option value="">-- Select --</option>
              {APPOINTMENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Purpose / Reason</label>
            <textarea
              name="purpose"
              value={form.purpose}
              onChange={handleChange}
              className="input-field min-h-[80px]"
              placeholder="Brief reason for appointment"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Date *</label>
            <input
              type="date"
              name="preferred_date"
              value={form.preferred_date}
              onChange={handleChange}
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Time</label>
            <div className="grid grid-cols-4 gap-2">
              {TIME_SLOTS.map((t) => (
                <label key={t} className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="preferred_time"
                    value={t}
                    checked={form.preferred_time === t}
                    onChange={handleChange}
                    className="rounded border-gray-300 text-gco-primary focus:ring-gco-primary"
                  />
                  <span className="text-sm">{t}</span>
                </label>
              ))}
            </div>
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Submitting…" : "Submit Booking Request"}
          </button>
        </form>
        {!showMyAppointments && (
          <p className="mt-4 text-center text-sm text-gray-600">
            <Link href="/auth/login" className="text-gco-primary font-medium hover:underline">Login</Link>
            {" | "}
            <Link href="/auth/register" className="text-gco-primary font-medium hover:underline">Register</Link>
          </p>
        )}
          </>
        )}
      </div>
    </div>
  );
}
