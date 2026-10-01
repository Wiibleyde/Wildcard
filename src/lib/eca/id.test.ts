import { describe, expect, it } from "vitest";
import {
    ecaCoverImagePath,
    ecaImageExtensionOf,
    isEcaCoverImagePath,
    isUuid,
} from "./id";

const OWNER = "11111111-2222-4333-8444-555555555555";
const GAME = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("isUuid", () => {
    it("accepts canonical uuids only", () => {
        expect(isUuid(GAME)).toBe(true);
        expect(isUuid(GAME.toUpperCase())).toBe(true);
        expect(isUuid("not-a-uuid")).toBe(false);
        expect(isUuid(`${GAME}x`)).toBe(false);
        expect(isUuid("")).toBe(false);
    });
});

describe("cover image paths", () => {
    it("normalizes allowed extensions, refuses others", () => {
        expect(ecaImageExtensionOf("cover.PNG")).toBe("png");
        expect(ecaImageExtensionOf("a.b.jpeg")).toBe("jpeg");
        expect(ecaImageExtensionOf("evil.svg")).toBeNull();
        expect(ecaImageExtensionOf("noext")).toBeNull();
    });

    it("accepts exactly <owner>/<game>.<ext>", () => {
        expect(
            isEcaCoverImagePath(
                ecaCoverImagePath(OWNER, GAME, "webp"),
                OWNER,
                GAME,
            ),
        ).toBe(true);
    });

    it("refuses traversal, foreign games and foreign folders", () => {
        for (const path of [
            `${OWNER}/../victim/x.png`,
            `${OWNER}/${GAME}.svg`,
            `${OWNER}/other-game.png`,
            `${OWNER}/${GAME}.png/../x.png`,
            `${GAME}/${GAME}.png`,
            `${OWNER}/sub/${GAME}.png`,
        ]) {
            expect(isEcaCoverImagePath(path, OWNER, GAME)).toBe(false);
        }
    });
});
