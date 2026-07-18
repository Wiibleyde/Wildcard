"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
    type DraftDefinition,
    toDraftDefinition,
} from "@/components/studio/draft";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useRouter } from "@/i18n/navigation";
import type { EcaDefinition } from "@/lib/eca/types";
import {
    type EcaValidationError,
    validateEcaDefinition,
} from "@/lib/eca/validate";
import type { Translate } from "@/lib/games/catalogView";
import type { StudioErrorCode } from "@/lib/models/studio";

/**
 * All editor state + CRUD wiring for {@link import("@/components/studio/EcaEditor").EcaEditor}.
 * Owns the draft definition (a keyed mirror of the stored
 * {@link EcaDefinition}), validates it live on every change, and talks to the
 * CRUD API: save (PATCH name/description/definition), publish / unpublish
 * (PATCH status), delete. The definition sent to the server is the validator's
 * REBUILT output — editor-local keys never leave the browser.
 */

/** Validation error codes with a translation in `studio.errors.*`. */
const KNOWN_ERROR_CODES: ReadonlySet<string> = new Set([
    "not_object",
    "invalid_version",
    "invalid_name",
    "invalid_description",
    "invalid_players",
    "invalid_deck",
    "invalid_start_discard",
    "invalid_hand_size",
    "invalid_turn_flag",
    "invalid_rules",
    "invalid_rule",
    "invalid_rule_id",
    "invalid_rule_name",
    "invalid_event",
    "invalid_conditions",
    "too_many_conditions",
    "invalid_condition",
    "invalid_operand",
    "played_card_scope",
    "invalid_comparator",
    "non_numeric_comparison",
    "invalid_effects",
    "invalid_effect",
    "effect_event_mismatch",
    "invalid_draw_target",
    "invalid_draw_count",
    "invalid_winner",
    "duplicate_rule_id",
    "no_accepting_rule",
    "invalid_win",
]);

/**
 * `studio.api_errors.*` key per CRUD failure code. Typed as a full Record so
 * the compiler flags any drift when {@link StudioErrorCode} changes.
 */
const API_ERROR_KEYS: Record<StudioErrorCode, string> = {
    not_found: "api_errors.not_found",
    invalid_definition: "api_errors.invalid_definition",
    invalid_input: "api_errors.invalid_input",
    limit_reached: "api_errors.limit_reached",
    db_error: "api_errors.db_error",
};

export interface StudioGameDetail {
    readonly id: string;
    readonly ownerId: string;
    readonly name: string;
    readonly description: string | null;
    readonly status: "draft" | "published";
    readonly imageUrl: string | null;
    readonly definition: EcaDefinition;
}

interface SavePayload {
    readonly name: string;
    readonly description: string | null;
    readonly definition: EcaDefinition;
}

export function useEcaEditor(initialGame: StudioGameDetail) {
    const t = useTranslations("studio");
    // Dynamic `errors.<code>` lookups need the loose Translate shape.
    const te = useTranslations("studio") as unknown as Translate;
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
    const [localError, setLocalError] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    const saveMutation = useApiMutation<SavePayload>(
        `/api/studio/games/${initialGame.id}`,
        { successDuration: 2000 },
    );
    const statusMutation = useApiMutation<{ status: "draft" | "published" }>(
        `/api/studio/games/${initialGame.id}`,
    );

    const validation = useMemo(() => validateEcaDefinition(draft), [draft]);
    const dirty = JSON.stringify(draft) !== savedJson;
    const saving = saveMutation.status === "pending";
    const saved = saveMutation.status === "success";
    const publishing = statusMutation.status === "pending";

    function patchMeta(patch: Partial<DraftDefinition["meta"]>) {
        setDraft((d) => ({ ...d, meta: { ...d.meta, ...patch } }));
    }

    function patchSetup(patch: Partial<DraftDefinition["setup"]>) {
        setDraft((d) => ({ ...d, setup: { ...d.setup, ...patch } }));
    }

    function patchTurn(patch: Partial<DraftDefinition["turn"]>) {
        setDraft((d) => ({ ...d, turn: { ...d.turn, ...patch } }));
    }

    function setRules(rules: DraftDefinition["rules"]) {
        setDraft((d) => ({ ...d, rules }));
    }

    function parseCount(raw: string): number {
        const parsed = Number.parseInt(raw, 10);
        return Number.isNaN(parsed) ? 0 : parsed;
    }

    async function handleSave() {
        if (!validation.ok || !dirty || saving) return;
        setLocalError(null);
        const definition = validation.definition;
        const ok = await saveMutation.mutate({
            name: definition.meta.name,
            description: definition.meta.description ?? null,
            definition,
        });
        if (ok) setSavedJson(JSON.stringify(draft));
    }

    async function handleToggleStatus() {
        if (publishing) return;
        setLocalError(null);
        const next = status === "published" ? "draft" : "published";
        const ok = await statusMutation.mutate({ status: next });
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
        setDeleting(true);
        setLocalError(null);
        const res = await fetch(`/api/studio/games/${initialGame.id}`, {
            method: "DELETE",
        });
        if (!res.ok) {
            setDeleting(false);
            setLocalError(t("delete_error"));
            return;
        }
        router.push("/studio");
    }

    function errorText(error: EcaValidationError): string {
        return KNOWN_ERROR_CODES.has(error.code)
            ? te(`errors.${error.code}`)
            : error.message;
    }

    /** Known API failure codes get a real message; the rest stay generic. */
    function apiErrorText(code: string | null): string {
        return code !== null && Object.hasOwn(API_ERROR_KEYS, code)
            ? te(API_ERROR_KEYS[code as StudioErrorCode])
            : tCommon("error");
    }

    const publishDisabled =
        publishing || (status === "draft" && (dirty || !validation.ok));
    const mutationFailed =
        saveMutation.status === "error" || statusMutation.status === "error";
    const mutationErrorCode =
        saveMutation.status === "error"
            ? saveMutation.error
            : statusMutation.status === "error"
              ? statusMutation.error
              : null;

    return {
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
        patchMeta,
        patchSetup,
        patchTurn,
        setRules,
        parseCount,
        handleSave,
        handleToggleStatus,
        handleDelete,
        errorText,
        apiErrorText,
    };
}

export type EcaEditorController = ReturnType<typeof useEcaEditor>;
