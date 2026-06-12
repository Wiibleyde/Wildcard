import { describe, expect, it } from "vitest";
import { creatorTheme, freeTheme, getCardTheme, THEMES } from ".";

describe("getCardTheme", () => {
    it("resolves a registered deck style id", () => {
        expect(getCardTheme("creator")).toBe(creatorTheme);
        expect(getCardTheme("free")).toBe(freeTheme);
    });

    it("falls back to the free deck for unknown or missing ids", () => {
        expect(getCardTheme("does-not-exist")).toBe(freeTheme);
        expect(getCardTheme(null)).toBe(freeTheme);
        expect(getCardTheme(undefined)).toBe(freeTheme);
        expect(getCardTheme("")).toBe(freeTheme);
    });

    it("every registered theme is keyed by its own id", () => {
        for (const [id, theme] of Object.entries(THEMES)) {
            expect(theme.id).toBe(id);
        }
    });
});
