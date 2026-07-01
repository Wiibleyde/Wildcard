import Image from "next/image";
import type { Database } from "@/lib/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type Props = {
    profile: Profile;
    avatarUrl: string | null;
};

// Neobrutalism hero avatar — flat disc, thick ink ring, chunky Lilita initial.
export function AvatarHero({ profile, avatarUrl }: Props) {
    const initial = profile.username?.[0]?.toUpperCase() ?? "?";
    return (
        <div
            className="relative w-20 h-20 shrink-0 overflow-hidden rounded-full"
            style={{
                border: "2.5px solid var(--ink)",
                boxShadow: "0 4px 0 var(--ink)",
            }}
        >
            {avatarUrl ? (
                <Image
                    src={avatarUrl}
                    alt={profile.username}
                    fill
                    sizes="80px"
                    className="object-cover"
                    loading="eager"
                    unoptimized
                />
            ) : (
                <div
                    className="w-full h-full flex items-center justify-center font-display text-3xl"
                    style={{
                        background: "var(--gold)",
                        color: "var(--ink)",
                    }}
                >
                    {initial}
                </div>
            )}
        </div>
    );
}
