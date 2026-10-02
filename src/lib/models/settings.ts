import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type AppSettings = {
    maintenance: boolean;
    maintenanceMessage: string | null;
};

const DEFAULTS: AppSettings = { maintenance: false, maintenanceMessage: null };

/** Fails open: a settings read blip must never lock the whole site. */
export async function getAppSettings(
    client: SupabaseClient<Database>,
): Promise<AppSettings> {
    const { data, error } = await client
        .from("app_settings")
        .select("maintenance, maintenance_message")
        .eq("id", true)
        .maybeSingle();
    if (error) console.error("[settings] read failed:", error.message);
    if (!data) return DEFAULTS;
    return {
        maintenance: data.maintenance,
        maintenanceMessage: data.maintenance_message,
    };
}

/** Service-role only; the caller must have checked the admin role. */
export async function setMaintenance(
    admin: SupabaseClient<Database>,
    maintenance: boolean,
    message: string | null,
    byUserId: string,
): Promise<{ ok: true } | { ok: false; error: "db_error"; message: string }> {
    const { error } = await admin
        .from("app_settings")
        .update({
            maintenance,
            maintenance_message: message,
            updated_at: new Date().toISOString(),
            updated_by: byUserId,
        })
        .eq("id", true);
    if (error) return { ok: false, error: "db_error", message: error.message };
    return { ok: true };
}
