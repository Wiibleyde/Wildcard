"use client";

import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/Avatar";
import { Tilt } from "@/components/ui/Tilt";

interface Props {
    readonly name: string;
    readonly avatarUrl: string | null;
    readonly level: number;
    /** Already formatted ("octobre 2026"). */
    readonly memberSince: string | null;
}

/** The player as a collectible playing card, polychrome sheen following the cursor. */
export function PlayerCard({ name, avatarUrl, level, memberSince }: Props) {
    const t = useTranslations("profile");
    return (
        <Tilt strength={18} className="w-full max-w-80">
            <div className="card-surface wc-holo relative flex aspect-[5/7] flex-col overflow-hidden rounded-[20px] p-4">
                <div className="relative z-10 flex items-start justify-between">
                    <span className="text-center font-display text-4xl leading-[0.85] text-wc-red">
                        {level}
                        <span className="block text-2xl">♥</span>
                    </span>
                    <span className="stamp bg-wc-purple text-white">
                        {t("level", { level })}
                    </span>
                </div>
                <div className="relative z-10 grid flex-1 place-items-center">
                    <div className="rounded-[30%] bg-wc-cream p-1.5 shadow-[0_0_0_2px_var(--ink)]">
                        <Avatar name={name} avatarUrl={avatarUrl} size={112} />
                    </div>
                </div>
                <h1 className="relative z-10 truncate text-center font-display text-3xl leading-tight">
                    {name}
                </h1>
                {memberSince && (
                    <p className="relative z-10 mt-1 text-center text-xs font-bold text-wc-ink-soft">
                        {t("member_since", { date: memberSince })}
                    </p>
                )}
            </div>
        </Tilt>
    );
}
