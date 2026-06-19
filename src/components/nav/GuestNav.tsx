import { getTranslations } from "next-intl/server";
import { GameButton } from "@/components/ui/GameButton";
import { Link } from "@/i18n/navigation";

/**
 * Top bar shown to signed-out visitors. The authenticated chrome ({@link AppNav}
 * — sidebar + bottom nav) needs a profile/role, so it renders nothing when there
 * is no user; without this bar the layout reserved an empty sidebar gap and gave
 * guests no way in. Auth is OAuth-only, so login and register are one flow → a
 * single CTA to `/login`.
 */
export async function GuestNav() {
    const t = await getTranslations("navigation");

    return (
        <header
            className="sticky top-0 z-40"
            style={{ background: "#0f0b07", borderBottom: "2px solid #3d2d18" }}
        >
            <div className="flex items-center justify-between px-4 xl:px-10 h-14">
                <Link href="/" className="flex items-center gap-2.5">
                    <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black shrink-0"
                        style={{
                            background:
                                "linear-gradient(135deg, #f5c516, #c49010)",
                            color: "#0d0a05",
                            boxShadow: "0 0 12px rgba(245,197,22,0.25)",
                        }}
                    >
                        W
                    </div>
                    <div>
                        <p
                            className="font-black text-sm leading-none tracking-tight"
                            style={{ color: "#faf2e2" }}
                        >
                            Wildcard
                        </p>
                        <p
                            className="text-[9px] font-bold tracking-[0.2em] uppercase"
                            style={{ color: "#7a6a50" }}
                        >
                            ♠ ♥ ♦ ♣
                        </p>
                    </div>
                </Link>

                <GameButton href="/login" variant="green" size="sm">
                    <span style={{ fontSize: "1.1em" }}>♠</span>
                    {t("login")}
                </GameButton>
            </div>
        </header>
    );
}
