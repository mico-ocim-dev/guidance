"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import type { Appointment } from "@/types/database";

const APPOINTMENT_STATUSES: Appointment["status"][] = ["pending", "confirmed", "cancelled", "completed"];

export default function AdminAppointmentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isStaff, setIsStaff] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/auth/login");
        return;
      }
      const isAdminEmail = user.email?.toLowerCase() === "admin@demo.com";
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
          supabase
            .from("appointments")
            .select("*")
            .order("created_at", { ascending: false })
            .then(({ data }) => setAppointments((data as Appointment[]) ?? []));
        })
        .finally(() => setLoading(false));
    });
  }, [router]);

  async function updateStatus(id: string, status: Appointment["status"]) {
    const supabase = createClient();
    await supabase.from("appointments").update({ status }).eq("id", id);
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
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
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/appointments/book"
          className="inline-flex items-center gap-2 bg-[#1E3A8A] text-white font-semibold py-2.5 px-5 rounded-lg hover:bg-[#1e3a8a]/90 transition"
        >
          <span className="text-lg leading-none">+</span>
          Book Appointment
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                <th className="py-3 px-4 font-semibold text-gray-700">Requester</th>
                <th className="py-3 px-4 font-semibold text-gray-700">Type</th>
                <th className="py-3 px-4 font-semibold text-gray-700">Date</th>
                <th className="py-3 px-4 font-semibold text-gray-700">Time</th>
                <th className="py-3 px-4 font-semibold text-gray-700">Status</th>
                <th className="py-3 px-4 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {appointments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    No appointments yet.
                  </td>
                </tr>
              ) : (
                appointments.map((a) => (
                  <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="py-3 px-4">{a.full_name}</td>
                    <td className="py-3 px-4">{a.appointment_type}</td>
                    <td className="py-3 px-4">{a.preferred_date}</td>
                    <td className="py-3 px-4">{typeof a.preferred_time === "string" ? a.preferred_time.slice(0, 5) : a.preferred_time}</td>
                    <td className="py-3 px-4">
                      <select
                        value={a.status}
                        onChange={(e) => updateStatus(a.id, e.target.value as Appointment["status"])}
                        className="border border-gray-300 rounded px-2 py-1 text-sm capitalize"
                      >
                        {APPOINTMENT_STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4 text-gray-500">—</td>
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
