"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

interface Props {
    readonly code: string;
    readonly moduleName: string;
}

/** The invite code, one white card per character; a click copies it. */
export function RoomCodeCard({ code, moduleName }: Props) {
    const t = useTranslations("room");
    const [copied, setCopied] = useState(false);
    const timer = useRef<number | null>(null);
    useEffect(
        () => () => {
            if (timer.current !== null) clearTimeout(timer.current);
        },
        [],
    );

    async function copy() {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            if (timer.current !== null) clearTimeout(timer.current);
            timer.current = window.setTimeout(() => {
                setCopied(false);
                timer.current = null;
            }, 1500);
        } catch {
            // Clipboard denied (insecure context): the code stays readable.
        }
    }

    return (
        <section className="panel flex flex-col items-center gap-4 p-5 text-center xl:p-6">
            <p className="text-sm font-semibold text-wc-muted">
                {t("share_title", { game: moduleName })}
            </p>
            <button
                type="button"
                onClick={copy}
                aria-label={`${code} · ${t("copy")}`}
                className="flex gap-2 transition-transform active:scale-95"
            >
                {[...code].map((ch, i) => (
                    <span
                        // biome-ignore lint/suspicious/noArrayIndexKey: characters of a fixed code
                        key={i}
                        aria-hidden="true"
                        className="card-surface grid aspect-[5/7] w-11 place-items-center font-display text-3xl xl:w-13 xl:text-4xl"
                        style={{
                            rotate: `${(i - (code.length - 1) / 2) * 2}deg`,
                        }}
                    >
                        {ch}
                    </span>
                ))}
            </button>
            <span
                aria-live="polite"
                className="stamp"
                style={{
                    background: copied ? "var(--green)" : "var(--panel-d2)",
                    color: copied ? "#fff" : "var(--muted)",
                }}
            >
                {copied ? t("copied") : t("copy")}
            </span>
        </section>
    );
}
