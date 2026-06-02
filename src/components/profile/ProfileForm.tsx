"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { Dictionary } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

type Props = {
  userId: string;
  initialUsername: string;
  initialAvatarPath: string | null;
  dict: Dictionary;
};

function getAvatarDisplayUrl(
  supabase: ReturnType<typeof createClient>,
  path: string | null,
  bust?: number,
): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return bust ? `${data.publicUrl}?t=${bust}` : data.publicUrl;
}

export function ProfileForm({
  userId,
  initialUsername,
  initialAvatarPath,
  dict,
}: Props) {
  const [username, setUsername] = useState(initialUsername);
  const [avatarPath, setAvatarPath] = useState(initialAvatarPath);
  const [avatarBust, setAvatarBust] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const avatarDisplayUrl = getAvatarDisplayUrl(
    supabase,
    avatarPath,
    avatarBust,
  );

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setErrorMsg(dict.profile.error_avatar);
      setStatus("error");
      setUploading(false);
      return;
    }

    setAvatarPath(path);
    setAvatarBust(Date.now());
    setUploading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) {
      setErrorMsg(dict.profile.error_username_empty);
      setStatus("error");
      return;
    }

    setStatus("saving");
    setErrorMsg("");

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username.trim(),
        avatar_url: avatarPath,
      }),
    });

    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      if (data.error === "username_taken") {
        setErrorMsg(dict.profile.error_username_taken);
      } else {
        setErrorMsg(dict.common.error);
      }
      setStatus("error");
      return;
    }

    setStatus("saved");
    setTimeout(() => setStatus("idle"), 2500);
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="relative group shrink-0">
          <div className="relative w-16 h-16 rounded-full overflow-hidden">
            {avatarDisplayUrl ? (
              <Image
                src={avatarDisplayUrl}
                alt="Avatar"
                fill
                sizes="64px"
                className="object-cover"
                loading="eager"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-xl font-black"
                style={{
                  background: "linear-gradient(135deg, #e8c468, #c49b32)",
                  color: "#15110a",
                }}
              >
                {username?.[0]?.toUpperCase() ?? "?"}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute inset-0 rounded-full bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
          >
            {uploading ? (
              <span className="text-[10px] text-white font-semibold text-center px-1 leading-tight">
                {dict.profile.avatar_uploading}
              </span>
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
            )}
          </button>
        </div>
        <p className="text-xs text-wc-sub">{dict.profile.avatar_upload}</p>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarChange}
      />

      <div>
        <label
          htmlFor="username"
          className="block text-xs font-semibold text-wc-muted mb-2 uppercase tracking-[0.05em]"
        >
          {dict.profile.username_label}
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={dict.profile.username_placeholder}
          maxLength={30}
          className="w-full bg-white/[0.05] border border-wc-border rounded-[var(--radius-wc-btn)] px-4 py-3 text-wc-text placeholder:text-wc-sub focus:outline-none focus:ring-2 focus:ring-wc-indigo/60 focus:border-transparent text-sm transition-colors"
        />
      </div>

      {status === "error" && errorMsg && (
        <p className="text-red-400 text-xs font-medium">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={status === "saving"}
        className="w-full font-bold py-3 rounded-[var(--radius-wc-btn)] text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        style={{
          background: status === "saved" ? "rgba(52,211,153,0.2)" : "#6366f1",
          color: status === "saved" ? "#34d399" : "#fff",
          border:
            status === "saved" ? "1px solid rgba(52,211,153,0.4)" : "none",
        }}
      >
        {status === "saving"
          ? dict.common.saving
          : status === "saved"
            ? dict.common.saved
            : dict.common.save}
      </button>
    </form>
  );
}
