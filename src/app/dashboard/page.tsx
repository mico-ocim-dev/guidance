"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import admissionImage from "../../../admis.png";

const ADMISSION_IMAGE_URL = admissionImage.src;

const DASHBOARD_LINKS = [
  {
    href: "https://lspuinfooffice.my.canva.site/lspuadmission26-27?fbclid=IwY2xjawQtkqZleHRuA2FlbQIxMABicmlkETFrYkFUd1lNMWVocGJnNHBTc3J0YwZhcHBfaWQQMjIyMDM5MTc4ODIwMDg5MgABHlu67eUx7nIiMsPWBdOwcK6bNmzdbRH16UQLrYgBG5S5ta96mXThG87vZpEg_aem_-hAXe-sDwWFdL4VZPqOQ5g",
    label: "Admission",
    subtitle: "Open admission guidelines",
    imageUrl: ADMISSION_IMAGE_URL,
    type: "admission",
  },
  {
    href: "/document-requests",
    label: "My Requests",
    subtitle: "Quick access to your submitted requests",
    imageUrl: "",
    type: "quick",
  },
  {
    href: "/appointments/book",
    label: "Appointment",
    subtitle: "Quick access to booking and schedule",
    imageUrl: "",
    type: "quick",
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    Promise.resolve(
      supabase.auth.getUser().then(({ data: { user: u } }) => {
        if (!u) {
          router.replace("/auth/login");
          return;
        }
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

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-[#1E3A8A] to-[#1e293b] px-6 py-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold tracking-tight">User Dashboard</h1>
        <p className="text-sm text-white/85 mt-1">Quick access to your admission, requests, and appointments.</p>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {DASHBOARD_LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            target={item.href.startsWith("http") ? "_blank" : undefined}
            rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
            className={`group bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md hover:border-[#1E3A8A]/40 transition ${
              item.type === "admission" ? "xl:col-span-1" : ""
            }`}
          >
            {item.type === "admission" ? (
              <>
                <div className="aspect-[16/10] bg-gray-100 border-b border-gray-100 flex items-center justify-center overflow-hidden">
                  <img src={item.imageUrl} alt={item.label} className="w-full h-full object-cover" />
                </div>
                <div className="p-4">
                  <p className="text-xl font-semibold text-gray-800 group-hover:text-[#1E3A8A] leading-tight">{item.label}</p>
                  <p className="text-sm text-[#1E3A8A] mt-1">Open form</p>
                  <p className="text-xs text-gray-500 mt-1">{item.subtitle}</p>
                </div>
              </>
            ) : (
              <div className="p-5 min-h-[180px] flex flex-col justify-between">
                <div className="w-10 h-10 rounded-lg bg-[#1E3A8A]/10 text-[#1E3A8A] flex items-center justify-center font-bold">
                  {item.label === "My Requests" ? "R" : "A"}
                </div>
                <div>
                  <p className="text-xl font-semibold text-gray-800 group-hover:text-[#1E3A8A] leading-tight">{item.label}</p>
                  <p className="text-sm text-[#1E3A8A] mt-1">Quick access</p>
                  <p className="text-xs text-gray-500 mt-1">{item.subtitle}</p>
                </div>
              </div>
            )}
          </Link>
        ))}
      </section>
    </div>
  );
}
