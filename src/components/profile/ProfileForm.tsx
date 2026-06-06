"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { useApiMutation } from "@/hooks/useApiMutation";
import type { ProfilePatch, ProfilePatchErrorCode } from "@/lib/models/profile";
import { createClient } from "@/lib/supabase/client";

type Props = {
    userId: string;
    initialUsername: string;
    initialAvatarPath: string | null;
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

const ERROR_KEYS: Partial<Record<ProfilePatchErrorCode, string>> = {
    username_taken: "error_username_taken",
    username_empty: "error_username_empty",
};

export function ProfileForm({
    userId,
    initialUsername,
    initialAvatarPath,
}: Props) {
    "use no memo";
    const t = useTranslations("profile");
    const tCommon = useTranslations("common");

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
            setAvatarError(t("error_avatar"));
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
            setAvatarError(t("error_avatar"));
            setAvatarStatus("error");
        }
    }

    async function handleSave(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLocalError(null);

        if (!username.trim()) {
            setLocalError(t("error_username_empty"));
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
        const key = ERROR_KEYS[formMutation.error as ProfilePatchErrorCode];
        // biome-ignore lint/suspicious/noExplicitAny: dynamic i18n key lookup
        return key ? t(key as any) : tCommon("error");
    })();

    const avatarBusy = avatarStatus === "uploading";
    const formSaving = formMutation.status === "pending";
    const formSaved = formMutation.status === "success";

    return (
        <form onSubmit={handleSave} className="space-y-5">
            {/* Avatar upload row */}
            <div className="flex items-center gap-4">
                <div className="relative group shrink-0">
                    <div
                        className="relative w-16 h-16 rounded-full p-[2px]"
                        style={{
                            background:
                                "linear-gradient(135deg, #f5c516, #e04040)",
                        }}
                    >
                        <div className="relative w-full h-full rounded-full overflow-hidden">
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
                                        background:
                                            "linear-gradient(135deg, #f5c516, #c49010)",
                                        color: "#0d0a05",
                                    }}
                                >
                                    {username?.[0]?.toUpperCase() ?? "?"}
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={openFilePicker}
                        disabled={avatarBusy}
                        className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
                    >
                        {avatarBusy ? (
                            <span className="text-[10px] text-white font-semibold text-center px-1 leading-tight">
                                {t("avatar_uploading")}
                            </span>
                        ) : avatarStatus === "saved" ? (
                            <svg
                                viewBox="0 0 24 24"
                                className="w-5 h-5"
                                fill="none"
                                stroke="#48c97a"
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
                    <p
                        className="text-xs font-semibold"
                        style={{ color: "#7a6a50" }}
                    >
                        {t("avatar_upload")}
                    </p>
                    {avatarStatus === "error" && avatarError && (
                        <p
                            className="text-xs font-medium"
                            style={{ color: "#e04040" }}
                        >
                            {avatarError}
                        </p>
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

            {/* Username field */}
            <div>
                <label
                    htmlFor="username"
                    className="block text-xs font-bold mb-2 uppercase tracking-widest"
                    style={{ color: "#7a6a50" }}
                >
                    {t("username_label")}
                </label>
                <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => {
                        setUsername(e.target.value);
                        setLocalError(null);
                    }}
                    placeholder={t("username_placeholder")}
                    maxLength={30}
                    className="w-full rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none transition-all"
                    style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "2px solid #3d2d18",
                        color: "#faf2e2",
                    }}
                    onFocus={(e) => {
                        e.currentTarget.style.borderColor =
                            "rgba(245,197,22,0.5)";
                    }}
                    onBlur={(e) => {
                        e.currentTarget.style.borderColor = "#3d2d18";
                    }}
                />
            </div>

            {formErrorMessage && (
                <p className="text-xs font-bold" style={{ color: "#e04040" }}>
                    {formErrorMessage}
                </p>
            )}

            {/* Save button — 3D game style */}
            <GameButton
                type="submit"
                variant={formSaved ? "green" : "gold"}
                size="md"
                disabled={formSaving || avatarBusy}
                className="w-full py-3.5"
            >
                {formSaving
                    ? tCommon("saving")
                    : formSaved
                      ? `✓ ${tCommon("saved")}`
                      : tCommon("save")}
            </GameButton>
        </form>
    );
}
