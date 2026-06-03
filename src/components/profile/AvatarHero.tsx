import Image from "next/image";
import type { Database } from "@/lib/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type Props = {
    profile: Profile;
    avatarUrl: string | null;
};

export function AvatarHero({ profile, avatarUrl }: Props) {
    const initial = profile.username?.[0]?.toUpperCase() ?? "?";
    return (
        <div className="relative w-20 h-20 rounded-full overflow-hidden shrink-0">
            {avatarUrl ? (
                <Image
                    src={avatarUrl}
                    alt={profile.username}
                    fill
                    sizes="80px"
                    className="object-cover"
                    loading="eager"
                />
            ) : (
                <div
                    className="w-full h-full flex items-center justify-center text-3xl font-black"
                    style={{
                        background: "linear-gradient(135deg, #e8c468, #c49b32)",
                        color: "#15110a",
                    }}
                >
                    {initial}
                </div>
            )}
        </div>
    );
}
