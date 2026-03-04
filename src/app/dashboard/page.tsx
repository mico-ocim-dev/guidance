"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import type { Appointment, DocumentRequest } from "@/types/database";

const FALLBACK_FORMS: { id: string; title: string; form_url: string; image_url?: string | null }[] = [
  { id: "1", title: "Career Interest Inventory", form_url: "#" },
  { id: "2", title: "Session Feedback Form", form_url: "#" },
  { id: "3", title: "Counseling Case Log Sheet", form_url: "#" },
  { id: "4", title: "Holistic Counseling Intake Form", form_url: "#" },
  { id: "5", title: "Log Book", form_url: "#" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<{ first_name?: string; last_name?: string; username?: string; role?: string } | null>(null);
  const [canClaimAdmin, setCanClaimAdmin] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [docRequests, setDocRequests] = useState<DocumentRequest[]>([]);
  const [quickAccessForms, setQuickAccessForms] = useState<{ id: string; title: string; form_url: string; image_url?: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    Promise.resolve(
      supabase.auth.getUser().then(({ data: { user: u } }) => {
        if (!u) {
          router.replace("/auth/login");
          return;
        }
        setUser(u);
        supabase
          .from("profiles")
          .select("first_name, last_name, username, role")
          .eq("id", u.id)
          .single()
          .then(({ data }) => setProfile(data ?? null));
        supabase.rpc("can_claim_admin").then(({ data }) => setCanClaimAdmin(data === true));
        supabase
          .from("appointments")
          .select("*")
          .eq("user_id", u.id)
          .order("created_at", { ascending: false })
          .then(({ data }) => setAppointments((data as Appointment[]) ?? []));
        supabase
          .from("document_requests")
          .select("*")
          .eq("user_id", u.id)
          .order("created_at", { ascending: false })
          .then(({ data }) => setDocRequests((data as DocumentRequest[]) ?? []));
        supabase
          .from("qr_forms")
          .select("id, title, form_url, image_url")
          .order("sort_order", { ascending: true })
          .then(({ data }) => setQuickAccessForms((data ?? []).length > 0 ? (data as { id: string; title: string; form_url: string; image_url?: string | null }[]) : FALLBACK_FORMS));
      })
    ).finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto card text-center">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }
  if (!user) return null;

  const name = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.username
    : user.email;

  const isAdmin = profile?.role === "admin";

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {!isAdmin && (
        <section>
          <h2 className="text-2xl font-bold text-gray-800 mb-1">Quick Access - Forms & Links</h2>
          <p className="text-gray-600 text-sm mb-6">
            Scan the QR codes below to access forms (NSSIB, Excuse Slip, etc.).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {(quickAccessForms.length ? quickAccessForms : FALLBACK_FORMS).map((form) => (
              <div
                key={form.id}
                className="card flex flex-col items-center text-center w-full min-h-[300px] justify-between py-5"
              >
                <div className="w-full flex-shrink-0">
                  <div className="min-h-[3.25rem] flex items-center justify-center px-1">
                    <h3 className="font-semibold text-gray-800 text-sm leading-tight line-clamp-2">{form.title}</h3>
                  </div>
                </div>
                <a
                  href={form.form_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-40 h-40 flex-shrink-0 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200 overflow-hidden cursor-pointer hover:border-[#1E3A8A] hover:ring-2 hover:ring-[#1E3A8A]/20 transition"
                  title="Click to open form"
                >
                  {form.image_url ? (
                    <img src={form.image_url} alt="" className="w-full h-full object-contain pointer-events-none" />
                  ) : (
                    <span className="text-gray-400 text-xs">QR code</span>
                  )}
                </a>
                <div className="w-full flex-shrink-0 flex flex-col items-center gap-0.5">
                  <p className="text-sm font-semibold text-gray-700">Scan me!</p>
                  <p className="text-xs text-gray-500">Scan or click to open form</p>
                  <a
                    href={form.form_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#1E3A8A] font-medium hover:underline mt-1"
                  >
                    Open link →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(canClaimAdmin && profile?.role !== "admin") && (
        <div className="card border-amber-200 bg-amber-50/50">
          <p className="text-gray-700 mb-2">You can claim admin if you are the first user.</p>
          <button
            type="button"
            onClick={async () => {
              const supabase = createClient();
              await supabase.from("profiles").update({ role: "admin" }).eq("id", user!.id);
              router.refresh();
              setProfile((p) => (p ? { ...p, role: "admin" } : null));
              setCanClaimAdmin(false);
            }}
            className="border-2 border-amber-500 text-amber-700 hover:bg-amber-100 font-semibold py-2 px-4 rounded-lg transition"
          >
            Claim admin
          </button>
        </div>
      )}
    </div>
  );
}
