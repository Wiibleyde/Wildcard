"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { CheckIcon, UploadIcon } from "@/components/profile/AvatarIcons";
import { useGameImageUpload } from "@/hooks/studio/useGameImageUpload";

interface Props {
    readonly ownerId: string;
    readonly gameId: string;
    readonly initialImagePath: string | null;
}

/**
 * Cover-image picker for the studio editor. Same interaction as the profile
 * avatar (hover-to-upload, direct browser → public bucket), but a wide game
 * cover instead of a round avatar. Colocated in the editor's identity panel.
 */
export function GameImageField({ ownerId, gameId, initialImagePath }: Props) {
    const t = useTranslations("studio");
    const img = useGameImageUpload(ownerId, gameId, initialImagePath);

    return (
        <div className="flex flex-col gap-2">
            <span
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: "var(--muted)" }}
            >
                {t("image_label")}
            </span>

            <div className="group relative">
                <div
                    className="relative aspect-video w-full overflow-hidden rounded-2xl"
                    style={{
                        border: "2.5px solid var(--ink)",
                        boxShadow: "0 4px 0 var(--ink)",
                        background: "var(--cream2)",
                    }}
                >
                    {img.displayUrl ? (
                        <Image
                            src={img.displayUrl}
                            alt={t("image_label")}
                            fill
                            sizes="(max-width: 1024px) 100vw, 40vw"
                            className="object-cover"
                            loading="eager"
                            unoptimized
                        />
                    ) : (
                        <div
                            className="flex h-full w-full items-center justify-center text-sm font-semibold"
                            style={{ color: "#5a5340" }}
                        >
                            {t("image_hint")}
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={img.openFilePicker}
                        disabled={img.busy}
                        className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/55 opacity-0 transition-opacity group-hover:opacity-100 disabled:cursor-not-allowed"
                    >
                        {img.busy ? (
                            <span className="px-2 text-center text-xs font-semibold leading-tight text-white">
                                {t("image_uploading")}
                            </span>
                        ) : img.status === "saved" ? (
                            <CheckIcon />
                        ) : (
                            <UploadIcon />
                        )}
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={img.openFilePicker}
                    disabled={img.busy}
                    className="text-xs font-bold underline disabled:opacity-50"
                    style={{ color: "var(--ink)" }}
                >
                    {t("image_upload")}
                </button>
                {img.imagePath && (
                    <button
                        type="button"
                        onClick={img.clearImage}
                        disabled={img.busy}
                        className="text-xs font-bold underline disabled:opacity-50"
                        style={{ color: "var(--red)" }}
                    >
                        {t("image_remove")}
                    </button>
                )}
            </div>

            {img.status === "error" && img.error && (
                <p
                    className="text-xs font-semibold"
                    style={{ color: "var(--red)" }}
                >
                    {img.error}
                </p>
            )}

            <input
                ref={img.fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={img.handleChange}
            />
        </div>
    );
}
