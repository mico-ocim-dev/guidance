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
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [editingAppointment, setEditingAppointment] = useState(false);
  const [editForm, setEditForm] = useState<{
    phone: string;
    appointment_type: string;
    purpose: string;
    preferred_date: string;
    preferred_time: string;
  } | null>(null);
  const [requestMode, setRequestMode] = useState<"cancel" | "reschedule" | null>(null);
  const [requestReason, setRequestReason] = useState("");
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalSuccess, setModalSuccess] = useState("");
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
  const [createdTrackingNumber, setCreatedTrackingNumber] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [formMinimized, setFormMinimized] = useState(false);

  const todayDateStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u ?? null);
      if (u) {
        Promise.resolve(
          supabase
            .from("appointments")
            .select("*")
            .eq("user_id", u.id)
            .order("created_at", { ascending: false })
            .then(({ data }) => setAppointments((data as Appointment[]) ?? []))
        ).finally(() => setAppointmentsLoading(false));
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

  function handleEditChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    if (!editForm) return;
    setEditForm((p) => (p ? { ...p, [e.target.name]: e.target.value } : p));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.preferred_date < todayDateStr) {
      setError("You cannot schedule an appointment for a date before today.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: inserted, error: err } = await supabase
      .from("appointments")
      .insert({
        user_id: user?.id ?? null,
        full_name: form.full_name,
        email: form.email,
        phone: form.phone || null,
        appointment_type: form.appointment_type,
        purpose: form.purpose || null,
        preferred_date: form.preferred_date,
        preferred_time: form.preferred_time,
      })
      .select("tracking_number")
      .single();
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setCreatedTrackingNumber((inserted as { tracking_number: string })?.tracking_number ?? null);
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

  async function handleSaveAppointmentEdit() {
    if (!selectedAppointment || !editForm) return;
    setModalError("");
    setModalSuccess("");
    if (editForm.preferred_date < todayDateStr) {
      setModalError("You cannot schedule an appointment for a date before today.");
      return;
    }
    setModalSaving(true);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("appointments")
      .update({
        phone: editForm.phone || null,
        appointment_type: editForm.appointment_type,
        purpose: editForm.purpose || null,
        preferred_date: editForm.preferred_date,
        preferred_time: editForm.preferred_time,
      })
      .eq("id", selectedAppointment.id);
    setModalSaving(false);
    if (err) {
      setModalError(err.message || "Failed to update appointment. Please try again.");
      return;
    }
    setAppointments((prev) =>
      prev.map((a) =>
        a.id === selectedAppointment.id
          ? {
              ...a,
              phone: editForm.phone || null,
              appointment_type: editForm.appointment_type as Appointment["appointment_type"],
              purpose: editForm.purpose || null,
              preferred_date: editForm.preferred_date,
              preferred_time: editForm.preferred_time,
            }
          : a
      )
    );
    setSelectedAppointment((a) =>
      a
        ? {
            ...a,
            phone: editForm.phone || null,
            appointment_type: editForm.appointment_type as Appointment["appointment_type"],
            purpose: editForm.purpose || null,
            preferred_date: editForm.preferred_date,
            preferred_time: editForm.preferred_time,
          }
        : a
    );
    setEditingAppointment(false);
    setModalSuccess("Appointment changes have been saved.");
  }

  async function handleSubmitRequest() {
    if (!selectedAppointment || !requestMode || !requestReason.trim()) return;
    setModalError("");
    setModalSaving(true);
    const supabase = createClient();
    const subject =
      requestMode === "cancel"
        ? "Appointment cancellation request"
        : "Appointment schedule change request";
    const description = [
      `Tracking: ${selectedAppointment.tracking_number}`,
      `Name: ${selectedAppointment.full_name}`,
      `Type: ${selectedAppointment.appointment_type}`,
      `Current date/time: ${selectedAppointment.preferred_date} ${selectedAppointment.preferred_time}`,
      "",
      "Reason:",
      requestReason.trim(),
    ].join("\n");
    const { error: err } = await supabase.from("tickets").insert({
      subject,
      description,
      requester_email: selectedAppointment.email,
      requester_name: selectedAppointment.full_name,
    });
    setModalSaving(false);
    if (err) {
      setModalError(err.message || "Failed to send request. Please try again.");
      return;
    }
    setRequestReason("");
    setRequestMode(null);
    setModalSuccess("Your request has been sent. The admin will review it under Help Desk in the admin panel.");
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto">
        <div className="card text-center">
          <h2 className="text-xl font-bold text-[#1E3A8A] mb-2">Booking Request Submitted</h2>
          <p className="text-gray-600 mb-4">
            Your appointment request has been received. The Guidance Office will confirm via email.
          </p>
          {createdTrackingNumber && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Save your tracking number to check status later:</p>
              <p className="font-mono text-xl font-bold text-[#1E3A8A]">{createdTrackingNumber}</p>
            </div>
          )}
          <Link href="/appointments/book" className="btn-primary inline-block" onClick={() => { setSuccess(false); setCreatedTrackingNumber(null); }}>
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
                    <th className="py-3 px-4 font-semibold text-gray-700">Tracking #</th>
                    <th className="py-3 px-4 font-semibold text-gray-700">Requester</th>
                    <th className="py-3 px-4 font-semibold text-gray-700">Type</th>
                    <th className="py-3 px-4 font-semibold text-gray-700">Date</th>
                    <th className="py-3 px-4 font-semibold text-gray-700">Time</th>
                    <th className="py-3 px-4 font-semibold text-gray-700">Status</th>
                    <th className="py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {appointmentsLoading ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-gray-500">Loading…</td>
                    </tr>
                  ) : appointments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-500">No appointments yet.</td>
                    </tr>
                  ) : (
                    appointments.map((a) => (
                      <tr key={a.id} className="border-b border-gray-100">
                        <td className="py-3 px-4 font-mono text-[#1E3A8A]">{a.tracking_number}</td>
                        <td className="py-3 px-4">{a.full_name}</td>
                        <td className="py-3 px-4">{a.appointment_type}</td>
                        <td className="py-3 px-4">{a.preferred_date}</td>
                        <td className="py-3 px-4">{a.preferred_time}</td>
                        <td className="py-3 px-4 capitalize">{a.status}</td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAppointment(a);
                              setEditingAppointment(false);
                              setEditForm(null);
                              setRequestMode(null);
                              setRequestReason("");
                              setModalError("");
                            }}
                            className="text-sm font-medium text-[#1E3A8A] hover:underline"
                          >
                            View
                          </button>
                        </td>
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
              min={todayDateStr}
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

      {selectedAppointment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            setSelectedAppointment(null);
            setEditingAppointment(false);
            setEditForm(null);
            setRequestMode(null);
            setRequestReason("");
            setModalError("");
          }}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-gray-800">
                Appointment {selectedAppointment.tracking_number}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setSelectedAppointment(null);
                  setEditingAppointment(false);
                  setEditForm(null);
                  setRequestMode(null);
                  setRequestReason("");
                  setModalError("");
                }}
                className="p-1 rounded-lg text-gray-500 hover:bg-gray-100"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {modalError && (
              <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{modalError}</div>
            )}
            {modalSuccess && !modalError && (
              <div className="bg-green-50 text-green-700 text-sm px-3 py-2 rounded-lg">{modalSuccess}</div>
            )}

            {!editingAppointment && (
              <div className="space-y-2 text-sm text-gray-700">
                <p><span className="font-medium">Status:</span> <span className="capitalize">{selectedAppointment.status}</span></p>
                <p><span className="font-medium">Type:</span> {selectedAppointment.appointment_type}</p>
                <p><span className="font-medium">Date:</span> {selectedAppointment.preferred_date}</p>
                <p><span className="font-medium">Time:</span> {selectedAppointment.preferred_time}</p>
                {selectedAppointment.purpose && (
                  <p><span className="font-medium">Purpose:</span> {selectedAppointment.purpose}</p>
                )}
              </div>
            )}

            {editingAppointment && editForm && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    value={editForm.phone}
                    onChange={handleEditChange}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Appointment Type *</label>
                  <select
                    name="appointment_type"
                    value={editForm.appointment_type}
                    onChange={handleEditChange}
                    className="input-field w-full"
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
                    value={editForm.purpose}
                    onChange={handleEditChange}
                    className="input-field min-h-[80px] w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Date *</label>
                  <input
                    type="date"
                    name="preferred_date"
                    value={editForm.preferred_date}
                    onChange={handleEditChange}
                    min={todayDateStr}
                    className="input-field w-full"
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
                          checked={editForm.preferred_time === t}
                          onChange={handleEditChange}
                          className="rounded border-gray-300 text-gco-primary focus:ring-gco-primary"
                        />
                        <span className="text-xs">{t}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4 pt-2">
              {selectedAppointment.status === "pending" && (
                <div className="flex gap-2">
                  {!editingAppointment ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAppointment(true);
                        setEditForm({
                          phone: selectedAppointment.phone ?? "",
                          appointment_type: selectedAppointment.appointment_type,
                          purpose: selectedAppointment.purpose ?? "",
                          preferred_date: selectedAppointment.preferred_date,
                          preferred_time: selectedAppointment.preferred_time,
                        });
                      }}
                      className="btn-primary flex-1"
                    >
                      Edit appointment
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleSaveAppointmentEdit}
                        disabled={modalSaving}
                        className="btn-primary flex-1"
                      >
                        {modalSaving ? "Saving…" : "Save changes"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAppointment(false);
                          setEditForm(null);
                        }}
                        className="btn-secondary"
                      >
                        Cancel edit
                      </button>
                    </>
                  )}
                </div>
              )}

              {selectedAppointment.status === "confirmed" && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-600">
                    This appointment is already being processed. You can send a request to cancel or change the schedule.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRequestMode("cancel");
                      }}
                      className={`flex-1 border text-sm font-medium rounded-lg px-3 py-2 ${
                        requestMode === "cancel"
                          ? "bg-red-600 text-white border-red-600"
                          : "border-red-300 text-red-600 hover:bg-red-50"
                      }`}
                    >
                      Request cancellation
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRequestMode("reschedule");
                      }}
                      className={`flex-1 border text-sm font-medium rounded-lg px-3 py-2 ${
                        requestMode === "reschedule"
                          ? "bg-[#1E3A8A] text-white border-[#1E3A8A]"
                          : "border-gray-300 text-[#1E3A8A] hover:bg-gray-50"
                      }`}
                    >
                      Request schedule change
                    </button>
                  </div>
                  {requestMode && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Reason for {requestMode === "cancel" ? "cancellation" : "schedule change"}
                      </label>
                      <textarea
                        value={requestReason}
                        onChange={(e) => setRequestReason(e.target.value)}
                        className="input-field min-h-[80px] w-full"
                        placeholder="Brief explanation for your request"
                      />
                      <button
                        type="button"
                        onClick={handleSubmitRequest}
                        disabled={modalSaving || !requestReason.trim()}
                        className="btn-primary w-full"
                      >
                        {modalSaving ? "Sending…" : "Send request to admin"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
