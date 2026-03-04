"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

type Role = "user" | "staff" | "admin";

interface ProfileRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  role: Role;
}

const ROLES: Role[] = ["user", "staff", "admin"];

export default function AdminUsersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/auth/login");
        return;
      }
      const isAdminEmail = user.email?.toLowerCase() === "admin@demo.com";
      supabase.from("profiles").select("role").eq("id", user.id).single().then(({ data }) => {
        if (data?.role !== "admin" && !isAdminEmail) {
          router.replace("/dashboard");
          return;
        }
        setIsAdmin(true);
        supabase
          .from("profiles")
          .select("id, email, first_name, last_name, username, role")
          .order("email")
          .then(({ data }) => setProfiles((data as ProfileRow[]) ?? []));
      });
    }).finally(() => setLoading(false));
  }, [router]);

  async function updateRole(id: string, role: Role) {
    const supabase = createClient();
    await supabase.from("profiles").update({ role }).eq("id", id);
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, role } : p)));
  }

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
        <h1 className="text-2xl font-bold text-[#1E3A8A]">User roles</h1>
        <Link href="/admin" className="btn-secondary">Back to Admin</Link>
      </div>

      <div className="card">
        <p className="text-sm text-gray-600 mb-4">
          <strong>user</strong> — regular user (dashboard, my requests). <strong>staff</strong> — can manage logbook, tickets, surveys. <strong>admin</strong> — full access including this page.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="py-2 pr-2">Name</th>
                <th className="py-2 pr-2">Email</th>
                <th className="py-2 pr-2">Username</th>
                <th className="py-2 pr-2">Role</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="border-b border-gray-100">
                  <td className="py-2 pr-2">{[p.first_name, p.last_name].filter(Boolean).join(" ") || "—"}</td>
                  <td className="py-2 pr-2">{p.email}</td>
                  <td className="py-2 pr-2">{p.username}</td>
                  <td className="py-2 pr-2">
                    <select
                      value={p.role}
                      onChange={(e) => updateRole(p.id, e.target.value as Role)}
                      className="border border-gray-300 rounded px-2 py-1 text-sm"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
