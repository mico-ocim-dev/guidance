"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/dashboard");
  }, [router]);
  return (
    <div className="max-w-4xl mx-auto card text-center py-12">
      <p className="text-gray-500">Redirecting to dashboard…</p>
    </div>
  );
}
