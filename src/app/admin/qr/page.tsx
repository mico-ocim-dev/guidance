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

      <div className="space-y-4">
        {forms.map((form) => (
          <div key={form.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-wrap items-center gap-6">
            <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200 shrink-0 overflow-hidden">
              {form.image_url ? (
                <img src={form.image_url} alt="" className="w-full h-full object-contain" />
              ) : (
                <span className="text-gray-400 text-xs text-center px-2">QR code</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              {editingId === form.id ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="input-field"
                    placeholder="Title"
                  />
                  <input
                    type="url"
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                    className="input-field"
                    placeholder="Form URL"
                  />
                  <div className="flex flex-wrap gap-2 items-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => { setImageFile(e.target.files?.[0] ?? null); setImageUrl(""); }}
                      className="text-sm text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-[#1E3A8A] file:text-white file:text-sm"
                    />
                    <input
                      type="url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="input-field flex-1 min-w-[180px]"
                      placeholder="Or image URL"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleSave} disabled={uploading} className="btn-primary text-sm">{uploading ? "Saving…" : "Save"}</button>
                    <button type="button" onClick={() => { setEditingId(null); setFormTitle(""); setFormUrl(""); setImageUrl(""); setImageFile(null); }} className="btn-secondary text-sm">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <h3 className="font-semibold text-gray-800">{form.title}</h3>
                  <a href={form.form_url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#1E3A8A] hover:underline break-all">
                    {form.form_url}
                  </a>
                </>
              )}
            </div>
            {editingId !== form.id && (
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => { setEditingId(form.id); setFormTitle(form.title); setFormUrl(form.form_url); setImageUrl(form.image_url || ""); setImageFile(null); setShowAdd(false); }}
                  className="border border-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg hover:bg-gray-50 transition"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(form.id)}
                  className="border border-red-200 text-red-600 font-medium py-2 px-4 rounded-lg hover:bg-red-50 transition"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
        {forms.length === 0 && !showAdd && (
          <p className="text-gray-500 text-center py-8">No forms yet. Click &quot;+ Add QR / Form&quot; to add one.</p>
        )}
      </div>
    </div>
  );
}
