"use client";

import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/Avatar";
import { GameButton, type GameButtonVariant } from "@/components/ui/GameButton";

export interface FriendRowAction {
    readonly key: string;
    readonly label: string;
    readonly variant: GameButtonVariant;
    readonly onClick: () => void;
}

interface Props {
    readonly pseudo: string | null;
    readonly avatarUrl: string | null;
    readonly actions: readonly FriendRowAction[];
    readonly disabled: boolean;
}

// Another account's pseudo is only ever a text node: one XSS on any
// *.wiibleyde.dev app would steal the shared session of every app.
export function FriendRow({ pseudo, avatarUrl, actions, disabled }: Props) {
    const t = useTranslations("friends");
    const name = pseudo ?? t("no_pseudo");

    return (
        <li className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border-nb border-wc-ink bg-wc-panel-d2 px-3 py-2.5">
            <Avatar name={name} avatarUrl={avatarUrl} size={36} />
            <span
                className="min-w-24 flex-1 truncate font-display text-lg"
                style={{ color: pseudo ? "var(--cream)" : "var(--muted)" }}
            >
                {name}
            </span>
            <div className="ml-auto flex flex-wrap justify-end gap-2">
                {actions.map((action) => (
                    <GameButton
                        key={action.key}
                        variant={action.variant}
                        size="sm"
                        disabled={disabled}
                        onClick={action.onClick}
                    >
                        {action.label}
                    </GameButton>
                ))}
            </div>
        </li>
    );
}
