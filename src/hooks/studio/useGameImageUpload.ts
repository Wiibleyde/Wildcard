"use client";

import { type ChangeEvent, useRef, useState } from "react";
import { useApiMutation } from "@/hooks/useApiMutation";
import { ecaCoverImagePath, ecaImageExtensionOf } from "@/lib/eca/id";
import { createClient } from "@/lib/supabase/client";
import { ecaImagesBucket, publicStorageUrl } from "@/lib/supabase/storage";

type GameImageStatus = "idle" | "uploading" | "saved" | "error";

/**
 * The file goes straight from the browser to the public bucket (storage RLS
 * keys it to the owner's folder), then the path is persisted through the
 * studio API. `bust` forces the `<img>` to reload after an in-place upsert.
 */
export function useGameImageUpload(
    ownerId: string,
    gameId: string,
    initialImagePath: string | null,
) {
    const [imagePath, setImagePath] = useState(initialImagePath);
    const [imageBust, setImageBust] = useState<number | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadFailed, setUploadFailed] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const mutation = useApiMutation<{ image_url: string | null }>(
        `/api/studio/games/${gameId}`,
        { successDuration: 2000 },
    );

    const status: GameImageStatus =
        uploading || mutation.status === "pending"
            ? "uploading"
            : uploadFailed || mutation.status === "error"
              ? "error"
              : mutation.status === "success"
                ? "saved"
                : "idle";
    const busy = status === "uploading";

    const displayUrl = imagePath
        ? `${publicStorageUrl(ecaImagesBucket(), imagePath)}${imageBust ? `?t=${imageBust}` : ""}`
        : null;

    function openFilePicker() {
        if (fileRef.current) {
            fileRef.current.value = "";
            fileRef.current.click();
        }
    }

    async function persist(path: string | null) {
        if (await mutation.mutate({ image_url: path })) {
            setImagePath(path);
            setImageBust(path ? Date.now() : null);
        }
    }

    async function handleChange(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        mutation.reset();
        // The server only accepts the exact `<owner>/<game>.<ext>` cover path.
        const ext = ecaImageExtensionOf(file.name);
        if (ext === null) {
            setUploadFailed(true);
            return;
        }
        setUploadFailed(false);
        setUploading(true);
        const path = ecaCoverImagePath(ownerId, gameId, ext);
        const { error } = await createClient()
            .storage.from(ecaImagesBucket())
            .upload(path, file, { upsert: true });
        setUploading(false);
        if (error) {
            setUploadFailed(true);
            return;
        }
        await persist(path);
    }

    async function clearImage() {
        if (busy || !imagePath) return;
        setUploadFailed(false);
        await persist(null);
    }

    return {
        imagePath,
        displayUrl,
        status,
        busy,
        fileRef,
        openFilePicker,
        handleChange,
        clearImage,
    };
}
