import { describe, expect, it } from "vitest";
import { BOARD_THEMES, getBoardTheme } from ".";
import { greenFeltTheme } from "./green_felt";
import { midnightTheme } from "./midnight";

describe("getBoardTheme", () => {
    it("resolves a registered board style id", () => {
        expect(getBoardTheme("midnight")).toBe(midnightTheme);
    });

    it("falls back to the green felt for unknown or missing ids", () => {
        expect(getBoardTheme("does-not-exist")).toBe(greenFeltTheme);
        expect(getBoardTheme(null)).toBe(greenFeltTheme);
        expect(getBoardTheme(undefined)).toBe(greenFeltTheme);
        expect(getBoardTheme("")).toBe(greenFeltTheme);
    });

    it("every registered theme is keyed by its own id", () => {
        for (const [id, theme] of Object.entries(BOARD_THEMES)) {
            expect(theme.id).toBe(id);
        }
    });
});
