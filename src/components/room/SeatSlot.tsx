import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/Avatar";
import type { Slot } from "@/lib/lobby/roster";

/** One seat of the table: a player, a bot, or a dashed empty chair. */
export function SeatSlot({ slot, hostId }: { slot: Slot; hostId: string }) {
    const t = useTranslations("room");

    if (slot === null) {
        return (
            <li className="flex items-center gap-3 rounded-xl border-2 border-dashed border-wc-edge px-3 py-2.5">
                <span
                    aria-hidden="true"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-[28%] border-2 border-dashed border-wc-edge font-display text-wc-sub"
                >
                    ?
                </span>
                <span className="truncate text-sm font-bold text-wc-sub">
                    {t("empty_seat")}
                </span>
            </li>
        );
    }

    return (
        <li className="well flex items-center gap-3 px-3 py-2.5">
            {slot.kind === "human" ? (
                <Avatar name={slot.username} size={36} />
            ) : (
                <span
                    aria-hidden="true"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-[28%] bg-wc-purple text-lg shadow-[inset_0_-3px_0_rgba(0,0,0,0.25)]"
                >
                    🤖
                </span>
            )}
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold">
                    {slot.kind === "human" ? slot.username : slot.label}
                </p>
                {slot.kind === "human" && slot.userId === hostId && (
                    <span className="text-wc-micro font-bold tracking-wc-cap text-wc-gold uppercase">
                        {t("host_badge")}
                    </span>
                )}
            </div>
        </li>
    );
}
