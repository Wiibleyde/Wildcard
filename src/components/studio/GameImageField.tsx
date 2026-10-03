"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { fieldLabelClass } from "@/components/ui/fields";
import { useGameImageUpload } from "@/hooks/studio/useGameImageUpload";
import { ECA_IMAGE_EXTENSIONS } from "@/lib/eca/id";
import { CheckIcon, UploadIcon } from "./UploadIcons";

interface Props {
    readonly ownerId: string;
    readonly gameId: string;
    readonly initialImagePath: string | null;
}

const ACCEPT = ECA_IMAGE_EXTENSIONS.map((ext) => `.${ext}`).join(",");

export function GameImageField({ ownerId, gameId, initialImagePath }: Props) {
    const t = useTranslations("studio");
    const img = useGameImageUpload(ownerId, gameId, initialImagePath);

    return (
        <div className="flex flex-col gap-2">
            <span className={fieldLabelClass}>{t("image_label")}</span>

            <div className="group relative">
                <div className="well relative aspect-video w-full overflow-hidden rounded-2xl border-2 border-dashed border-wc-edge">
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
                        <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-wc-muted">
                            {t("image_hint")}
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={img.openFilePicker}
                        disabled={img.busy}
                        aria-label={t("image_upload")}
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
                    className="text-xs font-bold text-wc-cream underline disabled:opacity-50"
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

            {img.status === "error" && (
                <p
                    className="text-xs font-semibold"
                    style={{ color: "var(--red)" }}
                >
                    {t("image_error")}
                </p>
            )}

            <input
                ref={img.fileRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={img.handleChange}
            />
        </div>
    );
}
