import { describe, expect, it } from "vitest";
import fr from "@/dictionaries/fr.json";
import { apiErrorKey } from "./errorKeys";

describe("apiErrorKey", () => {
    it("maps server codes, aliases included", () => {
        expect(apiErrorKey("room_full")).toBe("room_full");
        expect(apiErrorKey("token_expired")).toBe("unauthorized");
        expect(apiErrorKey("invalid_json")).toBe("invalid_input");
        expect(apiErrorKey("db_error")).toBe("server");
    });

    it("falls back to generic for unknown or missing codes", () => {
        expect(apiErrorKey("nope")).toBe("generic");
        expect(apiErrorKey("toString")).toBe("generic");
        expect(apiErrorKey(null)).toBe("generic");
        expect(apiErrorKey(42)).toBe("generic");
    });

    it("only yields keys present in the errors namespace", () => {
        const codes = [
            "unauthorized",
            "forbidden",
            "not_found",
            "unknown_game",
            "room_full",
            "already_started",
            "not_host",
            "not_enough_players",
            "invalid_input",
            "version_conflict",
            "deal_failed",
            "rate_limited",
            "maintenance",
            "payload_too_large",
            "db_error",
            "unmapped",
        ];
        for (const code of codes) {
            expect(Object.keys(fr.errors)).toContain(apiErrorKey(code));
        }
    });
});
