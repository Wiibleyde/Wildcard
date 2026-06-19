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
        <div
            className="relative w-20 h-20 rounded-full p-0.75 shrink-0"
            style={{
                background: "linear-gradient(135deg, #f5c516, #e04040)",
                boxShadow: "0 0 20px rgba(245,197,22,0.25)",
            }}
        >
            <div className="relative w-full h-full rounded-full overflow-hidden">
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
                        className="w-full h-full flex items-center justify-center text-3xl font-black"
                        style={{
                            background:
                                "linear-gradient(135deg, #f5c516, #c49010)",
                            color: "#0d0a05",
                        }}
                    >
                        {initial}
                    </div>
                )}
            </div>
        </div>
    );
}
