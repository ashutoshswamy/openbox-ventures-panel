"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { LoaderCircle, Paperclip, X } from "lucide-react";
import { attachUrl, type Bucket } from "@/app/(employee)/actions";

const MAX = 10 * 1024 * 1024; // keep in step with the buckets' file_size_limit (supabase/schema.sql)

// File picker as an icon button. Uploads straight to storage on pick, then submits the stored path as `name`.
export function AttachInput({ name, bucket = "attachments" }: { name: string; bucket?: Bucket }) {
  const [file, setFile] = useState<{ name: string; path?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const uploading = !!file && !file.path;

  useEffect(() => {
    const form = ref.current?.form;
    const clear = () => setFile(null);
    form?.addEventListener("reset", clear);
    return () => form?.removeEventListener("reset", clear);
  }, []);

  async function pick(f: File) {
    setError(null);
    if (f.size > MAX) return setError("Max 10 MB");
    setFile({ name: f.name });
    try {
      const { path, token } = await attachUrl(bucket, f.name);
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
      const { error } = await sb.storage.from(bucket).uploadToSignedUrl(path, token, f, { contentType: f.type });
      if (error) throw error;
      setFile({ name: f.name, path });
    } catch (e) {
      setFile(null);
      setError((e as Error).message || "Upload failed");
    }
  }

  return (
    <>
      <label className="btn btn-ghost btn-icon relative w-auto min-w-9 cursor-pointer px-2 text-muted" title={file ? "Remove attachment" : "Attach a file (max 10 MB)"}>
        {uploading ? <LoaderCircle className="animate-spin" /> : <Paperclip />}
        {file && <span className="max-w-28 truncate text-xs">{uploading ? "Uploading" : file.name}</span>}
        {file?.path && <X className="size-3" />}
        <input
          ref={ref}
          type="file"
          className="sr-only"
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) pick(f);
          }}
          onClick={(e) => {
            if (file) {
              e.preventDefault();
              setFile(null);
            }
          }}
        />
      </label>
      <input type="hidden" name={name} value={file?.path ?? ""} />
      {/* ponytail: native validation blocks submit mid-upload, no form wiring needed */}
      {uploading && <input tabIndex={-1} aria-hidden className="sr-only" ref={(el) => el?.setCustomValidity("Wait for the upload to finish")} />}
      {error && <span role="alert" className="text-xs text-red">{error}</span>}
    </>
  );
}
