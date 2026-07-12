"use client";

import { useTranslations } from "next-intl";
import { type CSSProperties, useMemo, useState } from "react";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { GameButton } from "@/components/ui/GameButton";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useRouter } from "@/i18n/navigation";
import type { EcaDefinition } from "@/lib/eca/types";
import {
    ECA_DESCRIPTION_MAX,
    ECA_HAND_SIZE_MAX,
    ECA_HAND_SIZE_MIN,
    ECA_NAME_MAX,
    ECA_PLAYERS_MAX,
    ECA_PLAYERS_MIN,
    type EcaValidationError,
    validateEcaDefinition,
} from "@/lib/eca/validate";
import type { Translate } from "@/lib/games/catalogView";
import type { StudioErrorCode } from "@/lib/models/studio";
import { type DraftDefinition, toDraftDefinition } from "./draft";
import { fieldClass, fieldStyle, labelClass, labelStyle } from "./fields";
import { GameImageField } from "./GameImageField";
import { RuleList } from "./RuleList";
import { TestPlay } from "./TestPlay";

/**
 * The Game Studio editor. Owns the draft definition (a keyed mirror of the
 * stored {@link EcaDefinition}), validates it live on every change, and talks
 * to the CRUD API: save (PATCH name/description/definition), publish /
 * unpublish (PATCH status), delete. The definition sent to the server is the
 * validator's REBUILT output — editor-local keys never leave the browser.
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

interface Props {
    readonly initialGame: StudioGameDetail;
}

export function EcaEditor({ initialGame }: Props) {
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

    const statusStamp: CSSProperties =
        status === "published"
            ? { background: "var(--green)", color: "var(--ink)" }
            : { background: "var(--cream2)", color: "var(--ink)" };

    return (
        <div className="flex flex-col gap-6">
            {/* Header: back, live title, badges, actions. */}
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
                            {t("errors_title", {
                                n: validation.errors.length,
                            })}
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

            {/* Live validation report. */}
            {!validation.ok && (
                <div
                    className="rounded-2xl p-4"
                    style={{
                        background: "var(--red)",
                        border: "2.5px solid var(--ink)",
                        boxShadow: "0 4px 0 var(--ink)",
                        color: "var(--accent-ink)",
                    }}
                >
                    <p className="font-display">
                        {t("errors_title", { n: validation.errors.length })}
                    </p>
                    <ul className="mt-2 flex flex-col gap-1">
                        {validation.errors.map((error) => (
                            <li
                                key={`${error.path}:${error.code}`}
                                className="text-xs font-semibold"
                            >
                                <span className="opacity-80">
                                    {error.path || "—"}
                                </span>{" "}
                                · {errorText(error)}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Stacked on mobile, settings rail + rules from lg:. */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                <div className="flex flex-col gap-6 lg:col-span-2">
                    {/* Identity */}
                    <section className="panel flex flex-col gap-4 p-5">
                        <h2
                            className="font-display text-xl"
                            style={{ color: "var(--ink)" }}
                        >
                            {t("editor_meta")}
                        </h2>
                        <div>
                            <label
                                htmlFor="studio-name"
                                className={`${labelClass} mb-2 block`}
                                style={labelStyle}
                            >
                                {t("create_name_label")}
                            </label>
                            <input
                                id="studio-name"
                                value={draft.meta.name}
                                onChange={(e) =>
                                    patchMeta({ name: e.target.value })
                                }
                                maxLength={ECA_NAME_MAX}
                                placeholder={t("create_name_placeholder")}
                                className={`${fieldClass} w-full`}
                                style={fieldStyle}
                            />
                        </div>
                        <div>
                            <label
                                htmlFor="studio-description"
                                className={`${labelClass} mb-2 block`}
                                style={labelStyle}
                            >
                                {t("description_label")}
                            </label>
                            <textarea
                                id="studio-description"
                                value={draft.meta.description ?? ""}
                                onChange={(e) =>
                                    patchMeta({
                                        description:
                                            e.target.value.length > 0
                                                ? e.target.value
                                                : undefined,
                                    })
                                }
                                maxLength={ECA_DESCRIPTION_MAX}
                                rows={3}
                                placeholder={t("description_placeholder")}
                                className={`${fieldClass} w-full resize-none`}
                                style={fieldStyle}
                            />
                        </div>
                        <GameImageField
                            ownerId={initialGame.ownerId}
                            gameId={initialGame.id}
                            initialImagePath={initialGame.imageUrl}
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label
                                    htmlFor="studio-min-players"
                                    className={`${labelClass} mb-2 block`}
                                    style={labelStyle}
                                >
                                    {t("min_players")}
                                </label>
                                <input
                                    id="studio-min-players"
                                    type="number"
                                    min={ECA_PLAYERS_MIN}
                                    max={ECA_PLAYERS_MAX}
                                    value={draft.meta.minPlayers}
                                    onChange={(e) =>
                                        patchMeta({
                                            minPlayers: parseCount(
                                                e.target.value,
                                            ),
                                        })
                                    }
                                    className={`${fieldClass} w-full`}
                                    style={fieldStyle}
                                />
                            </div>
                            <div>
                                <label
                                    htmlFor="studio-max-players"
                                    className={`${labelClass} mb-2 block`}
                                    style={labelStyle}
                                >
                                    {t("max_players")}
                                </label>
                                <input
                                    id="studio-max-players"
                                    type="number"
                                    min={ECA_PLAYERS_MIN}
                                    max={ECA_PLAYERS_MAX}
                                    value={draft.meta.maxPlayers}
                                    onChange={(e) =>
                                        patchMeta({
                                            maxPlayers: parseCount(
                                                e.target.value,
                                            ),
                                        })
                                    }
                                    className={`${fieldClass} w-full`}
                                    style={fieldStyle}
                                />
                            </div>
                        </div>
                    </section>

                    {/* Setup */}
                    <section className="panel flex flex-col gap-4 p-5">
                        <h2
                            className="font-display text-xl"
                            style={{ color: "var(--ink)" }}
                        >
                            {t("editor_setup")}
                        </h2>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label
                                    htmlFor="studio-deck"
                                    className={`${labelClass} mb-2 block`}
                                    style={labelStyle}
                                >
                                    {t("deck_label")}
                                </label>
                                <select
                                    id="studio-deck"
                                    value={draft.setup.deckId}
                                    onChange={(e) =>
                                        patchSetup({
                                            deckId:
                                                e.target.value === "french32"
                                                    ? "french32"
                                                    : "french52",
                                        })
                                    }
                                    className={`${fieldClass} w-full`}
                                    style={fieldStyle}
                                >
                                    <option value="french52">
                                        {t("deck_french52")}
                                    </option>
                                    <option value="french32">
                                        {t("deck_french32")}
                                    </option>
                                </select>
                            </div>
                            <div>
                                <label
                                    htmlFor="studio-hand-size"
                                    className={`${labelClass} mb-2 block`}
                                    style={labelStyle}
                                >
                                    {t("hand_size")}
                                </label>
                                <input
                                    id="studio-hand-size"
                                    type="number"
                                    min={ECA_HAND_SIZE_MIN}
                                    max={ECA_HAND_SIZE_MAX}
                                    value={draft.setup.handSize}
                                    onChange={(e) =>
                                        patchSetup({
                                            handSize: parseCount(
                                                e.target.value,
                                            ),
                                        })
                                    }
                                    className={`${fieldClass} w-full`}
                                    style={fieldStyle}
                                />
                            </div>
                        </div>
                        <ToggleRow
                            label={t("start_discard")}
                            checked={draft.setup.startDiscard}
                            onChange={(startDiscard) =>
                                patchSetup({ startDiscard })
                            }
                        />
                    </section>

                    {/* Turn flow */}
                    <section className="panel flex flex-col gap-3 p-5">
                        <h2
                            className="font-display text-xl"
                            style={{ color: "var(--ink)" }}
                        >
                            {t("editor_turn")}
                        </h2>
                        <ToggleRow
                            label={t("allow_draw")}
                            checked={draft.turn.allowDraw}
                            onChange={(allowDraw) => patchTurn({ allowDraw })}
                        />
                        <ToggleRow
                            label={t("allow_pass")}
                            checked={draft.turn.allowPass}
                            onChange={(allowPass) => patchTurn({ allowPass })}
                        />
                        <ToggleRow
                            label={t("pass_requires_draw")}
                            checked={draft.turn.passRequiresDraw}
                            onChange={(passRequiresDraw) =>
                                patchTurn({ passRequiresDraw })
                            }
                        />
                        <ToggleRow
                            label={t("reshuffle_discard")}
                            checked={draft.turn.reshuffleDiscard}
                            onChange={(reshuffleDiscard) =>
                                patchTurn({ reshuffleDiscard })
                            }
                        />
                    </section>

                    {/* Win condition (v1: fixed) */}
                    <section className="panel flex flex-col gap-2 p-5">
                        <h2
                            className="font-display text-xl"
                            style={{ color: "var(--ink)" }}
                        >
                            {t("editor_win")}
                        </h2>
                        <p
                            className="text-sm font-semibold"
                            style={{ color: "#5a5340" }}
                        >
                            {t("win_empty_hand")}
                        </p>
                    </section>
                </div>

                <div className="lg:col-span-3">
                    <RuleList
                        rules={draft.rules}
                        deckId={draft.setup.deckId}
                        onChange={(rules) => setDraft((d) => ({ ...d, rules }))}
                    />
                </div>
            </div>

            <TestPlay definition={draft} valid={validation.ok} />
        </div>
    );
}

function ToggleRow({
    label,
    checked,
    onChange,
}: {
    readonly label: string;
    readonly checked: boolean;
    readonly onChange: (checked: boolean) => void;
}) {
    return (
        <label className="flex cursor-pointer items-center gap-3">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="h-5 w-5 shrink-0 cursor-pointer"
                style={{ accentColor: "var(--red)" }}
            />
            <span
                className="text-sm font-semibold"
                style={{ color: "var(--ink)" }}
            >
                {label}
            </span>
        </label>
    );
}
