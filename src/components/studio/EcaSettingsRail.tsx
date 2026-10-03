"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/base/input";
import { Textarea } from "@/components/ui/base/textarea";
import { fieldClass, fieldLabelClass } from "@/components/ui/fields";
import { SelectField } from "@/components/ui/SelectField";
import type { EcaEditorController } from "@/hooks/studio/useEcaEditor";
import { ECA_DECK_IDS, isOneOf } from "@/lib/eca/schema";
import type { StudioMessageKey } from "@/lib/eca/studioMessages";
import type { EcaDeckId, EcaDefinition } from "@/lib/eca/types";
import {
    ECA_DESCRIPTION_MAX,
    ECA_HAND_SIZE_MAX,
    ECA_HAND_SIZE_MIN,
    ECA_NAME_MAX,
    ECA_PLAYERS_MAX,
    ECA_PLAYERS_MIN,
} from "@/lib/eca/validate";
import { GameImageField } from "./GameImageField";
import { NumberField } from "./NumberField";
import { PanelTitle } from "./PanelTitle";
import { ToggleRow } from "./ToggleRow";

const DECK_LABELS: Record<EcaDeckId, StudioMessageKey> = {
    french52: "deck_french52",
    french32: "deck_french32",
};

const TURN_FLAGS: ReadonlyArray<{
    readonly flag: keyof EcaDefinition["turn"];
    readonly label: StudioMessageKey;
}> = [
    { flag: "allowDraw", label: "allow_draw" },
    { flag: "allowPass", label: "allow_pass" },
    { flag: "passRequiresDraw", label: "pass_requires_draw" },
    { flag: "reshuffleDiscard", label: "reshuffle_discard" },
];

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
    const { draft, patchMeta, patchSetup, patchTurn } = editor;

    return (
        <div className="flex flex-col gap-6 lg:col-span-2">
            <section className="panel flex flex-col gap-4 p-5">
                <PanelTitle>{t("editor_meta")}</PanelTitle>
                <div>
                    <label
                        htmlFor="studio-name"
                        className={`${fieldLabelClass} mb-2 block`}
                    >
                        {t("create_name_label")}
                    </label>
                    <Input
                        id="studio-name"
                        value={draft.meta.name}
                        onChange={(e) => patchMeta({ name: e.target.value })}
                        maxLength={ECA_NAME_MAX}
                        placeholder={t("create_name_placeholder")}
                        className={`${fieldClass} w-full`}
                    />
                </div>
                <div>
                    <label
                        htmlFor="studio-description"
                        className={`${fieldLabelClass} mb-2 block`}
                    >
                        {t("description_label")}
                    </label>
                    <Textarea
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
                    />
                </div>
                <GameImageField
                    ownerId={ownerId}
                    gameId={gameId}
                    initialImagePath={imageUrl}
                />
                <div className="grid grid-cols-2 gap-3">
                    <NumberField
                        id="studio-min-players"
                        label={t("min_players")}
                        min={ECA_PLAYERS_MIN}
                        max={ECA_PLAYERS_MAX}
                        value={draft.meta.minPlayers}
                        onChange={(minPlayers) => patchMeta({ minPlayers })}
                    />
                    <NumberField
                        id="studio-max-players"
                        label={t("max_players")}
                        min={ECA_PLAYERS_MIN}
                        max={ECA_PLAYERS_MAX}
                        value={draft.meta.maxPlayers}
                        onChange={(maxPlayers) => patchMeta({ maxPlayers })}
                    />
                </div>
            </section>

            <section className="panel flex flex-col gap-4 p-5">
                <PanelTitle>{t("editor_setup")}</PanelTitle>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label
                            htmlFor="studio-deck"
                            className={`${fieldLabelClass} mb-2 block`}
                        >
                            {t("deck_label")}
                        </label>
                        <SelectField
                            id="studio-deck"
                            value={draft.setup.deckId}
                            onChange={(deckId) => {
                                if (isOneOf(deckId, ECA_DECK_IDS)) {
                                    patchSetup({ deckId });
                                }
                            }}
                            className={`${fieldClass} w-full`}
                            options={ECA_DECK_IDS.map((deckId) => ({
                                value: deckId,
                                label: t(DECK_LABELS[deckId]),
                            }))}
                        />
                    </div>
                    <NumberField
                        id="studio-hand-size"
                        label={t("hand_size")}
                        min={ECA_HAND_SIZE_MIN}
                        max={ECA_HAND_SIZE_MAX}
                        value={draft.setup.handSize}
                        onChange={(handSize) => patchSetup({ handSize })}
                    />
                </div>
                <ToggleRow
                    label={t("start_discard")}
                    checked={draft.setup.startDiscard}
                    onChange={(startDiscard) => patchSetup({ startDiscard })}
                />
            </section>

            <section className="panel flex flex-col gap-3 p-5">
                <PanelTitle>{t("editor_turn")}</PanelTitle>
                {TURN_FLAGS.map(({ flag, label }) => (
                    <ToggleRow
                        key={flag}
                        label={t(label)}
                        checked={draft.turn[flag]}
                        onChange={(checked) => patchTurn({ [flag]: checked })}
                    />
                ))}
            </section>

            <section className="panel flex flex-col gap-2 p-5">
                <PanelTitle>{t("editor_win")}</PanelTitle>
                <p className="text-sm font-semibold text-wc-muted">
                    {t("win_empty_hand")}
                </p>
            </section>
        </div>
    );
}
