import { getTranslations } from "next-intl/server";
import { Avatar } from "@/components/ui/Avatar";
import { Link } from "@/i18n/navigation";
import { Brand } from "./Brand";
import { NavActions } from "./NavActions";
import { NavLinks } from "./NavLinks";

type Props = {
    username: string;
    avatarUrl: string | null;
    level: number;
    /** 0–1 progress through the current level. */
    levelProgress: number;
    canModerate: boolean;
};

/** Desktop HUD: wordmark, player plate with XP, section buttons. Floats over the room, no backdrop. */
export async function SidebarDesktop({
    username,
    avatarUrl,
    level,
    levelProgress,
    canModerate,
}: Props) {
    const t = await getTranslations("profile");
    return (
        <aside className="fixed top-0 left-0 z-40 hidden h-screen w-55 flex-col gap-4 px-4 py-5 md:flex xl:w-64">
            <div className="flex justify-center pt-1 pb-1">
                <Brand size="md" />
            </div>

            <Link href="/profile" className="wc-me">
                <Avatar name={username} avatarUrl={avatarUrl} size={44} />
                <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-extrabold leading-tight text-wc-cream">
                        {username}
                    </p>
                    <p className="font-pixel text-wc-label text-wc-muted uppercase">
                        {t("level", { level })}
                    </p>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-wc-panel-d2">
                        <div
                            className="h-full rounded-full bg-wc-purple"
                            style={{
                                width: `${Math.round(levelProgress * 100)}%`,
                            }}
                        />
                    </div>
                </div>
            </Link>

            <div className="-mx-1 flex-1 overflow-y-auto px-1 pt-0.5 pb-2">
                <NavLinks variant="sidebar" canModerate={canModerate} />
            </div>

            <NavActions variant="sidebar" />
        </aside>
    );
}
