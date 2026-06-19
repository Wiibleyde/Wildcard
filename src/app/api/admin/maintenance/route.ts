import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { setMaintenance } from "@/lib/models/settings";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Admin-only: toggle site maintenance. The proxy enforces the lock-out; this
 * route only flips the flag (and an optional message shown on the maintenance
 * page). Writes go through the service role, after the role check.
 */
export async function POST(request: Request) {
    const auth = await requireRole("admin");
    if (!auth.ok) return auth.response;

    const body = (await request.json().catch(() => ({}))) as {
        maintenance?: unknown;
        message?: unknown;
    };
    if (typeof body.maintenance !== "boolean") {
        return NextResponse.json(
            { error: "maintenance (boolean) is required" },
            { status: 400 },
        );
    }
    const message =
        typeof body.message === "string" && body.message.trim() !== ""
            ? body.message.trim().slice(0, 280)
            : null;

    const admin = createAdminClient();
    const result = await setMaintenance(
        admin,
        body.maintenance,
        message,
        auth.user.id,
    );
    if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ maintenance: body.maintenance, message });
}
