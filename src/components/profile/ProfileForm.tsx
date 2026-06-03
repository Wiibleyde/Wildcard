"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useApiMutation } from "@/hooks/useApiMutation";
import type { Dictionary } from "@/lib/i18n";
import type { ProfilePatch, ProfilePatchErrorCode } from "@/lib/models/profile";
import { createClient } from "@/lib/supabase/client";

type Props = {
  userId: string;
  initialUsername: string;
  initialAvatarPath: string | null;
  dict: Dictionary;
};

type AvatarStatus = "idle" | "uploading" | "saved" | "error";

function buildAvatarUrl(
  supabase: ReturnType<typeof createClient>,
  path: string | null,
  bust?: number,
): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return bust ? `${data.publicUrl}?t=${bust}` : data.publicUrl;
}

const ERROR_MESSAGES: Partial<
  Record<ProfilePatchErrorCode, keyof Dictionary["profile"]>
> = {
  username_taken: "error_username_taken",
  username_empty: "error_username_empty",
};

export function ProfileForm({
  userId,
  initialUsername,
  initialAvatarPath,
  dict,
}: Props) {
  const [username, setUsername] = useState(initialUsername);
  const [avatarPath, setAvatarPath] = useState(initialAvatarPath);
  const [avatarBust, setAvatarBust] = useState<number | undefined>(undefined);
  const [avatarStatus, setAvatarStatus] = useState<AvatarStatus>("idle");
  const [avatarError, setAvatarError] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const formMutation = useApiMutation<ProfilePatch>("/api/profile", {
    successDuration: 2500,
  });
  const avatarMutation = useApiMutation<ProfilePatch>("/api/profile", {
    successDuration: 2000,
  });

  const avatarDisplayUrl = buildAvatarUrl(supabase, avatarPath, avatarBust);

  function openFilePicker() {
    if (fileRef.current) {
      fileRef.current.value = "";
      fileRef.current.click();
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarStatus("uploading");
    setAvatarError("");

    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setAvatarError(dict.profile.error_avatar);
      setAvatarStatus("error");
      return;
    }

    const ok = await avatarMutation.mutate({ avatar_url: path });
    if (ok) {
      setAvatarPath(path);
      setAvatarBust(Date.now());
      setAvatarStatus("saved");
      setTimeout(() => setAvatarStatus("idle"), 2000);
    } else {
      setAvatarError(dict.profile.error_avatar);
      setAvatarStatus("error");
    }
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError(null);

    if (!username.trim()) {
      setLocalError(dict.profile.error_username_empty);
      return;
    }

    await formMutation.mutate({
      username: username.trim(),
      avatar_url: avatarPath,
    });
  }

  const formErrorMessage: string | null = (() => {
    if (localError) return localError;
    if (!formMutation.error) return null;
    const key = ERROR_MESSAGES[formMutation.error as ProfilePatchErrorCode];
    return key ? (dict.profile[key] as string) : dict.common.error;
  })();

  const avatarBusy = avatarStatus === "uploading";
  const formSaving = formMutation.status === "pending";
  const formSaved = formMutation.status === "success";

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
            onClick={openFilePicker}
            disabled={avatarBusy}
            className="absolute inset-0 rounded-full bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
          >
            {avatarBusy ? (
              <span className="text-[10px] text-white font-semibold text-center px-1 leading-tight">
                {dict.profile.avatar_uploading}
              </span>
            ) : avatarStatus === "saved" ? (
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5 text-green-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
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

        <div className="flex flex-col gap-1">
          <p className="text-xs text-wc-sub">{dict.profile.avatar_upload}</p>
          {avatarStatus === "error" && avatarError && (
            <p className="text-red-400 text-xs font-medium">{avatarError}</p>
          )}
        </div>
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
          className="block text-xs font-semibold text-wc-muted mb-2 uppercase tracking-wider"
        >
          {dict.profile.username_label}
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setLocalError(null);
          }}
          placeholder={dict.profile.username_placeholder}
          maxLength={30}
          className="w-full bg-white/5 border border-wc-border rounded-(--radius-wc-btn) px-4 py-3 text-wc-text placeholder:text-wc-sub focus:outline-none focus:ring-2 focus:ring-wc-indigo/60 focus:border-transparent text-sm transition-colors"
        />
      </div>

      {formErrorMessage && (
        <p className="text-red-400 text-xs font-medium">{formErrorMessage}</p>
      )}

      <button
        type="submit"
        disabled={formSaving || avatarBusy}
        className="w-full font-bold py-3 rounded-(--radius-wc-btn) text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        style={{
          background: formSaved ? "rgba(52,211,153,0.2)" : "#6366f1",
          color: formSaved ? "#34d399" : "#fff",
          border: formSaved ? "1px solid rgba(52,211,153,0.4)" : "none",
        }}
      >
        {formSaving
          ? dict.common.saving
          : formSaved
            ? dict.common.saved
            : dict.common.save}
      </button>
    </form>
  );
}
