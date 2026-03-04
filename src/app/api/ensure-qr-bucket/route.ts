import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

const BUCKET = "qr-images";

export async function POST() {
  try {
    const supabase = createServerClient();
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === BUCKET);
    if (exists) {
      return NextResponse.json({ ok: true, message: "Bucket already exists" });
    }
    const { data, error } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024, // 5MB
      allowedMimeTypes: ["image/png", "image/jpeg", "image/gif", "image/webp"],
    });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, message: "Bucket created" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
