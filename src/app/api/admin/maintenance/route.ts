import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { readJsonObject } from "@/lib/api/body";
import { failureResponse } from "@/lib/api/respond";
import { setMaintenance } from "@/lib/models/settings";
import { createAdminClient } from "@/lib/supabase/admin";

// Admin-only: toggle site maintenance. Pages are locked out by the proxy, mutating API calls by
// requireUser (src/lib/api/auth.ts); this route only flips the flag.
export async function POST(request: Request) {
    const auth = await requireRole("admin");
    if (!auth.ok) return auth.response;

    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;
    const { maintenance, message: rawMessage } = parsed.body;
    if (typeof maintenance !== "boolean") {
        return NextResponse.json(
            { error: "maintenance (boolean) is required" },
            { status: 400 },
        );
    }
    const message =
        typeof rawMessage === "string" && rawMessage.trim() !== ""
            ? rawMessage.trim().slice(0, 280)
            : null;

    const admin = createAdminClient();
    const result = await setMaintenance(
        admin,
        maintenance,
        message,
        auth.user.id,
    );
    if (!result.ok) {
        return failureResponse(
            "admin.maintenance",
            { ok: false, error: "db_error", message: result.error },
            { db_error: 500 },
        );
    }

    return NextResponse.json({ maintenance, message });
}
