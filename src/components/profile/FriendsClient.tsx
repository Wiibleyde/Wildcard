"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, type ReactNode, useState } from "react";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import {
    fieldClass,
    fieldLabelClass,
    fieldStyle,
} from "@/components/ui/fields";
import { GameButton } from "@/components/ui/GameButton";
import { useFriends } from "@/hooks/profile/useFriends";
import { PSEUDO_PATTERN } from "@/lib/portal/api";
import { FriendRow } from "./FriendRow";

/** Portal error codes with their own message; anything else is generic. */
const KNOWN_ERRORS = [
    "invalid_pseudo",
    "self",
    "not_found",
    "already_friend",
    "rate_limited",
    "unauthorized",
    "network",
] as const;
type KnownError = (typeof KNOWN_ERRORS)[number];

function isKnownError(code: string): code is KnownError {
    return (KNOWN_ERRORS as readonly string[]).includes(code);
}

function Section({
    title,
    accent,
    empty,
    count,
    children,
}: {
    title: string;
    accent: string;
    empty: string;
    count: number;
    children: ReactNode;
}) {
    return (
        <section className="panel-d flex flex-col gap-3 p-5 xl:p-6">
            <h2
                className="stamp w-fit"
                style={{ background: accent, color: "var(--ink)" }}
            >
                {title}
            </h2>
            {count === 0 ? (
                <p className="text-sm font-semibold text-wc-muted">{empty}</p>
            ) : (
                <ul className="flex flex-col gap-2">{children}</ul>
            )}
        </section>
    );
}

/** Friend edges are directed: a request stays one-sided until the other account adds back. */
export function FriendsClient() {
    const t = useTranslations("friends");
    const tCommon = useTranslations("common");
    const confirm = useConfirm();
    const f = useFriends();
    const [pseudo, setPseudo] = useState("");
    const [invalidPseudo, setInvalidPseudo] = useState(false);

    const mutual = f.friends.filter((x) => x.mutual);
    const incoming = f.friends.filter((x) => x.addedMe && !x.added);
    const outgoing = f.friends.filter((x) => x.added && !x.addedMe);

    const errorText = f.error
        ? t(`errors.${isKnownError(f.error) ? f.error : "generic"}`)
        : null;
    const busy = f.pending !== null;
    const nameOf = (p: string | null) => p ?? t("no_pseudo");

    async function onAdd(e: FormEvent) {
        e.preventDefault();
        const value = pseudo.trim();
        if (!PSEUDO_PATTERN.test(value)) {
            setInvalidPseudo(true);
            return;
        }
        if (await f.add({ pseudo: value })) setPseudo("");
    }

    async function onBlock(id: string, name: string) {
        const ok = await confirm({
            title: t("block_title"),
            message: t("block_confirm", { name }),
            confirmLabel: t("block"),
            variant: "red",
        });
        if (ok) await f.block(id);
    }

    async function onRemove(id: string, name: string) {
        const ok = await confirm({
            message: t("remove_confirm", { name }),
            confirmLabel: t("remove"),
            variant: "red",
        });
        if (ok) await f.remove(id);
    }

    if (f.load === "loading") {
        return (
            <p className="text-sm font-semibold text-wc-muted">
                {t("loading")}
            </p>
        );
    }
    if (f.load === "error") {
        return (
            <div className="panel-d flex flex-col items-start gap-3 p-6">
                <p className="text-sm font-semibold text-wc-cream">
                    {errorText ?? t("errors.generic")}
                </p>
                <GameButton size="sm" onClick={() => void f.reload()}>
                    {t("retry")}
                </GameButton>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5">
            {errorText && <ErrorBanner>{errorText}</ErrorBanner>}

            <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
                <div className="flex min-w-0 flex-col gap-5">
                    <form
                        onSubmit={onAdd}
                        className="panel-d flex flex-col gap-3 p-5 xl:p-6"
                    >
                        <label
                            htmlFor="friend-pseudo"
                            className={fieldLabelClass}
                        >
                            {t("add_label")}
                        </label>
                        <div className="flex gap-2">
                            <input
                                id="friend-pseudo"
                                value={pseudo}
                                onChange={(e) => {
                                    setPseudo(e.target.value);
                                    setInvalidPseudo(false);
                                }}
                                placeholder={t("add_placeholder")}
                                maxLength={24}
                                autoComplete="off"
                                spellCheck={false}
                                aria-invalid={invalidPseudo}
                                aria-describedby="friend-pseudo-hint"
                                className={`min-w-0 flex-1 ${fieldClass}`}
                                style={fieldStyle}
                            />
                            <GameButton
                                type="submit"
                                variant="green"
                                size="sm"
                                disabled={busy || !pseudo.trim()}
                            >
                                {t("add")}
                            </GameButton>
                        </div>
                        <p
                            id="friend-pseudo-hint"
                            className="text-xs font-semibold"
                            style={{
                                color: invalidPseudo
                                    ? "var(--red)"
                                    : "var(--muted)",
                            }}
                        >
                            {invalidPseudo
                                ? t("errors.invalid_pseudo")
                                : t("add_hint")}
                        </p>
                    </form>

                    <Section
                        title={t("friends_title", { n: mutual.length })}
                        count={mutual.length}
                        accent="var(--gold)"
                        empty={t("friends_empty")}
                    >
                        {mutual.map((x) => (
                            <FriendRow
                                key={x.id}
                                pseudo={x.pseudo}
                                avatarUrl={x.avatarUrl}
                                disabled={busy}
                                actions={[
                                    {
                                        key: "remove",
                                        label: t("remove"),
                                        variant: "ghost",
                                        onClick: () =>
                                            void onRemove(
                                                x.id,
                                                nameOf(x.pseudo),
                                            ),
                                    },
                                    {
                                        key: "block",
                                        label: t("block"),
                                        variant: "red",
                                        onClick: () =>
                                            void onBlock(
                                                x.id,
                                                nameOf(x.pseudo),
                                            ),
                                    },
                                ]}
                            />
                        ))}
                    </Section>
                </div>

                <div className="flex min-w-0 flex-col gap-5">
                    <Section
                        title={t("incoming_title", { n: incoming.length })}
                        count={incoming.length}
                        accent="var(--green)"
                        empty={t("incoming_empty")}
                    >
                        {incoming.map((x) => (
                            <FriendRow
                                key={x.id}
                                pseudo={x.pseudo}
                                avatarUrl={x.avatarUrl}
                                disabled={busy}
                                actions={[
                                    {
                                        key: "accept",
                                        label: t("accept"),
                                        variant: "green",
                                        onClick: () => void f.add({ id: x.id }),
                                    },
                                    {
                                        key: "refuse",
                                        label: t("refuse"),
                                        variant: "ghost",
                                        onClick: () => void f.refuse(x.id),
                                    },
                                    {
                                        key: "block",
                                        label: t("block"),
                                        variant: "red",
                                        onClick: () =>
                                            void onBlock(
                                                x.id,
                                                nameOf(x.pseudo),
                                            ),
                                    },
                                ]}
                            />
                        ))}
                    </Section>

                    <Section
                        title={t("outgoing_title", { n: outgoing.length })}
                        count={outgoing.length}
                        accent="var(--blue)"
                        empty={t("outgoing_empty")}
                    >
                        {outgoing.map((x) => (
                            <FriendRow
                                key={x.id}
                                pseudo={x.pseudo}
                                avatarUrl={x.avatarUrl}
                                disabled={busy}
                                actions={[
                                    {
                                        key: "cancel",
                                        label: tCommon("cancel"),
                                        variant: "ghost",
                                        onClick: () => void f.remove(x.id),
                                    },
                                ]}
                            />
                        ))}
                    </Section>

                    <Section
                        title={t("blocks_title", { n: f.blocks.length })}
                        count={f.blocks.length}
                        accent="var(--red)"
                        empty={t("blocks_empty")}
                    >
                        {f.blocks.map((x) => (
                            <FriendRow
                                key={x.id}
                                pseudo={x.pseudo}
                                avatarUrl={x.avatarUrl}
                                disabled={busy}
                                actions={[
                                    {
                                        key: "unblock",
                                        label: t("unblock"),
                                        variant: "ghost",
                                        onClick: () => void f.unblock(x.id),
                                    },
                                ]}
                            />
                        ))}
                    </Section>
                </div>
            </div>
        </div>
    );
}
