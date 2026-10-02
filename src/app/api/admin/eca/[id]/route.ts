import { NextResponse } from "next/server";
import { failureResponse } from "@/lib/api/respond";
import { apiRoute } from "@/lib/api/route";
import { oneOfField } from "@/lib/api/validate";
import {
    adminDeleteEcaGame,
    adminSetEcaStatus,
} from "@/lib/models/adminStudio";
import { STUDIO_ERROR_STATUS } from "@/lib/models/studio";

// Cross-owner moderation: admin-only (moderators get the read-only dashboard).
export const PATCH = apiRoute<{ id: string }>(
    { role: "admin", body: true },
    async ({ params, body, admin }) => {
        const status = oneOfField(body, "status", ["draft", "published"]);
        const result = await adminSetEcaStatus(admin, params.id, status);
        if (!result.ok) {
            return failureResponse(
                "admin.eca.status",
                result,
                STUDIO_ERROR_STATUS,
                result.details && { details: result.details },
            );
        }
        return NextResponse.json({ ok: true });
    },
);

export const DELETE = apiRoute<{ id: string }>(
    { role: "admin" },
    async ({ params, admin }) => {
        const result = await adminDeleteEcaGame(admin, params.id);
        if (!result.ok) {
            return failureResponse(
                "admin.eca.delete",
                result,
                STUDIO_ERROR_STATUS,
            );
        }
        return NextResponse.json({ ok: true });
    },
);
