"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    first_name: "",
    mi: "",
    last_name: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!/^[\w.-]+@gmail\.com$/i.test(form.email)) {
      setError("Only valid Gmail is accepted. We will send a verification link to this email.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          first_name: form.first_name,
          mi: form.mi || null,
          last_name: form.last_name,
          username: form.username,
        },
        emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined,
      },
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push("/auth/login?registered=1");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-xl font-semibold text-gray-800">Create Account</h3>
      <p className="text-sm text-gray-600">Request documents from GCO - LSPU Sta. Cruz</p>
      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg">{error}</div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
          <input
            name="first_name"
            value={form.first_name}
            onChange={handleChange}
            className="input-field"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">M.I.</label>
          <input
            name="mi"
            value={form.mi}
            onChange={handleChange}
            className="input-field"
            placeholder="Middle initial"
            maxLength={2}
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
        <input
          name="last_name"
          value={form.last_name}
          onChange={handleChange}
          className="input-field"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
        <input
          name="username"
          value={form.username}
          onChange={handleChange}
          className="input-field"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Gmail *</label>
        <input
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          className="input-field"
          placeholder="you@gmail.com"
          required
        />
        <p className="text-xs text-gray-500 mt-1">
          Only valid Gmail. We will send a verification link to this email—you must click it before you can log in.
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
        <input
          type="password"
          name="password"
          value={form.password}
          onChange={handleChange}
          className="input-field"
          required
          minLength={8}
        />
        <p className="text-xs text-gray-500 mt-1">Valid password: at least 8 characters (not less than 8).</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
        <input
          type="password"
          name="confirmPassword"
          value={form.confirmPassword}
          onChange={handleChange}
          className="input-field"
          required
        />
      </div>
      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? "Creating account…" : "Register"}
      </button>
      <p className="text-center text-sm text-gray-600">
        Already have an account?{" "}
        <Link href="/auth/login" className="text-gco-primary font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
