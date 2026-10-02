import { describe, expect, it } from "vitest";
import { localeFromPath, pathSegments } from "./locale";

describe("localeFromPath", () => {
    it("reads a supported locale prefix", () => {
        expect(localeFromPath("/en/lobby")).toBe("en");
        expect(localeFromPath("/fr")).toBe("fr");
    });

    it("falls back to the default locale", () => {
        expect(localeFromPath("/de/lobby")).toBe("fr");
        expect(localeFromPath("/")).toBe("fr");
    });
});

describe("pathSegments", () => {
    it("strips the locale and keeps whole segments", () => {
        expect(pathSegments("/en/maintenance").rest).toEqual(["maintenance"]);
        expect(pathSegments("/lobby/maintenance-x").rest).toEqual([
            "lobby",
            "maintenance-x",
        ]);
        expect(pathSegments("/").rest).toEqual([]);
    });
});
