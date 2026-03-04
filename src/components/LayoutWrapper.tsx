"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { TrackRequestModal } from "@/components/TrackRequestModal";

const ICONS = {
  chart: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  document: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  calendar: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  book: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  headset: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 2h3v10H5V5zm12 0a2 2 0 012 2v10a2 2 0 01-2 2h-2a2 2 0 01-2-2V5a2 2 0 012-2h3zm0 2v10h3V5h-3z" />
    </svg>
  ),
  clipboard: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  report: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  users: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  plusCalendar: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
    </svg>
  ),
  search: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  qr: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
    </svg>
  ),
};

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/document-requests": "Document Request & Tracking",
  "/document-requests/new": "New Request",
  "/document-requests/track": "Track Request",
  "/appointments/book": "My Appointments",
  "/admin": "Admin",
  "/admin/users": "User roles",
  "/admin/dashboard": "Office Monitoring Dashboard",
  "/admin/qr": "QR Code / Form Management",
  "/admin/document-requests": "Document Request & Tracking",
  "/admin/appointments": "Appointment Management",
  "/admin/tickets": "Help Desk",
  "/admin/surveys": "Surveys",
  "/admin/logbook": "Logbook",
  "/admin/reports": "Reports",
  "/tickets/new": "Submit Ticket",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/admin/dashboard")) return "Office Monitoring Dashboard";
  if (pathname.startsWith("/admin/qr")) return "QR Code / Form Management";
  if (pathname.startsWith("/admin/document-requests")) return "Document Request & Tracking";
  if (pathname.startsWith("/admin/appointments")) return "Appointment Management";
  if (pathname.startsWith("/admin/users")) return "User roles";
  if (pathname.startsWith("/admin/tickets")) return "Help Desk";
  if (pathname.startsWith("/admin/surveys")) return "Surveys";
  if (pathname.startsWith("/admin/logbook")) return "Logbook";
  if (pathname.startsWith("/admin/reports")) return "Reports";
  if (pathname.startsWith("/appointments")) return "Appointments";
  if (pathname === "/document-requests") return "Document Request & Tracking";
  if (pathname.startsWith("/document-requests")) return "Document Requests";
  return "GCO System";
}

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<{ role?: string; first_name?: string; last_name?: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [trackRequestOpen, setTrackRequestOpen] = useState(false);

  const isAdminEmail = user?.email?.toLowerCase() === "admin@demo.com";
  const isStaff = profile?.role === "admin" || profile?.role === "staff" || isAdminEmail;
  const isPublicPage =
    pathname === "/" ||
    pathname === "/auth/login" ||
    pathname === "/auth/register" ||
    pathname === "/appointments/book" ||
    pathname === "/document-requests/track" ||
    pathname === "/tickets/new";

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u ?? null);
      if (u) {
        supabase.from("profiles").select("role, first_name, last_name").eq("id", u.id).single().then(({ data: profileData }) => {
          const roleFromProfile = profileData?.role;
          if (roleFromProfile === "admin" || roleFromProfile === "staff") {
            setProfile(profileData ?? null);
            return;
          }
          supabase.from("users").select("role").eq("id", u.id).maybeSingle().then(({ data: userRow }) => {
            const roleFromUsers = (userRow as { role?: string } | null)?.role;
            if (roleFromUsers === "admin" || roleFromUsers === "staff") {
              setProfile(profileData ? { ...profileData, role: roleFromUsers } : { role: roleFromUsers });
            } else {
              setProfile(profileData ?? null);
            }
          });
        });
      } else {
        setProfile(null);
      }
    });
  }, [pathname]);

  const displayName = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") : user?.email ?? "";
  const roleLabel = profile?.role === "admin" || isAdminEmail ? "System Administrator (Admin)" : profile?.role === "staff" ? "Staff" : "User";

  if (isPublicPage && !user) {
    return (
      <>
        <main className="flex-1 min-h-screen relative">
          <div className="absolute inset-0 bg-[#1E3A8A]" aria-hidden />
          <div className="absolute inset-0 bg-[url('/img/lspu-banner.jpg')] bg-cover bg-center opacity-20 blur-md" aria-hidden />
          <div className="relative container mx-auto px-4 py-8">{children}</div>
        </main>
      </>
    );
  }

  const staffNav = [
    { href: "/admin/dashboard", label: "Dashboard", icon: ICONS.chart },
    { href: "/admin/qr", label: "QR Forms", icon: ICONS.qr },
    { href: "/admin", label: "Admin", icon: ICONS.clipboard },
    { href: "/admin/document-requests", label: "Document Requests", icon: ICONS.document },
    { href: "/admin/appointments", label: "Appointments", icon: ICONS.calendar },
    { href: "/admin/reports", label: "Reports", icon: ICONS.report },
    { href: "/admin/users", label: "User roles", icon: ICONS.users },
  ];
  const userNav = [
    { href: "/dashboard", label: "Dashboard", icon: ICONS.chart },
    { href: "/document-requests", label: "My Requests", icon: ICONS.document },
    { href: "/appointments/book", label: "My Appointments", icon: ICONS.calendar },
  ];
  const navLinks = isStaff ? staffNav : userNav;

  return (
    <div className="flex min-h-screen">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[260px] max-w-[85vw] bg-gradient-to-b from-[#1e3a8a] to-[#1e293b] text-white transform transition-transform duration-300 ease-out md:translate-x-0 md:rounded-r-2xl md:my-3 md:ml-0 md:left-0 md:max-w-none md:h-[calc(100vh-1.5rem)] md:shadow-xl md:shadow-black/20 pt-[env(safe-area-inset-top)] ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full pt-6 pb-5 pb-[env(safe-area-inset-bottom)]">
          <div className="px-4 mb-5 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-white/20 shrink-0 mb-3 shadow-lg">
              <Image src="/img/lspu-logo.jpg" alt="LSPU" width={64} height={64} className="w-full h-full object-cover" />
            </div>
            <p className="font-bold text-white text-lg tracking-tight">GCO System</p>
            <p className="text-xs text-white/80 mt-0.5">Guidance & Counseling Office</p>
            <p className="text-xs text-white/70">LSPU Sta. Cruz</p>
            <div className="mt-3 w-full">
              <p className="text-[11px] text-amber-300 font-semibold tracking-wide px-3 py-1.5 rounded-full bg-white/10 inline-block">
                Integrity · Professionalism · Innovation
              </p>
            </div>
          </div>
          <nav className="flex-1 px-3 space-y-1 overflow-y-auto overflow-x-hidden">
            {navLinks.map(({ href, label, icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 min-h-[44px] py-3 px-3 rounded-xl text-sm font-medium transition-all duration-200 active:scale-[0.98] ${
                    active
                      ? "bg-amber-400 text-[#1e3a8a] shadow-md shadow-amber-400/25"
                      : "text-white/90 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {icon}
                  <span className="tracking-wide">{label}</span>
                </Link>
              );
            })}
            {isStaff && (
              <Link
                href="/appointments/book"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 min-h-[44px] px-3 py-3 rounded-xl text-sm font-medium text-amber-300 hover:bg-white/10 hover:text-amber-200 transition-all duration-200 mt-2 border border-amber-400/30 active:scale-[0.98]"
              >
                {ICONS.plusCalendar}
                <span className="tracking-wide">+ Book Appointment</span>
              </Link>
            )}
          </nav>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} aria-hidden />
      )}

      <div className="flex flex-col flex-1 md:ml-[260px] min-h-screen">
        <header className="sticky top-0 z-20 bg-gray-100 border-b border-gray-200 px-4 md:px-6 py-3 flex items-center justify-between gap-3 pl-[calc(0.75rem+env(safe-area-inset-left))]">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              className="md:hidden min-h-[44px] min-w-[44px] p-2 rounded-lg text-gray-600 hover:bg-gray-200 active:bg-gray-300 shrink-0 flex items-center justify-center touch-manipulation"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <h1 className="text-lg md:text-xl font-bold text-gray-800 truncate">{getPageTitle(pathname)}</h1>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setTrackRequestOpen(true)}
              className="flex items-center gap-2 bg-[#1E3A8A] text-white text-sm font-semibold py-2 px-4 rounded-lg hover:bg-[#1e3a8a]/90 transition shadow-sm"
            >
              {ICONS.search}
              <span>Track Request</span>
            </button>
            <TrackRequestModal open={trackRequestOpen} onClose={() => setTrackRequestOpen(false)} />
            <span className="text-sm text-gray-600 hidden sm:inline">{displayName ? `${displayName} (${roleLabel})` : roleLabel}</span>
            <button
              type="button"
              onClick={async () => {
                await createClient().auth.signOut();
                window.location.href = "/";
              }}
              className="text-sm text-gray-600 hover:text-red-600 font-medium"
            >
              Logout
            </button>
          </div>
        </header>
        <main className="flex-1 bg-[var(--gco-light)] p-4 md:p-8 pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</main>
      </div>
    </div>
  );
}
