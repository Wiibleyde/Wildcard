import type { Messages } from "next-intl";
import type { StudioErrorCode } from "@/lib/models/studio";

type StudioMessages = Messages["studio"];

/** Top-level string keys of the `studio` namespace. */
export type StudioMessageKey = {
    [K in keyof StudioMessages]: StudioMessages[K] extends string ? K : never;
}[keyof StudioMessages];

/** Studio API failures, plus the route-level body cap. */
type StudioApiErrorCode = StudioErrorCode | "payload_too_large";

const API_ERROR_CODES: Record<StudioApiErrorCode, true> = {
    not_found: true,
    invalid_definition: true,
    invalid_input: true,
    limit_reached: true,
    moderation_locked: true,
    payload_too_large: true,
    db_error: true,
};

function isApiErrorCode(code: string | null): code is StudioApiErrorCode {
    return code !== null && Object.hasOwn(API_ERROR_CODES, code);
}

export function studioApiErrorKey(
    code: string | null,
): `api_errors.${StudioApiErrorCode}` | null {
    return isApiErrorCode(code) ? `api_errors.${code}` : null;
}
