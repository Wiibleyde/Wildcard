import { NextResponse } from "next/server";
import { failureResponse } from "@/lib/api/respond";
import { apiRoute } from "@/lib/api/route";
import {
    CUSTOMIZATION_ERROR_STATUS,
    parseCustomizationPatch,
    patchCustomization,
} from "@/lib/models/customization";

// RLS client on purpose: the ownership policy is the final authority.
export const PATCH = apiRoute(
    { body: true },
    async ({ body, user, supabase }) => {
        const patch = parseCustomizationPatch(body);
        if (!patch) {
            return NextResponse.json(
                { error: "invalid_body" },
                { status: 400 },
            );
        }
        const result = await patchCustomization(supabase, user.id, patch);
        if (!result.ok) {
            return failureResponse(
                "customization.patch",
                result,
                CUSTOMIZATION_ERROR_STATUS,
            );
        }
        return NextResponse.json({ ok: true });
    },
);
