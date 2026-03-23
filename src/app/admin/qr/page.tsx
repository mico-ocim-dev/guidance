"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

type QrForm = { id: string; title: string; form_url: string; image_url: string | null; sort_order: number };

export default function AdminQrFormsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isStaff, setIsStaff] = useState(false);
  const [forms, setForms] = useState<QrForm[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/auth/login");
        return;
      }
      const isAdminEmail = user.email?.toLowerCase() === "admin@demo.com";
      Promise.resolve(
        supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single()
          .then(({ data }) => {
            if (data?.role !== "admin" && data?.role !== "staff" && !isAdminEmail) {
              router.replace("/dashboard");
              return;
            }
            setIsStaff(true);
            loadForms();
          })
      ).finally(() => setLoading(false));
    });
  }, [router]);

  function loadForms() {
    const supabase = createClient();
    supabase
      .from("qr_forms")
      .select("id, title, form_url, image_url, sort_order")
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error("Load qr_forms failed:", error);
          return;
        }
        setForms((data as QrForm[]) ?? []);
      });
  }

  function getPublicUrl(path: string) {
    const supabase = createClient();
    const { data } = supabase.storage.from("qr-images").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSave() {
    const supabase = createClient();
    setUploading(true);
    let finalImageUrl: string | null = imageUrl.trim() || null;

    if (editingId && !finalImageUrl && !imageFile) {
      finalImageUrl = forms.find((f) => f.id === editingId)?.image_url ?? null;
    }
    if (imageFile) {
      const ext = imageFile.name.split(".").pop() || "png";
      const path = `qr/${crypto.randomUUID()}.${ext}`;
      let result = await supabase.storage.from("qr-images").upload(path, imageFile, { upsert: false });
      if (result.error) {
        const res = await fetch("/api/ensure-qr-bucket", { method: "POST" });
        const body = await res.json().catch(() => ({}));
        if (body.ok) {
          result = await supabase.storage.from("qr-images").upload(path, imageFile, { upsert: false });
        }
      }
      if (result && !result.error) {
        finalImageUrl = getPublicUrl(path);
      } else {
        // Fallback: store image as data URL so it still shows on dashboard without Storage
        const maxSize = 2 * 1024 * 1024; // 2MB
        if (imageFile.size <= maxSize) {
          finalImageUrl = await new Promise<string | null>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(imageFile);
          });
        }
        if (!finalImageUrl) {
          setUploading(false);
          alert(
            "Image upload failed and image is too large to save inline (max 2MB). Create a public bucket named \"qr-images\" in Supabase Dashboard → Storage, or paste an image URL in \"Or image URL\" instead."
          );
          return;
        }
      }
    }

    const payload = { title: formTitle, form_url: formUrl, image_url: finalImageUrl, updated_at: new Date().toISOString() };
    if (editingId) {
      const { error } = await supabase.from("qr_forms").update(payload).eq("id", editingId);
      if (error) {
        setUploading(false);
        alert("Failed to save: " + (error.message || "Unknown error. Run make_admin.sql in Supabase for your email so you can edit."));
        return;
      }
      setEditingId(null);
    } else {
      const maxOrder = forms.length ? Math.max(...forms.map((f) => f.sort_order), 0) : 0;
      const { error } = await supabase.from("qr_forms").insert({ ...payload, sort_order: maxOrder + 1 });
      if (error) {
        setUploading(false);
        alert("Failed to save: " + (error.message || "Unknown error. Run make_admin.sql in Supabase for your email so you can add forms."));
        return;
      }
      setShowAdd(false);
    }
    setFormTitle("");
    setFormUrl("");
    setImageUrl("");
    setImageFile(null);
    setUploading(false);
    loadForms();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this form?")) return;
    const supabase = createClient();
    await supabase.from("qr_forms").delete().eq("id", id);
    loadForms();
  }

  if (loading || !isStaff) {
    return (
      <div className="max-w-4xl mx-auto card text-center py-12">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => { setShowAdd(true); setEditingId(null); setFormTitle(""); setFormUrl(""); setImageUrl(""); setImageFile(null); }}
          className="inline-flex items-center gap-2 bg-[#1E3A8A] text-white font-semibold py-2.5 px-5 rounded-lg hover:bg-[#1e3a8a]/90 transition"
        >
          <span className="text-lg leading-none">+</span>
          Add QR / Form
        </button>
      </div>

      <p className="text-sm text-gray-600">
        Upload QR code images (NSSIB, Excuse Slip, etc.) to show on the user dashboard. You can change or add anytime.
      </p>

      {showAdd && (
        <div className="card flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="input-field"
              placeholder="e.g. Career Interest Inventory"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Form URL</label>
            <input
              type="url"
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
              className="input-field"
              placeholder="https://docs.google.com/forms/..."
            />
          </div>
          <div className="w-full flex flex-wrap gap-4 items-end">
            <div className="min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">QR image (optional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => { setImageFile(e.target.files?.[0] ?? null); setImageUrl(""); }}
                className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-[#1E3A8A] file:text-white file:font-medium hover:file:bg-[#1e3a8a]/90"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Or image URL</label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                onFocus={() => setImageFile(null)}
                className="input-field"
                placeholder="https://... or leave blank"
              />
            </div>
          </div>
          <button type="button" onClick={handleSave} disabled={!formTitle.trim() || !formUrl.trim() || uploading} className="btn-primary">
            {uploading ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={() => { setShowAdd(false); setFormTitle(""); setFormUrl(""); setImageUrl(""); setImageFile(null); }} className="btn-secondary">
            Cancel
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {forms.map((form) => (
          <div
            key={form.id}
            className="group relative bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="aspect-square bg-gray-50 flex items-center justify-center p-4 border-b border-gray-100">
              {form.image_url ? (
                <img src={form.image_url} alt="" className="max-w-full max-h-full object-contain" />
              ) : (
                <span className="text-gray-400 text-sm">QR code</span>
              )}
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-gray-800 truncate" title={form.title}>{form.title}</h3>
              <a
                href={form.form_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#1E3A8A] hover:underline truncate block mt-0.5"
                title={form.form_url}
              >
                Open form
              </a>
            </div>
            <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => { setEditingId(form.id); setFormTitle(form.title); setFormUrl(form.form_url); setImageUrl(form.image_url || ""); setImageFile(null); setShowAdd(false); }}
                className="p-2 rounded-lg bg-white/95 shadow border border-gray-200 text-gray-600 hover:bg-[#1E3A8A] hover:text-white transition-colors"
                aria-label="Edit"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              </button>
              <button
                type="button"
                onClick={() => handleDelete(form.id)}
                className="p-2 rounded-lg bg-white/95 shadow border border-gray-200 text-gray-600 hover:bg-red-500 hover:text-white transition-colors"
                aria-label="Delete"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          </div>
        ))}
        {forms.length === 0 && !showAdd && (
          <p className="col-span-full text-gray-500 text-center py-12">No forms yet. Click &quot;+ Add QR / Form&quot; to add one.</p>
        )}
      </div>

      {/* Edit modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => { setEditingId(null); setFormTitle(""); setFormUrl(""); setImageUrl(""); setImageFile(null); }}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-800">Edit QR / Form</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} className="input-field w-full" placeholder="e.g. Career Interest Inventory" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Form URL</label>
              <input type="url" value={formUrl} onChange={(e) => setFormUrl(e.target.value)} className="input-field w-full" placeholder="https://docs.google.com/forms/..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">QR image (optional)</label>
              <input type="file" accept="image/*" onChange={(e) => { setImageFile(e.target.files?.[0] ?? null); setImageUrl(""); }} className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-[#1E3A8A] file:text-white file:font-medium hover:file:bg-[#1e3a8a]/90" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Or image URL</label>
              <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} onFocus={() => setImageFile(null)} className="input-field w-full" placeholder="https://... or leave blank" />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={handleSave} disabled={!formTitle.trim() || !formUrl.trim() || uploading} className="btn-primary flex-1">{uploading ? "Saving…" : "Save"}</button>
              <button type="button" onClick={() => { setEditingId(null); setFormTitle(""); setFormUrl(""); setImageUrl(""); setImageFile(null); }} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
