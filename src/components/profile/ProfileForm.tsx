"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { CheckIcon, UploadIcon } from "@/components/profile/AvatarIcons";
import { GameButton } from "@/components/ui/GameButton";
import { useAvatarUpload } from "@/hooks/profile/useAvatarUpload";
import { useApiMutation } from "@/hooks/useApiMutation";
import type { ProfilePatch, ProfilePatchErrorCode } from "@/lib/models/profile";

type Props = {
    userId: string;
    initialUsername: string;
    initialAvatarPath: string | null;
};

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
    const [localError, setLocalError] = useState<string | null>(null);
    const avatar = useAvatarUpload(userId, initialAvatarPath);

    const formMutation = useApiMutation<ProfilePatch>("/api/profile", {
        successDuration: 2500,
    });

    async function handleSave(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLocalError(null);

        if (!username.trim()) {
            setLocalError(t("error_username_empty"));
            return;
        }

        await formMutation.mutate({
            username: username.trim(),
            avatar_url: avatar.avatarPath,
        });
    }

    const formErrorMessage: string | null = (() => {
        if (localError) return localError;
        if (!formMutation.error) return null;
        const key = ERROR_KEYS[formMutation.error as ProfilePatchErrorCode];
        // biome-ignore lint/suspicious/noExplicitAny: dynamic i18n key lookup
        return key ? t(key as any) : tCommon("error");
    })();

    const formSaving = formMutation.status === "pending";
    const formSaved = formMutation.status === "success";

    return (
        <form onSubmit={handleSave} className="space-y-5">
            <div className="flex items-center gap-4">
                <div className="relative group shrink-0">
                    <div
                        className="relative w-16 h-16 rounded-full overflow-hidden"
                        style={{ border: "2.5px solid var(--ink)" }}
                    >
                        {avatar.displayUrl ? (
                            <Image
                                src={avatar.displayUrl}
                                alt="Avatar"
                                fill
                                sizes="64px"
                                className="object-cover"
                                loading="eager"
                                unoptimized
                            />
                        ) : (
                            <div
                                className="w-full h-full flex items-center justify-center font-display text-xl"
                                style={{
                                    background: "var(--gold)",
                                    color: "var(--ink)",
                                }}
                            >
                                {username?.[0]?.toUpperCase() ?? "?"}
                            </div>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={avatar.openFilePicker}
                        disabled={avatar.busy}
                        className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
                    >
                        {avatar.busy ? (
                            <span className="text-wc-label text-white font-semibold text-center px-1 leading-tight">
                                {t("avatar_uploading")}
                            </span>
                        ) : avatar.status === "saved" ? (
                            <CheckIcon />
                        ) : (
                            <UploadIcon />
                        )}
                    </button>
                </div>

                <div className="flex flex-col gap-1">
                    <p
                        className="text-xs font-semibold"
                        style={{ color: "var(--muted)" }}
                    >
                        {t("avatar_upload")}
                    </p>
                    {avatar.status === "error" && avatar.error && (
                        <p
                            className="text-xs font-medium"
                            style={{ color: "var(--red)" }}
                        >
                            {avatar.error}
                        </p>
                    )}
                </div>
            </div>

            <input
                ref={avatar.fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={avatar.handleChange}
            />

            <div>
                <label
                    htmlFor="username"
                    className="block text-xs font-bold mb-2 uppercase tracking-widest"
                    style={{ color: "var(--muted)" }}
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
                        background: "var(--cream)",
                        border: "2.5px solid var(--ink)",
                        color: "var(--ink)",
                    }}
                />
            </div>

            {formErrorMessage && (
                <p
                    className="text-xs font-bold"
                    style={{ color: "var(--red)" }}
                >
                    {formErrorMessage}
                </p>
            )}

            <GameButton
                type="submit"
                variant={formSaved ? "green" : "gold"}
                size="md"
                disabled={formSaving || avatar.busy}
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
