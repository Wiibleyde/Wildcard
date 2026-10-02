"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
    type DraftDefinition,
    toDraftDefinition,
} from "@/components/studio/draft";
import { studioApiErrorKey } from "@/components/studio/messages";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useRouter } from "@/i18n/navigation";
import { reconcileCondition } from "@/lib/eca/schema";
import type { EcaDefinition } from "@/lib/eca/types";
import {
    type EcaValidationError,
    validateEcaDefinitionForWrite,
} from "@/lib/eca/validate";
import type { EcaGameStatus } from "@/lib/models/studio";

export interface StudioGameDetail {
    readonly id: string;
    readonly ownerId: string;
    readonly name: string;
    readonly description: string | null;
    readonly status: EcaGameStatus;
    readonly imageUrl: string | null;
    readonly moderationLocked?: boolean;
    readonly definition: EcaDefinition;
}

interface SavePayload {
    readonly name: string;
    readonly description: string | null;
    readonly definition: EcaDefinition;
}

type MutationKind = "save" | "status" | "delete";

/** Editor state and CRUD wiring; only the validator's rebuilt definition is ever sent. */
export function useEcaEditor(initialGame: StudioGameDetail) {
    const t = useTranslations("studio");
    const tCommon = useTranslations("common");
    const confirm = useConfirm();
    const router = useRouter();

    const [draft, setDraft] = useState<DraftDefinition>(() =>
        toDraftDefinition(initialGame.definition),
    );
    const [status, setStatus] = useState(initialGame.status);
    const [savedJson, setSavedJson] = useState(() =>
        JSON.stringify(toDraftDefinition(initialGame.definition)),
    );
    // Only the most recent failure is shown, whichever mutation it came from.
    const [lastFailure, setLastFailure] = useState<MutationKind | null>(null);

    const url = `/api/studio/games/${initialGame.id}` as const;
    const saveMutation = useApiMutation<SavePayload>(url, {
        successDuration: 2000,
    });
    const statusMutation = useApiMutation<{ status: EcaGameStatus }>(url);
    const deleteMutation = useApiMutation<undefined>(url, { method: "DELETE" });

    const validation = useMemo(
        () => validateEcaDefinitionForWrite(draft),
        [draft],
    );
    const dirty = JSON.stringify(draft) !== savedJson;
    const saving = saveMutation.status === "pending";
    const saved = saveMutation.status === "success";
    const publishing = statusMutation.status === "pending";
    // Stays busy after success while the router navigates away.
    const deleting =
        deleteMutation.status === "pending" ||
        deleteMutation.status === "success";

    function patchMeta(patch: Partial<DraftDefinition["meta"]>) {
        setDraft((d) => ({ ...d, meta: { ...d.meta, ...patch } }));
    }

    function patchSetup(patch: Partial<DraftDefinition["setup"]>) {
        setDraft((d) => {
            const setup = { ...d.setup, ...patch };
            if (setup.deckId === d.setup.deckId) return { ...d, setup };
            // Rank literals of the old deck may not exist in the new one.
            const rules = d.rules.map((rule) => ({
                ...rule,
                conditions: rule.conditions.map((condition) =>
                    reconcileCondition(condition, setup.deckId),
                ),
            }));
            return { ...d, setup, rules };
        });
    }

    function patchTurn(patch: Partial<DraftDefinition["turn"]>) {
        setDraft((d) => ({ ...d, turn: { ...d.turn, ...patch } }));
    }

    function setRules(rules: DraftDefinition["rules"]) {
        setDraft((d) => ({ ...d, rules }));
    }

    async function track(kind: MutationKind, run: Promise<boolean>) {
        setLastFailure(null);
        const ok = await run;
        if (!ok) setLastFailure(kind);
        return ok;
    }

    async function handleSave() {
        if (!validation.ok || !dirty || saving) return;
        const { definition } = validation;
        const snapshot = JSON.stringify(draft);
        const ok = await track(
            "save",
            saveMutation.mutate({
                name: definition.meta.name,
                description: definition.meta.description ?? null,
                definition,
            }),
        );
        if (ok) setSavedJson(snapshot);
    }

    async function handleToggleStatus() {
        if (publishing) return;
        const next = status === "published" ? "draft" : "published";
        const ok = await track(
            "status",
            statusMutation.mutate({ status: next }),
        );
        if (ok) setStatus(next);
    }

    async function handleDelete() {
        const accepted = await confirm({
            title: t("delete"),
            message: t("delete_confirm", { name: draft.meta.name }),
            confirmLabel: t("delete"),
            variant: "red",
        });
        if (!accepted) return;
        const ok = await track("delete", deleteMutation.mutate(undefined));
        if (ok) router.push("/studio");
    }

    function errorText(error: EcaValidationError): string {
        return t(`errors.${error.code}`);
    }

    function apiErrorText(code: string | null): string {
        const key = studioApiErrorKey(code);
        return key ? t(key) : tCommon("error");
    }

    const errorMessage =
        lastFailure === "delete"
            ? t("delete_error")
            : lastFailure === "save"
              ? apiErrorText(saveMutation.error)
              : lastFailure === "status"
                ? apiErrorText(statusMutation.error)
                : null;

    // Locked at load, or found out on a refused publish.
    const locked =
        (initialGame.moderationLocked ?? false) ||
        (statusMutation.status === "error" &&
            statusMutation.error === "moderation_locked");
    const publishDisabled =
        publishing ||
        (status === "draft" && (dirty || !validation.ok || locked));

    return {
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
        patchMeta,
        patchSetup,
        patchTurn,
        setRules,
        handleSave,
        handleToggleStatus,
        handleDelete,
        errorText,
    };
}

export type EcaEditorController = ReturnType<typeof useEcaEditor>;
