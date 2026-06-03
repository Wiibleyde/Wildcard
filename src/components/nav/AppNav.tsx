import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { NavActions } from "./NavActions";
import { NavLinks } from "./NavLinks";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type PlayerXP = Database["public"]["Tables"]["player_xp"]["Row"];

function CoinIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-3.5 h-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v10M9 9.5a3 1.5 0 0 1 3-1.5M9 14.5a3 1.5 0 0 0 3 1.5" />
    </svg>
  );
}

function xpLevel(xp: number) {
  return Math.floor(xp / 500) + 1;
}

export async function AppNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profileRes, xpRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("player_xp").select("xp").eq("user_id", user.id).single(),
  ]);

  const t = await getTranslations("navigation");
  const tProfile = await getTranslations("profile");

  const profile = profileRes.data as Profile | null;
  const xpRow = xpRes.data as Pick<PlayerXP, "xp"> | null;
  const xp = xpRow?.xp ?? 0;
  const level = xpLevel(xp);

  const avatarUrl = profile?.avatar_url
    ? supabase.storage.from("avatars").getPublicUrl(profile.avatar_url).data
        .publicUrl
    : null;

  const initial = profile?.username?.[0]?.toUpperCase() ?? "?";

  return (
    <>
      {/* ── Desktop sidebar ──────────────────────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col fixed top-0 left-0 h-screen w-55 xl:w-64 z-40"
        style={{
          background: "#0c1018",
          borderRight: "1px solid #1c2230",
          padding: "20px 14px 16px",
        }}
      >
        {/* logo */}
        <Link href="/" className="flex items-center gap-2.5 px-1 mb-1 shrink-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0"
            style={{
              background: "linear-gradient(135deg, #e8c468, #c49b32)",
              color: "#15110a",
            }}
          >
            W
          </div>
          <span className="text-wc-text font-extrabold text-base tracking-tight">
            Wildcard
          </span>
        </Link>

        <NavLinks variant="sidebar" />

        {/* bottom: coins + user card */}
        <div className="mt-auto flex flex-col gap-3">
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <CoinIcon />
            <span style={{ color: "#e8c468" }}>0</span>
            <span className="text-wc-sub ml-1">{t("coins")}</span>
          </div>

          <NavActions variant="sidebar" />

          <Link
            href="/profile"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-white/5"
          >
            <div className="relative w-9 h-9 rounded-full overflow-hidden shrink-0">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={profile?.username ?? ""}
                  fill
                  sizes="36px"
                  className="object-cover"
                  loading="eager"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-sm font-black"
                  style={{
                    background: "linear-gradient(135deg, #e8c468, #c49b32)",
                    color: "#15110a",
                  }}
                >
                  {initial}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-wc-heading truncate leading-none">
                {profile?.username ?? "—"}
              </p>
              <p className="text-xs text-wc-sub font-semibold mt-0.5">
                {tProfile("level_short")} {level}
              </p>
            </div>
          </Link>
        </div>
      </aside>

      {/* ── Mobile top bar ───────────────────────────────────────────────── */}
      <header
        className="md:hidden flex items-center justify-between px-4 h-14 sticky top-0 z-40"
        style={{ background: "#0c1018", borderBottom: "1px solid #1c2230" }}
      >
        <Link href="/" className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0"
            style={{
              background: "linear-gradient(135deg, #e8c468, #c49b32)",
              color: "#15110a",
            }}
          >
            W
          </div>
          <span className="text-wc-text font-extrabold text-sm tracking-tight">
            Wildcard
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <NavActions variant="mobile-header" />
          <Link
            href="/profile"
            className="relative w-8 h-8 rounded-full overflow-hidden"
          >
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={profile?.username ?? ""}
                fill
                sizes="32px"
                className="object-cover"
                loading="eager"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-xs font-black"
                style={{
                  background: "linear-gradient(135deg, #e8c468, #c49b32)",
                  color: "#15110a",
                }}
              >
                {initial}
              </div>
            )}
          </Link>
        </div>
      </header>

      {/* ── Mobile bottom nav ────────────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center"
        style={{
          background: "#0c1018",
          borderTop: "1px solid #1c2230",
          height: "60px",
        }}
      >
        <NavLinks variant="bottom" />
      </nav>
    </>
  );
}
