import { getTranslations, setRequestLocale } from "next-intl/server";
import { GameButton } from "@/components/ui/GameButton";
import { Link } from "@/i18n/navigation";

type GameId = "bataille" | "president" | "kems" | "belote";

type GameEntry = {
    id: GameId;
    name: string;
    suits: string;
    players: string;
    available: boolean;
    accentColor: string;
    shadowColor: string;
};

/** Game names are proper nouns — descriptions live in the dictionaries. */
const GAMES: GameEntry[] = [
    {
        id: "bataille",
        name: "Bataille",
        suits: "♠ ♥",
        players: "2",
        available: true,
        accentColor: "#e04040",
        shadowColor: "#8a1010",
    },
    {
        id: "president",
        name: "Président",
        suits: "♦ ♣",
        players: "3–6",
        available: true,
        accentColor: "#f5c516",
        shadowColor: "#8a6800",
    },
    {
        id: "kems",
        name: "Kems",
        suits: "♥ ♣",
        players: "4",
        available: false,
        accentColor: "#48c97a",
        shadowColor: "#1a6038",
    },
    {
        id: "belote",
        name: "Belote",
        suits: "♠ ♦",
        players: "4",
        available: false,
        accentColor: "#a78bfa",
        shadowColor: "#4a2a90",
    },
];

const GAME_DESC_KEY = {
    bataille: "game_desc_bataille",
    president: "game_desc_president",
    kems: "game_desc_kems",
    belote: "game_desc_belote",
} as const;

export default async function Home({
    params,
}: {
    params: Promise<{ lang: string }>;
}) {
    const { lang } = await params;
    setRequestLocale(lang);
    const t = await getTranslations("navigation");
    const tHome = await getTranslations("home");

    return (
        <div
            className="min-h-screen px-4 xl:px-10 pt-8 md:pt-12 pb-16"
            style={{ background: "#0d0a05" }}
        >
            <div className="max-w-lg lg:max-w-5xl xl:max-w-7xl mx-auto flex flex-col gap-10">
                {/* ── Hero ──────────────────────────────────────────────────── */}
                <div
                    className="relative rounded-2xl overflow-hidden px-8 py-12 xl:py-16 flex flex-col items-center text-center"
                    style={{
                        background:
                            "linear-gradient(160deg, #1e1408 0%, #0d0a05 60%)",
                        border: "2px solid #3d2d18",
                        boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
                    }}
                >
                    {/* Decorative suits */}
                    <span
                        className="absolute font-black leading-none select-none pointer-events-none"
                        style={{
                            fontSize: "14rem",
                            opacity: 0.04,
                            color: "#f0e8d4",
                            top: "-2rem",
                            left: "-2rem",
                            transform: "rotate(-10deg)",
                        }}
                        aria-hidden="true"
                    >
                        ♠
                    </span>
                    <span
                        className="absolute font-black leading-none select-none pointer-events-none"
                        style={{
                            fontSize: "14rem",
                            opacity: 0.04,
                            color: "#e04040",
                            bottom: "-2rem",
                            right: "-2rem",
                            transform: "rotate(10deg)",
                        }}
                        aria-hidden="true"
                    >
                        ♥
                    </span>

                    <div className="relative z-10 flex flex-col items-center gap-6">
                        <div
                            className="w-20 h-20 rounded-2xl flex items-center justify-center font-black text-4xl"
                            style={{
                                background:
                                    "linear-gradient(135deg, #f5c516, #c49010)",
                                color: "#0d0a05",
                                boxShadow:
                                    "0 0 48px rgba(245,197,22,0.3), 0 6px 0 0 #7a5a00",
                            }}
                        >
                            W
                        </div>

                        <div>
                            <h1
                                className="text-5xl xl:text-6xl font-black tracking-tight"
                                style={{ color: "#faf2e2" }}
                            >
                                Wildcard
                            </h1>
                            <p
                                className="mt-2 text-lg font-semibold"
                                style={{ color: "#9a8870" }}
                            >
                                {tHome("subtitle")}
                            </p>
                        </div>

                        <GameButton href="/lobby" variant="green" size="lg">
                            <span style={{ fontSize: "1.1em" }}>♠</span>
                            {t("play")}
                            <span style={{ fontSize: "1.1em" }}>♥</span>
                        </GameButton>
                    </div>
                </div>

                {/* ── Game grid ─────────────────────────────────────────────── */}
                <div>
                    <h2
                        className="text-xs font-bold uppercase tracking-widest mb-5"
                        style={{ color: "#7a6a50" }}
                    >
                        {tHome("games_section")}
                    </h2>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {GAMES.map((game) => (
                            <div
                                key={game.id}
                                className="relative rounded-xl overflow-hidden flex flex-col"
                                style={{
                                    background: "#1c1510",
                                    border: `2px solid ${game.available ? `${game.accentColor}55` : "#3d2d18"}`,
                                    boxShadow: game.available
                                        ? `0 0 20px ${game.accentColor}18`
                                        : undefined,
                                }}
                            >
                                {/* Card header */}
                                <div
                                    className="flex items-center justify-between px-4 pt-5 pb-4"
                                    style={{
                                        borderBottom: `1px solid ${game.available ? `${game.accentColor}30` : "#3d2d18"}`,
                                    }}
                                >
                                    <span
                                        className="text-2xl font-black leading-none"
                                        style={{
                                            color: game.available
                                                ? game.accentColor
                                                : "#4a3820",
                                        }}
                                    >
                                        {game.suits}
                                    </span>
                                    <span
                                        className="text-xs font-bold px-2 py-0.5 rounded-full"
                                        style={
                                            game.available
                                                ? {
                                                      background: `${game.accentColor}18`,
                                                      color: game.accentColor,
                                                      border: `1px solid ${game.accentColor}40`,
                                                  }
                                                : {
                                                      background:
                                                          "rgba(255,255,255,0.04)",
                                                      color: "#7a6a50",
                                                      border: "1px solid #3d2d18",
                                                  }
                                        }
                                    >
                                        {game.available
                                            ? tHome("available")
                                            : tHome("coming_soon")}
                                    </span>
                                </div>

                                <div className="flex-1 p-4 flex flex-col gap-3">
                                    <div>
                                        <h3
                                            className="font-black text-lg leading-tight"
                                            style={{
                                                color: game.available
                                                    ? "#faf2e2"
                                                    : "#6a5a40",
                                            }}
                                        >
                                            {game.name}
                                        </h3>
                                        <p
                                            className="text-xs font-semibold mt-0.5 leading-snug"
                                            style={{ color: "#7a6a50" }}
                                        >
                                            {tHome(GAME_DESC_KEY[game.id])}
                                        </p>
                                    </div>

                                    <div
                                        className="text-xs font-bold"
                                        style={{ color: "#9a8870" }}
                                    >
                                        {tHome("players_count", {
                                            count: game.players,
                                        })}
                                    </div>

                                    {game.available ? (
                                        <Link
                                            href="/lobby"
                                            className="mt-auto flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm"
                                            style={{
                                                background: game.accentColor,
                                                color: "#0d0a05",
                                                boxShadow: `0 3px 0 0 ${game.shadowColor}`,
                                                transition:
                                                    "transform 80ms ease, box-shadow 80ms ease",
                                            }}
                                        >
                                            {tHome("play_now")}
                                        </Link>
                                    ) : (
                                        <div
                                            className="mt-auto py-2.5 rounded-lg font-bold text-sm text-center"
                                            style={{
                                                background:
                                                    "rgba(255,255,255,0.03)",
                                                color: "#4a3820",
                                                border: "1px solid #3d2d18",
                                            }}
                                        >
                                            {tHome("in_development")}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
