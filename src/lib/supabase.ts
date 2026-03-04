import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

/** Single Supabase client for the browser to avoid "Multiple GoTrueClient instances" and 500s. */
export function createClient(): SupabaseClient {
  if (typeof window !== "undefined" && browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  const client = createSupabaseClient(url, key);
  if (typeof window !== "undefined") browserClient = client;
  return client;
}
