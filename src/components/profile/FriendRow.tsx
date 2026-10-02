"use client";

import { useTranslations } from "next-intl";
import { NavAvatar } from "@/components/nav/NavAvatar";
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

/**
 * One account of a friend / request / block list. The pseudo is user-chosen
 * text from another account: it is rendered as a React text node — never as
 * HTML — since one XSS on any `*.wiibleyde.dev` app would steal the shared
 * session of every app.
 */
export function FriendRow({ pseudo, avatarUrl, actions, disabled }: Props) {
    const t = useTranslations("friends");
    const name = pseudo ?? t("no_pseudo");

    return (
        <li
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-3 py-2.5"
            style={{
                background: "var(--panel-d2)",
                border: "2.5px solid var(--ink)",
            }}
        >
            <NavAvatar
                avatarUrl={avatarUrl}
                initial={name[0]?.toUpperCase() ?? "?"}
                username={name}
                sizePx={36}
                initialClassName="text-sm"
            />
            <span
                className="min-w-24 flex-1 truncate font-display text-lg"
                style={{ color: pseudo ? "var(--cream)" : "var(--muted)" }}
            >
                {name}
            </span>
            {/* Wraps under the name when the row is too narrow for both. */}
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
