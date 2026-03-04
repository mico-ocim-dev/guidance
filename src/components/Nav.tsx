"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

const links = [
  { href: "/auth/login", label: "Login" },
  { href: "/auth/register", label: "Register" },
  { href: "/appointments/book", label: "Book Appointment" },
  { href: "/document-requests/track", label: "Track Request" },
  { href: "/tickets/new", label: "Submit Ticket" },
];

export function Nav() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()
        .then(({ data }) => setIsAdmin(data?.role === "admin"));
    });
  }, []);

  return (
    <nav className="flex flex-wrap items-center gap-2">
      {links.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={`px-3 py-1.5 rounded text-sm font-medium transition ${
            pathname === href
              ? "bg-white/20 text-white"
              : "text-white/90 hover:bg-white/10 hover:text-white"
          }`}
        >
          {label}
        </Link>
      ))}
      <Link
        href="/dashboard"
        className="px-3 py-1.5 rounded text-sm font-medium text-white/90 hover:bg-white/10 hover:text-white"
      >
        Dashboard
      </Link>
      {isAdmin && (
        <Link
          href="/admin"
          className={`px-3 py-1.5 rounded text-sm font-medium transition ${
            pathname === "/admin"
              ? "bg-white/20 text-white"
              : "text-white/90 hover:bg-white/10 hover:text-white"
          }`}
        >
          Admin
        </Link>
      )}
    </nav>
  );
}
