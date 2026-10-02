"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { GameButton } from "@/components/ui/GameButton";
import { useFriends } from "@/hooks/profile/useFriends";
import { PSEUDO_PATTERN } from "@/lib/portal/api";
import { FriendRow } from "./FriendRow";

const fieldStyle = {
    background: "var(--cream)",
    border: "2.5px solid var(--ink)",
    color: "var(--ink)",
} as const;

/** Portal error codes that have their own message; anything else is generic. */
const KNOWN_ERRORS = new Set([
    "invalid_pseudo",
    "self",
    "not_found",
    "already_friend",
    "rate_limited",
    "unauthorized",
    "network",
] as const);
type KnownError = typeof KNOWN_ERRORS extends Set<infer E> ? E : never;

function Section({
    title,
    count,
    accent,
    empty,
    children,
}: {
    title: string;
    count: number;
    accent: string;
    empty: string;
    children: React.ReactNode;
}) {
    return (
        <section className="panel-d flex flex-col gap-3 p-5 xl:p-6">
            <h2
                className="stamp w-fit"
                style={{ background: accent, color: "var(--ink)" }}
            >
                {title} · {count}
            </h2>
            {count === 0 ? (
                <p
                    className="text-sm font-semibold"
                    style={{ color: "var(--muted)" }}
                >
                    {empty}
                </p>
            ) : (
                <ul className="flex flex-col gap-2">{children}</ul>
            )}
        </section>
    );
}

/**
 * Friend list of the domain-wide account — the same list as on the portal's
 * account page, managed here through the portal API. Directed edges: a
 * request is one-sided until the other account adds back.
 */
export function FriendsClient() {
    const t = useTranslations("friends");
    const confirm = useConfirm();
    const f = useFriends();
    const [pseudo, setPseudo] = useState("");
    const [localError, setLocalError] = useState<KnownError | null>(null);

    const mutual = f.friends.filter((x) => x.mutual);
    const incoming = f.friends.filter((x) => x.addedMe && !x.added);
    const outgoing = f.friends.filter((x) => x.added && !x.addedMe);

    const errorCode = localError ?? f.error;
    const errorText = errorCode
        ? t(
              `errors.${
                  (KNOWN_ERRORS as ReadonlySet<string>).has(errorCode)
                      ? (errorCode as KnownError)
                      : "generic"
              }`,
          )
        : null;

    async function onAdd(e: FormEvent) {
        e.preventDefault();
        const value = pseudo.trim();
        if (!PSEUDO_PATTERN.test(value)) {
            setLocalError("invalid_pseudo");
            return;
        }
        setLocalError(null);
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
            <p
                className="text-sm font-semibold"
                style={{ color: "var(--muted)" }}
            >
                {t("loading")}
            </p>
        );
    }
    if (f.load === "error") {
        return (
            <div className="panel-d flex flex-col items-start gap-3 p-6">
                <p
                    className="text-sm font-semibold"
                    style={{ color: "var(--cream)" }}
                >
                    {errorText ?? t("errors.generic")}
                </p>
                <GameButton size="sm" onClick={() => void f.reload()}>
                    {t("retry")}
                </GameButton>
            </div>
        );
    }

    const nameOf = (p: string | null) => p ?? t("no_pseudo");

    return (
        <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
            <div className="flex min-w-0 flex-col gap-5">
                <form
                    onSubmit={onAdd}
                    className="panel-d flex flex-col gap-3 p-5 xl:p-6"
                >
                    <label
                        htmlFor="friend-pseudo"
                        className="text-xs font-bold uppercase tracking-widest"
                        style={{ color: "var(--muted)" }}
                    >
                        {t("add_label")}
                    </label>
                    <div className="flex gap-2">
                        <input
                            id="friend-pseudo"
                            value={pseudo}
                            onChange={(e) => {
                                setPseudo(e.target.value);
                                setLocalError(null);
                            }}
                            placeholder={t("add_placeholder")}
                            maxLength={24}
                            autoComplete="off"
                            spellCheck={false}
                            className="min-w-0 flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold outline-none"
                            style={fieldStyle}
                        />
                        <GameButton
                            type="submit"
                            variant="green"
                            size="sm"
                            disabled={f.pending !== null || !pseudo.trim()}
                        >
                            {t("add")}
                        </GameButton>
                    </div>
                    <p
                        className="text-xs font-semibold"
                        style={{ color: "var(--muted)" }}
                    >
                        {t("add_hint")}
                    </p>
                    {errorText && (
                        <p
                            role="alert"
                            className="text-sm font-bold"
                            style={{ color: "var(--red)" }}
                        >
                            {errorText}
                        </p>
                    )}
                </form>

                <Section
                    title={t("friends_title")}
                    count={mutual.length}
                    accent="var(--gold)"
                    empty={t("friends_empty")}
                >
                    {mutual.map((x) => (
                        <FriendRow
                            key={x.id}
                            pseudo={x.pseudo}
                            avatarUrl={x.avatarUrl}
                            disabled={f.pending !== null}
                            actions={[
                                {
                                    key: "remove",
                                    label: t("remove"),
                                    variant: "ghost",
                                    onClick: () =>
                                        void onRemove(x.id, nameOf(x.pseudo)),
                                },
                                {
                                    key: "block",
                                    label: t("block"),
                                    variant: "red",
                                    onClick: () =>
                                        void onBlock(x.id, nameOf(x.pseudo)),
                                },
                            ]}
                        />
                    ))}
                </Section>
            </div>

            <div className="flex min-w-0 flex-col gap-5">
                <Section
                    title={t("incoming_title")}
                    count={incoming.length}
                    accent="var(--green)"
                    empty={t("incoming_empty")}
                >
                    {incoming.map((x) => (
                        <FriendRow
                            key={x.id}
                            pseudo={x.pseudo}
                            avatarUrl={x.avatarUrl}
                            disabled={f.pending !== null}
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
                                        void onBlock(x.id, nameOf(x.pseudo)),
                                },
                            ]}
                        />
                    ))}
                </Section>

                <Section
                    title={t("outgoing_title")}
                    count={outgoing.length}
                    accent="var(--blue)"
                    empty={t("outgoing_empty")}
                >
                    {outgoing.map((x) => (
                        <FriendRow
                            key={x.id}
                            pseudo={x.pseudo}
                            avatarUrl={x.avatarUrl}
                            disabled={f.pending !== null}
                            actions={[
                                {
                                    key: "cancel",
                                    label: t("cancel"),
                                    variant: "ghost",
                                    onClick: () => void f.remove(x.id),
                                },
                            ]}
                        />
                    ))}
                </Section>

                <Section
                    title={t("blocks_title")}
                    count={f.blocks.length}
                    accent="var(--red)"
                    empty={t("blocks_empty")}
                >
                    {f.blocks.map((x) => (
                        <FriendRow
                            key={x.id}
                            pseudo={x.pseudo}
                            avatarUrl={x.avatarUrl}
                            disabled={f.pending !== null}
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
    );
}
