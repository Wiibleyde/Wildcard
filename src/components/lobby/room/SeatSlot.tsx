import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/Avatar";
import type { Slot } from "@/lib/lobby/roster";

const DASHED = "2.5px dashed rgba(147,168,200,0.4)";

export function SeatSlot({ slot, hostId }: { slot: Slot; hostId: string }) {
    const t = useTranslations("room");
    const filled = slot !== null;

    return (
        <li
            className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{
                background: filled ? "var(--panel-d)" : "transparent",
                border: filled ? "2.5px solid var(--ink)" : DASHED,
                boxShadow: filled ? "0 4px 0 var(--ink)" : undefined,
            }}
        >
            {slot?.kind === "human" ? (
                <Avatar name={slot.username} size={36} />
            ) : (
                <div
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display"
                    style={
                        slot?.kind === "bot"
                            ? {
                                  background: "var(--purple)",
                                  border: "2.5px solid var(--ink)",
                              }
                            : { border: DASHED, color: "var(--muted)" }
                    }
                >
                    {slot?.kind === "bot" ? "🤖" : "?"}
                </div>
            )}
            <div className="min-w-0 flex-1">
                <div
                    className="truncate font-display text-sm"
                    style={{ color: filled ? "var(--cream)" : "var(--muted)" }}
                >
                    {slot?.kind === "human"
                        ? slot.username
                        : slot?.kind === "bot"
                          ? slot.label
                          : t("empty_seat")}
                </div>
                {slot?.kind === "human" && slot.userId === hostId && (
                    <span className="font-pixel text-wc-micro text-wc-gold uppercase">
                        {t("host_badge")}
                    </span>
                )}
            </div>
        </li>
    );
}
