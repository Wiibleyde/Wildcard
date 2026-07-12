"use client";

import {
    type StudioGameDetail,
    useEcaEditor,
} from "@/hooks/studio/useEcaEditor";
import { EcaEditorHeader } from "./EcaEditorHeader";
import { EcaSettingsRail } from "./EcaSettingsRail";
import { RuleList } from "./RuleList";
import { TestPlay } from "./TestPlay";
import { ValidationReport } from "./ValidationReport";

export type { StudioGameDetail };

/**
 * The Game Studio editor — a thin shell over {@link useEcaEditor}: header +
 * live validation report on top, settings rail + rule list side by side from
 * `lg:`, and the sandbox test player below. All state and CRUD wiring live in
 * the hook; the layout children read it through the returned controller.
 */
export function EcaEditor({
    initialGame,
}: {
    readonly initialGame: StudioGameDetail;
}) {
    const editor = useEcaEditor(initialGame);

    return (
        <div className="flex flex-col gap-6">
            <EcaEditorHeader editor={editor} />

            {!editor.validation.ok && (
                <ValidationReport
                    errors={editor.validation.errors}
                    errorText={editor.errorText}
                />
            )}

            {/* Stacked on mobile, settings rail + rules from lg:. */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                <EcaSettingsRail
                    editor={editor}
                    ownerId={initialGame.ownerId}
                    gameId={initialGame.id}
                    imageUrl={initialGame.imageUrl}
                />
                <div className="lg:col-span-3">
                    <RuleList
                        rules={editor.draft.rules}
                        deckId={editor.draft.setup.deckId}
                        onChange={editor.setRules}
                    />
                </div>
            </div>

            <TestPlay definition={editor.draft} valid={editor.validation.ok} />
        </div>
    );
}
