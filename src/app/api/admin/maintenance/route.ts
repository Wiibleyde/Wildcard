import { NextResponse } from "next/server";
import { failureResponse } from "@/lib/api/respond";
import { apiRoute } from "@/lib/api/route";
import { booleanField } from "@/lib/api/validate";
import { setMaintenance } from "@/lib/models/settings";

const MESSAGE_MAX = 280;

// Only flips the flag: pages are gated by the proxy, mutations by requireUser.
export const POST = apiRoute(
    { role: "admin", body: true },
    async ({ body, user, admin }) => {
        const maintenance = booleanField(body, "maintenance");
        const message =
            typeof body.message === "string" && body.message.trim() !== ""
                ? body.message.trim().slice(0, MESSAGE_MAX)
                : null;

        const result = await setMaintenance(
            admin,
            maintenance,
            message,
            user.id,
        );
        if (!result.ok) {
            return failureResponse("admin.maintenance", result, {
                db_error: 500,
            });
        }
        return NextResponse.json({ maintenance, message });
    },
);
