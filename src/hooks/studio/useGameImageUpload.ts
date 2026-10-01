"use client";

import { useTranslations } from "next-intl";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useApiMutation } from "@/hooks/useApiMutation";
import { ecaCoverImagePath, ecaImageExtensionOf } from "@/lib/eca/id";
import { createClient } from "@/lib/supabase/client";
import { ecaImagesBucket } from "@/lib/supabase/storage";

export type GameImageStatus = "idle" | "uploading" | "saved" | "error";

function buildImageUrl(
    supabase: ReturnType<typeof createClient>,
    path: string | null,
    bust?: number,
): string | null {
    if (!path) return null;
    const { data } = supabase.storage
        .from(ecaImagesBucket())
        .getPublicUrl(path);
    return bust ? `${data.publicUrl}?t=${bust}` : data.publicUrl;
}

/**
 * Cover-image upload for a studio game — the same shape as
 * the former avatar upload hook: the file
 * goes straight to the public `eca-images` bucket from the browser (RLS keys
 * the write to `${ownerId}/…`), then the returned path is persisted through
 * the studio PATCH API. `gameId` names the object so re-uploads upsert in
 * place (a new extension is a new object — the server removes the old one);
 * the `bust` query param forces the `<img>` to reload after an upsert.
 */
export function useGameImageUpload(
    ownerId: string,
    gameId: string,
    initialImagePath: string | null,
) {
    const t = useTranslations("studio");

    const [imagePath, setImagePath] = useState(initialImagePath);
    const [imageBust, setImageBust] = useState<number | undefined>(undefined);
    const [status, setStatus] = useState<GameImageStatus>("idle");
    const [error, setError] = useState("");
    const fileRef = useRef<HTMLInputElement>(null);
    const supabase = createClient();

    // The "saved" badge resets to "idle" on a timer; clear it on unmount so the
    // callback never sets state on an unmounted component.
    const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(
        () => () => {
            if (resetTimer.current) clearTimeout(resetTimer.current);
        },
        [],
    );
    function scheduleIdle() {
        if (resetTimer.current) clearTimeout(resetTimer.current);
        resetTimer.current = setTimeout(() => setStatus("idle"), 2000);
    }

    const mutation = useApiMutation<{ image_url: string | null }>(
        `/api/studio/games/${gameId}`,
        { successDuration: 2000 },
    );

    const displayUrl = buildImageUrl(supabase, imagePath, imageBust);
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

        // The server only accepts the exact `<owner>/<game>.<ext>` cover path
        // with an image extension — refuse anything else before uploading.
        const ext = ecaImageExtensionOf(file.name);
        if (ext === null) {
            setError(t("image_error"));
            setStatus("error");
            return;
        }
        setStatus("uploading");
        setError("");

        const path = ecaCoverImagePath(ownerId, gameId, ext);

        const { error: uploadError } = await supabase.storage
            .from(ecaImagesBucket())
            .upload(path, file, { upsert: true });

        if (uploadError) {
            setError(t("image_error"));
            setStatus("error");
            return;
        }

        const ok = await mutation.mutate({ image_url: path });
        if (ok) {
            setImagePath(path);
            setImageBust(Date.now());
            setStatus("saved");
            scheduleIdle();
        } else {
            setError(t("image_error"));
            setStatus("error");
        }
    }

    async function clearImage() {
        if (busy || !imagePath) return;
        setStatus("uploading");
        setError("");
        const ok = await mutation.mutate({ image_url: null });
        if (ok) {
            setImagePath(null);
            setImageBust(undefined);
            setStatus("saved");
            scheduleIdle();
        } else {
            setError(t("image_error"));
            setStatus("error");
        }
    }

    return {
        imagePath,
        displayUrl,
        status,
        error,
        busy,
        fileRef,
        openFilePicker,
        handleChange,
        clearImage,
    };
}
