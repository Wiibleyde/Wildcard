"use client";

import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";
import { GameButton } from "@/components/ui/GameButton";
import type { EcaEditorController } from "@/hooks/studio/useEcaEditor";

/**
 * Editor header: back link, live title, status / validity badges, the
 * save / publish / delete actions, and the mutation-error line. Reads
 * everything from the {@link EcaEditorController} the editor owns.
 */
export function EcaEditorHeader({
    editor,
}: {
    readonly editor: EcaEditorController;
}) {
    const t = useTranslations("studio");
    const tCommon = useTranslations("common");
    const {
        draft,
        status,
        validation,
        dirty,
        saving,
        saved,
        publishing,
        deleting,
        localError,
        publishDisabled,
        mutationFailed,
        mutationErrorCode,
        handleSave,
        handleToggleStatus,
        handleDelete,
        apiErrorText,
    } = editor;

    const statusStamp: CSSProperties =
        status === "published"
            ? { background: "var(--green)", color: "var(--ink)" }
            : { background: "var(--cream2)", color: "var(--ink)" };

    return (
        <header className="flex flex-col gap-3">
            <div>
                <GameButton variant="ghost" size="sm" href="/studio">
                    ← {t("back_to_studio")}
                </GameButton>
            </div>
            <h1 className="h-xl text-3xl xl:text-4xl">
                {draft.meta.name || t("title")}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
                <span className="stamp" style={statusStamp}>
                    {status === "published"
                        ? t("status_published")
                        : t("status_draft")}
                </span>
                {validation.ok ? (
                    <span
                        className="stamp"
                        style={{
                            background: "var(--green)",
                            color: "var(--ink)",
                        }}
                    >
                        {t("valid_badge")}
                    </span>
                ) : (
                    <span
                        className="stamp"
                        style={{
                            background: "var(--red)",
                            color: "var(--accent-ink)",
                        }}
                    >
                        {t("errors_title", { n: validation.errors.length })}
                    </span>
                )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
                <GameButton
                    variant={saved ? "green" : "gold"}
                    size="sm"
                    onClick={handleSave}
                    disabled={!dirty || saving || !validation.ok}
                >
                    {saving
                        ? tCommon("saving")
                        : saved
                          ? `✓ ${tCommon("saved")}`
                          : t("save")}
                </GameButton>
                <GameButton
                    variant="teal"
                    size="sm"
                    onClick={handleToggleStatus}
                    disabled={publishDisabled}
                >
                    {status === "published" ? t("unpublish") : t("publish")}
                </GameButton>
                <GameButton
                    variant="red"
                    size="sm"
                    onClick={handleDelete}
                    disabled={deleting}
                >
                    {t("delete")}
                </GameButton>
                {status === "draft" && publishDisabled && !publishing && (
                    <span className="sub text-xs">{t("publish_hint")}</span>
                )}
            </div>
            {(mutationFailed || localError) && (
                <p
                    className="text-xs font-bold"
                    style={{ color: "var(--red)" }}
                >
                    {localError ?? apiErrorText(mutationErrorCode)}
                </p>
            )}
        </header>
    );
}
