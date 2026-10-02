import type { SupabaseClient } from "@supabase/supabase-js";
import { ecaGameIdFromModuleId, isEcaModuleId } from "@/lib/eca/id";
import { createEcaModule } from "@/lib/eca/module";
import type { EcaState } from "@/lib/eca/types";
import { validateEcaDefinition } from "@/lib/eca/validate";
import { type AnyGameModule, registerGame } from "@/lib/engine/types";
import type { Database } from "@/lib/supabase/types";
import { getGameModule } from "./index";

/*
 * Module resolution for native modules (static registry) and studio games
 * (`eca:` ids, a JSON definition in `eca_games`). A running game rebuilds its
 * studio module from the definition stamped in its state — no read; only
 * lobby operations, which act before any state exists, hit the database.
 */

type Client = SupabaseClient<Database>;

/**
 * No database round-trip, and immune to later edits or deletion of the
 * `eca_games` row — what keeps a mid-flight game loadable and replayable.
 */
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

/**
 * Status-agnostic: a room that already exists keeps working after its studio
 * game is unpublished. New-room gating is {@link resolveLaunchableModule}.
 */
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

/**
 * A studio game may start a new room when published, or when the requester
 * owns it (playtesting a draft). Status and owner come from the row, never
 * from the request.
 */
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

/**
 * Studio game names in one `IN` query. Ids that are not studio games, or
 * rows the client cannot read, are simply absent — callers fall back.
 */
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
