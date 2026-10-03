"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { CODE_LENGTH } from "@/lib/models/roomCode";

interface Props {
    readonly busy: boolean;
    readonly joining: boolean;
    readonly onJoin: (code: string) => void;
}

/** Invite-code entry: each character turns a face-down card over. */
export function JoinRoomPanel({ busy, joining, onJoin }: Props) {
    const t = useTranslations("lobby");
    const [code, setCode] = useState("");
    const [focused, setFocused] = useState(false);
    const inputId = useId();
    const slots = Array.from({ length: CODE_LENGTH }, (_, i) => i);

    return (
        <section className="panel flex flex-col gap-4 p-5">
            <div>
                <h2 className="h-lg">{t("join_title")}</h2>
                <p className="sub mt-1 text-sm">{t("join_subtitle")}</p>
            </div>
            <label
                htmlFor={inputId}
                className="relative flex cursor-text justify-center gap-2"
            >
                <input
                    id={inputId}
                    value={code}
                    onChange={(e) =>
                        setCode(
                            e.target.value
                                .toUpperCase()
                                .replace(/[^A-Z0-9]/g, "")
                                .slice(0, CODE_LENGTH),
                        )
                    }
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && code.length === CODE_LENGTH)
                            onJoin(code);
                    }}
                    aria-label={t("code_label")}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    className="absolute inset-0 w-full opacity-0"
                />
                {slots.map((i) => (
                    <span
                        key={i}
                        aria-hidden="true"
                        className="wc-flip aspect-[5/7] w-full max-w-12"
                        data-on={i < code.length}
                        data-caret={focused && i === code.length}
                    >
                        <span>
                            <span
                                className="rounded-md"
                                style={{
                                    background:
                                        "repeating-linear-gradient(45deg, rgba(0,0,0,0.13) 0 3px, transparent 3px 9px), var(--red)",
                                    boxShadow: `inset 0 0 0 3px var(--cream), inset 0 0 0 5px ${focused && i === code.length ? "var(--gold)" : "#d6cde6"}, 0 4px 0 var(--drop)`,
                                }}
                            />
                            <span className="card-surface grid place-items-center rounded-md font-display text-2xl">
                                {code[i] ?? ""}
                            </span>
                        </span>
                    </span>
                ))}
            </label>
            <GameButton
                variant="gold"
                onClick={() => onJoin(code)}
                disabled={busy || code.length !== CODE_LENGTH}
                className="w-full"
            >
                {joining ? t("joining") : t("join_room")}
            </GameButton>
        </section>
    );
}
