import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type AppSettings = {
    maintenance: boolean;
    maintenanceMessage: string | null;
};

const DEFAULTS: AppSettings = { maintenance: false, maintenanceMessage: null };

/**
 * Read the singleton `app_settings` row. Falls back to "not in maintenance"
 * when the row is missing or unreadable — a transient settings read failure
 * must never lock the whole site (fail open for availability; the privileged
 * write path is separately guarded).
 */
export async function getAppSettings(
    client: SupabaseClient<Database>,
): Promise<AppSettings> {
    const { data } = await client
        .from("app_settings")
        .select("maintenance, maintenance_message")
        .eq("id", true)
        .maybeSingle();
    if (!data) return DEFAULTS;
    return {
        maintenance: data.maintenance,
        maintenanceMessage: data.maintenance_message,
    };
}

/**
 * Toggle maintenance mode. Service-role only (callers must gate on an admin
 * role first — see `requireRole`). `message` is shown on the maintenance page;
 * `null` clears it.
 */
export async function setMaintenance(
    admin: SupabaseClient<Database>,
    maintenance: boolean,
    message: string | null,
    byUserId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
    const { error } = await admin
        .from("app_settings")
        .update({
            maintenance,
            maintenance_message: message,
            updated_at: new Date().toISOString(),
            updated_by: byUserId,
        })
        .eq("id", true);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
}
