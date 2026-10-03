"use client";

import { useTranslations } from "next-intl";
import { GameButton } from "@/components/ui/GameButton";
import type { EcaEditorController } from "@/hooks/studio/useEcaEditor";
import { StatusStamp } from "./StatusStamp";

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
        locked,
        validation,
        dirty,
        saving,
        saved,
        publishing,
        deleting,
        publishDisabled,
        errorMessage,
        handleSave,
        handleToggleStatus,
        handleDelete,
    } = editor;

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
                <StatusStamp status={status} />
                {locked && <StatusStamp status="locked" />}
                {validation.ok ? (
                    <span className="stamp bg-wc-green text-white">
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
                    <span className="sub text-xs">
                        {locked
                            ? t("moderation_locked_hint")
                            : t("publish_hint")}
                    </span>
                )}
            </div>
            {errorMessage !== null && (
                <p
                    className="text-xs font-bold"
                    style={{ color: "var(--red)" }}
                >
                    {errorMessage}
                </p>
            )}
        </header>
    );
}
