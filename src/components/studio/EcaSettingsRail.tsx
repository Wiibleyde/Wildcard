"use client";

import { useTranslations } from "next-intl";
import type { EcaEditorController } from "@/hooks/studio/useEcaEditor";
import {
    ECA_DESCRIPTION_MAX,
    ECA_HAND_SIZE_MAX,
    ECA_HAND_SIZE_MIN,
    ECA_NAME_MAX,
    ECA_PLAYERS_MAX,
    ECA_PLAYERS_MIN,
} from "@/lib/eca/validate";
import { fieldClass, fieldStyle, labelClass, labelStyle } from "./fields";
import { GameImageField } from "./GameImageField";

/**
 * The left settings rail of the Studio editor: game identity (name,
 * description, cover, player range), deal setup, turn flow toggles, and the
 * fixed v1 win condition. All edits flow through the editor's `patch*` helpers.
 */
export function EcaSettingsRail({
    editor,
    ownerId,
    gameId,
    imageUrl,
}: {
    readonly editor: EcaEditorController;
    readonly ownerId: string;
    readonly gameId: string;
    readonly imageUrl: string | null;
}) {
    const t = useTranslations("studio");
    const { draft, patchMeta, patchSetup, patchTurn, parseCount } = editor;

    return (
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
                        onChange={(e) => patchMeta({ name: e.target.value })}
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
                    ownerId={ownerId}
                    gameId={gameId}
                    initialImagePath={imageUrl}
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
                                    minPlayers: parseCount(e.target.value),
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
                                    maxPlayers: parseCount(e.target.value),
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
                                    handSize: parseCount(e.target.value),
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
                    onChange={(startDiscard) => patchSetup({ startDiscard })}
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
