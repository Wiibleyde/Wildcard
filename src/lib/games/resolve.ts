import type { SupabaseClient } from "@supabase/supabase-js";
import { ecaGameIdFromModuleId, isEcaModuleId } from "@/lib/eca/id";
import { createEcaModule } from "@/lib/eca/module";
import type { EcaState } from "@/lib/eca/types";
import { validateEcaDefinition } from "@/lib/eca/validate";
import { type AnyGameModule, registerGame } from "@/lib/engine/types";
import type { Database } from "@/lib/supabase/types";
import { getGameModule } from "./index";

/**
 * Module resolution across BOTH kinds of game — native TypeScript modules and
 * creator-authored ECA (studio) games — behind one boundary.
 *
 * Native games live in the static registry ({@link getGameModule}); studio
 * games live in the `eca_games` table as a JSON {@link EcaDefinition} and are
 * built into a {@link GameModule} on demand with {@link createEcaModule}. The
 * `eca:` prefix on the module id ({@link isEcaModuleId}) is the fork.
 *
 * Two resolution strategies, chosen by what the caller already holds:
 *  - **from state** ({@link ecaModuleFromState}) — a game already has its
 *    definition STAMPED into its persisted state (président's rules pattern), so
 *    loading/replaying a running game rebuilds its module with ZERO extra reads.
 *  - **from the database** ({@link resolveGameModule}) — lobby operations act
 *    before any state exists, so they fetch the definition. This is the only
 *    path that costs a round-trip, and only for studio games.
 */

type Client = SupabaseClient<Database>;

/**
 * Rebuild an ECA module from a running game's stamped state — no database
 * round-trip. `apply`/`legalActions`/`view`/`isOver`/`outcome` all read the
 * definition back out of `state.definition`, so the module reconstructed here is
 * behaviourally identical to the one the game was dealt with, even if the stored
 * `eca_games` row was since edited, unpublished, or deleted. This is what keeps
 * a game that is mid-flight loadable and replayable forever.
 */
export function ecaModuleFromState(
    state: EcaState,
    moduleId: string,
): AnyGameModule {
    return registerGame(createEcaModule(state.definition, moduleId));
}

/** Build (and validate) an ECA module from a stored definition row. */
function buildFromRow(
    definition: unknown,
    moduleId: string,
): AnyGameModule | undefined {
    const validated = validateEcaDefinition(definition);
    if (!validated.ok) return undefined;
    return registerGame(createEcaModule(validated.definition, moduleId));
}

/**
 * Resolve a module by id, status-agnostic: native from the static registry,
 * studio from its `eca_games` row regardless of draft/published status.
 *
 * Used by operations on a room that ALREADY exists (join, seat, deal, and any
 * load of a game whose row we don't hold). A studio game stays resolvable here
 * even after it is unpublished, so a room already created for it keeps working —
 * new-room gating lives in {@link resolveLaunchableModule}, not here.
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
 * Resolve a module that is allowed to start a NEW room. Native games always
 * qualify; a studio game qualifies only when it is published OR the requester
 * is its owner — so a creator can host their own unfinished draft to playtest
 * with friends, while strangers can only launch what has been published.
 *
 * Ownership/status are read from the authoritative row (never trusted from the
 * request), mirroring the studio model's own checks.
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
 * Batch-resolve display names for a set of module ids. Native names come from
 * the static registry (no I/O); studio names are fetched in a single `IN` query
 * against `eca_games`. Only ids missing from the registry AND present in the
 * table land in the map — callers fall back to the raw id otherwise. Rows the
 * client cannot read (an RLS client, an unpublished game) simply fall back too.
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
