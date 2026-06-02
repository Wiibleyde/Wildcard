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
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex flex-col items-center gap-4">
        <div className="relative group">
          <div className="relative w-24 h-24 rounded-full bg-gray-800 overflow-hidden ring-2 ring-gray-700">
            {avatarDisplayUrl ? (
              <Image
                src={avatarDisplayUrl}
                alt="Avatar"
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-gray-400">
                {username?.[0]?.toUpperCase() ?? "?"}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
          >
            {uploading ? (
              <span className="text-xs text-white">
                {dict.profile.avatar_uploading}
              </span>
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="w-6 h-6 text-white"
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
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarChange}
        />
        <p className="text-xs text-gray-500">{dict.profile.avatar_upload}</p>
      </div>

      <div>
        <label
          htmlFor="username"
          className="block text-sm font-medium text-gray-300 mb-2"
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
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
        />
      </div>

      {status === "error" && errorMsg && (
        <p className="text-red-400 text-sm">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={status === "saving"}
        className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium py-3 rounded-xl text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
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
