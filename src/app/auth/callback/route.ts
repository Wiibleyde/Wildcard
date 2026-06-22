import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Constrain redirects to a same-origin path; anything else falls back to locale root (prevents open redirects).
function safeNextPath(raw: string | null): string {
    if (raw?.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\")) {
        return raw;
    }
    return "/fr";
}

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const next = safeNextPath(searchParams.get("next"));

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            return NextResponse.redirect(`${origin}${next}`);
        }
    }

    return NextResponse.redirect(`${origin}/fr`);
}
