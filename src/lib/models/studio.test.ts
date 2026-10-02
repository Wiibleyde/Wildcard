import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { MINIMAL_VALID } from "@/lib/eca/fixtures";
import type { Database } from "@/lib/supabase/types";
import { adminSetEcaStatus } from "./adminStudio";
import { deleteEcaGame, getEcaGame, updateEcaGame } from "./studio";

vi.mock("@/lib/supabase/storage", () => ({
    ecaImagesBucket: () => "test-eca-images",
    publicStorageUrl: (bucket: string, path: string) => `${bucket}/${path}`,
}));

const OWNER = "11111111-2222-4333-8444-555555555555";
const OTHER = "99999999-2222-4333-8444-555555555555";
const GAME = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

type Row = Record<string, unknown>;

interface Call {
    readonly op: "select" | "update" | "delete";
    readonly payload?: Row;
    readonly filters: Array<[string, unknown]>;
}

/** Chainable query-builder stand-in: reads answer `row`, writes are recorded and answer `writeError`. */
function fakeClient(row: Row | null, writeError: Row | null = null) {
    const calls: Call[] = [];
    const removed: string[][] = [];
    const client = {
        from() {
            const call: {
                op: Call["op"];
                payload?: Row;
                filters: Call["filters"];
            } = {
                op: "select",
                filters: [],
            };
            calls.push(call);
            const builder = {
                select() {
                    return builder;
                },
                update(payload: Row) {
                    call.op = "update";
                    call.payload = payload;
                    return builder;
                },
                delete() {
                    call.op = "delete";
                    return builder;
                },
                eq(column: string, value: unknown) {
                    call.filters.push([column, value]);
                    return builder;
                },
                maybeSingle() {
                    return Promise.resolve({ data: row, error: null });
                },
                // biome-ignore lint/suspicious/noThenProperty: awaitable builder, like supabase-js
                then(resolve: (value: { error: Row | null }) => void) {
                    resolve({ error: writeError });
                },
            };
            return builder;
        },
        storage: {
            from() {
                return {
                    remove(paths: string[]) {
                        removed.push(paths);
                        return Promise.resolve({ data: [], error: null });
                    },
                };
            },
        },
    };
    return {
        admin: client as unknown as SupabaseClient<Database>,
        calls,
        removed,
    };
}

const storedRow = (patch: Row = {}): Row => ({
    owner_id: OWNER,
    name: MINIMAL_VALID.meta.name,
    description: null,
    definition: MINIMAL_VALID,
    status: "draft",
    image_url: null,
    moderation_locked: false,
    ...patch,
});

describe("studio model — id validation", () => {
    it("answers not_found for malformed ids without querying", async () => {
        const { admin, calls } = fakeClient(storedRow());
        expect(await getEcaGame(admin, "nope", OWNER)).toEqual({
            ok: false,
            error: "not_found",
        });
        expect(await updateEcaGame(admin, "nope", OWNER, {})).toEqual({
            ok: false,
            error: "not_found",
        });
        expect(await deleteEcaGame(admin, "1 or 1=1", OWNER)).toEqual({
            ok: false,
            error: "not_found",
        });
        expect(calls).toHaveLength(0);
    });
});

describe("studio model — names", () => {
    it("stores trimmed names and refuses blank ones", async () => {
        const { admin, calls } = fakeClient(storedRow());
        expect(
            await updateEcaGame(admin, GAME, OWNER, { name: "   " }),
        ).toEqual({ ok: false, error: "invalid_input" });
        expect(
            await updateEcaGame(admin, GAME, OWNER, { name: "  Mon jeu " }),
        ).toEqual({ ok: true });
        expect(calls.find((c) => c.op === "update")?.payload).toMatchObject({
            name: "Mon jeu",
        });
    });
});

describe("studio model — moderation lock", () => {
    it("refuses the owner's publish while locked", async () => {
        const { admin, calls } = fakeClient(
            storedRow({ moderation_locked: true }),
        );
        const result = await updateEcaGame(admin, GAME, OWNER, {
            status: "published",
        });
        expect(result).toEqual({ ok: false, error: "moderation_locked" });
        expect(calls.some((c) => c.op === "update")).toBe(false);
    });

    it("still lets the owner edit a locked draft", async () => {
        const { admin, calls } = fakeClient(
            storedRow({ moderation_locked: true }),
        );
        const result = await updateEcaGame(admin, GAME, OWNER, {
            name: "Fixed name",
        });
        expect(result).toEqual({ ok: true });
        expect(calls.find((c) => c.op === "update")?.payload).toMatchObject({
            name: "Fixed name",
        });
    });

    it("maps a lock CHECK violation on publish to moderation_locked", async () => {
        // The admin took the game down between the read and the write.
        const { admin } = fakeClient(storedRow(), {
            code: "23514",
            message: "eca_games_locked_not_published",
        });
        expect(
            await updateEcaGame(admin, GAME, OWNER, { status: "published" }),
        ).toEqual({ ok: false, error: "moderation_locked" });
    });

    it("admin unpublish locks, admin publish restores", async () => {
        const down = fakeClient(storedRow({ status: "published" }));
        expect(await adminSetEcaStatus(down.admin, GAME, "draft")).toEqual({
            ok: true,
        });
        expect(
            down.calls.find((c) => c.op === "update")?.payload,
        ).toMatchObject({ status: "draft", moderation_locked: true });

        const up = fakeClient(storedRow({ moderation_locked: true }));
        expect(await adminSetEcaStatus(up.admin, GAME, "published")).toEqual({
            ok: true,
        });
        expect(up.calls.find((c) => c.op === "update")?.payload).toMatchObject({
            status: "published",
            moderation_locked: false,
        });
    });
});

describe("studio model — ownership on the write", () => {
    it("scopes the update and the delete to the owner", async () => {
        const upd = fakeClient(storedRow());
        await updateEcaGame(upd.admin, GAME, OWNER, { name: "x" });
        expect(upd.calls.find((c) => c.op === "update")?.filters).toEqual([
            ["id", GAME],
            ["owner_id", OWNER],
        ]);

        const del = fakeClient(storedRow());
        await deleteEcaGame(del.admin, GAME, OWNER);
        expect(del.calls.find((c) => c.op === "delete")?.filters).toEqual([
            ["id", GAME],
            ["owner_id", OWNER],
        ]);
    });

    it("answers not_found on a foreign game and writes nothing", async () => {
        const { admin, calls } = fakeClient(storedRow({ owner_id: OTHER }));
        expect(await updateEcaGame(admin, GAME, OWNER, { name: "x" })).toEqual({
            ok: false,
            error: "not_found",
        });
        expect(calls.some((c) => c.op !== "select")).toBe(false);
    });
});

describe("studio model — cover image path", () => {
    it("accepts only the exact <owner>/<game>.<ext> path", async () => {
        for (const bad of [
            `${OWNER}/../victim/x.png`,
            `${OWNER}/other.png`,
            `${OWNER}/${GAME}.svg`,
            `${OTHER}/${GAME}.png`,
        ]) {
            const { admin } = fakeClient(storedRow());
            expect(
                await updateEcaGame(admin, GAME, OWNER, { image_url: bad }),
            ).toEqual({ ok: false, error: "invalid_input" });
        }
        const { admin } = fakeClient(storedRow());
        expect(
            await updateEcaGame(admin, GAME, OWNER, {
                image_url: `${OWNER}/${GAME}.png`,
            }),
        ).toEqual({ ok: true });
    });

    it("removes the previous object when the extension changes", async () => {
        const { admin, removed } = fakeClient(
            storedRow({ image_url: `${OWNER}/${GAME}.png` }),
        );
        await updateEcaGame(admin, GAME, OWNER, {
            image_url: `${OWNER}/${GAME}.webp`,
        });
        expect(removed).toEqual([[`${OWNER}/${GAME}.png`]]);
    });

    it("keeps the object on a same-path re-upload", async () => {
        const { admin, removed } = fakeClient(
            storedRow({ image_url: `${OWNER}/${GAME}.png` }),
        );
        await updateEcaGame(admin, GAME, OWNER, {
            image_url: `${OWNER}/${GAME}.png`,
        });
        expect(removed).toEqual([]);
    });

    it("removes the cover on delete, never a legacy foreign path", async () => {
        const own = fakeClient(
            storedRow({ image_url: `${OWNER}/${GAME}.gif` }),
        );
        await deleteEcaGame(own.admin, GAME, OWNER);
        expect(own.removed).toEqual([[`${OWNER}/${GAME}.gif`]]);

        const legacy = fakeClient(
            storedRow({ image_url: `${OWNER}/../victim/x.png` }),
        );
        await deleteEcaGame(legacy.admin, GAME, OWNER);
        expect(legacy.removed).toEqual([]);
    });
});

describe("studio model — write-time lints", () => {
    it("refuses to save a definition the write validator rejects", async () => {
        const { admin } = fakeClient(storedRow());
        const result = await updateEcaGame(admin, GAME, OWNER, {
            definition: {
                ...MINIMAL_VALID,
                rules: [{ ...MINIMAL_VALID.rules[0], id: "x".repeat(65) }],
            },
        });
        expect(result).toMatchObject({
            ok: false,
            error: "invalid_definition",
        });
    });
});
