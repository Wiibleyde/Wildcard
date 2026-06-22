"use client";

import { useTranslations } from "next-intl";
import { type ChangeEvent, useRef, useState } from "react";
import { useApiMutation } from "@/hooks/useApiMutation";
import type { ProfilePatch } from "@/lib/models/profile";
import { createClient } from "@/lib/supabase/client";

export type AvatarStatus = "idle" | "uploading" | "saved" | "error";

function buildAvatarUrl(
    supabase: ReturnType<typeof createClient>,
    path: string | null,
    bust?: number,
): string | null {
    if (!path) return null;
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    return bust ? `${data.publicUrl}?t=${bust}` : data.publicUrl;
}

export function useAvatarUpload(
    userId: string,
    initialAvatarPath: string | null,
) {
    const t = useTranslations("profile");

    const [avatarPath, setAvatarPath] = useState(initialAvatarPath);
    const [avatarBust, setAvatarBust] = useState<number | undefined>(undefined);
    const [status, setStatus] = useState<AvatarStatus>("idle");
    const [error, setError] = useState("");
    const fileRef = useRef<HTMLInputElement>(null);
    const supabase = createClient();

    const mutation = useApiMutation<ProfilePatch>("/api/profile", {
        successDuration: 2000,
    });

    const displayUrl = buildAvatarUrl(supabase, avatarPath, avatarBust);
    const busy = status === "uploading";

    function openFilePicker() {
        if (fileRef.current) {
            fileRef.current.value = "";
            fileRef.current.click();
        }
    }

    async function handleChange(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setStatus("uploading");
        setError("");

        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${userId}/avatar.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from("avatars")
            .upload(path, file, { upsert: true });

        if (uploadError) {
            setError(t("error_avatar"));
            setStatus("error");
            return;
        }

        const ok = await mutation.mutate({ avatar_url: path });
        if (ok) {
            setAvatarPath(path);
            setAvatarBust(Date.now());
            setStatus("saved");
            setTimeout(() => setStatus("idle"), 2000);
        } else {
            setError(t("error_avatar"));
            setStatus("error");
        }
    }

    return {
        avatarPath,
        displayUrl,
        status,
        error,
        busy,
        fileRef,
        openFilePicker,
        handleChange,
    };
}
