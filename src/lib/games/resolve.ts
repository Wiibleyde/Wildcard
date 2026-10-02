import type { SupabaseClient } from "@supabase/supabase-js";
import { ecaGameIdFromModuleId, isEcaModuleId } from "@/lib/eca/id";
import { createEcaModule } from "@/lib/eca/module";
import type { EcaState } from "@/lib/eca/types";
import { validateEcaDefinition } from "@/lib/eca/validate";
import { type AnyGameModule, registerGame } from "@/lib/engine/types";
import type { Database } from "@/lib/supabase/types";
import { getGameModule } from "./index";

type Client = SupabaseClient<Database>;

/** From the definition stamped in the state: immune to later edits or deletion of the row. */
export function ecaModuleFromState(
    state: EcaState,
    moduleId: string,
): AnyGameModule {
    return registerGame(createEcaModule(state.definition, moduleId));
}

function buildFromRow(
    definition: unknown,
    moduleId: string,
): AnyGameModule | undefined {
    const validated = validateEcaDefinition(definition);
    if (!validated.ok) return undefined;
    return registerGame(createEcaModule(validated.definition, moduleId));
}

/** Status-agnostic: an existing room survives unpublishing. */
export async function resolveGameModule(
    admin: Client,
    id: string,
): Promise<AnyGameModule | undefined> {
    if (!isEcaModuleId(id)) return getGameModule(id);
    const { data } = await admin
        .from("eca_games")
        .select("definition")
        .eq("id", ecaGameIdFromModuleId(id))
        .maybeSingle();
    if (!data) return undefined;
    return buildFromRow(data.definition, id);
}

/** Published, or a draft its owner is playtesting — checked against the row, never the request. */
export async function resolveLaunchableModule(
    admin: Client,
    id: string,
    requesterId: string,
): Promise<AnyGameModule | undefined> {
    if (!isEcaModuleId(id)) return getGameModule(id);
    const { data } = await admin
        .from("eca_games")
        .select("definition, status, owner_id")
        .eq("id", ecaGameIdFromModuleId(id))
        .maybeSingle();
    if (!data) return undefined;
    if (data.status !== "published" && data.owner_id !== requesterId) {
        return undefined;
    }
    return buildFromRow(data.definition, id);
}

/** Unreadable or non-studio ids are absent from the map; callers fall back. */
export async function ecaNamesByModuleIds(
    client: Client,
    moduleIds: Iterable<string>,
): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    const ecaByRowId = new Map<string, string>();
    for (const id of moduleIds) {
        if (isEcaModuleId(id)) ecaByRowId.set(ecaGameIdFromModuleId(id), id);
    }
    if (ecaByRowId.size === 0) return names;

    const { data } = await client
        .from("eca_games")
        .select("id, name")
        .in("id", [...ecaByRowId.keys()]);
    for (const row of data ?? []) {
        const moduleId = ecaByRowId.get(row.id);
        if (moduleId) names.set(moduleId, row.name);
    }
    return names;
}
