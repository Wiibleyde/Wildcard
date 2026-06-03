import { type TierKey, tierColor, tierTextColor } from "@/lib/customize/tier";

type Props = {
    tier: string;
    name: string;
};

export function TierBadge({ tier, name }: Props) {
    const key = tier as TierKey;
    return (
        <span
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ background: tierColor(key), color: tierTextColor(key) }}
        >
            {name}
        </span>
    );
}
