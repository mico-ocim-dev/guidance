"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

function AuthCallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      setStatus("error");
      return;
    }
    const supabase = createClient();
    supabase.auth
      .exchangeCodeForSession(code)
      .then(async ({ data: { user }, error }) => {
        if (error) {
          setStatus("error");
          return;
        }
        setStatus("ok");
        if (!user) {
          window.location.href = "/dashboard";
          return;
        }
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        const role = (profile as { role?: string } | null)?.role;
        const isAdmin = role === "admin" || user.email?.toLowerCase() === "admin@demo.com";
        window.location.href = isAdmin ? "/admin/dashboard" : "/dashboard";
      })
      .catch(() => setStatus("error"));
  }, [searchParams]);

  if (status === "loading") {
    return (
      <div className="max-w-md mx-auto card text-center">
        <p>Verifying your email…</p>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="max-w-md mx-auto card text-center">
        <p className="text-red-600 mb-4">Verification failed or link expired.</p>
        <Link href="/auth/login" className="btn-primary inline-block">Back to Login</Link>
      </div>
    );
  }
  return (
    <div className="max-w-md mx-auto card text-center">
      <p>Success! Redirecting to dashboard…</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="max-w-md mx-auto card text-center"><p>Verifying your email…</p></div>}>
      <AuthCallbackContent />
    </Suspense>
  );
}
