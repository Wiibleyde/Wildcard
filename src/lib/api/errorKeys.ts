/**
 * API error code → key of the `errors` dictionary namespace. Several server
 * codes share one message (auth failures, malformed bodies); anything not
 * listed reads as `generic`.
 */
const API_ERROR_KEYS = {
    unauthorized: "unauthorized",
    token_expired: "unauthorized",
    session_revoked: "unauthorized",
    forbidden: "forbidden",
    not_participant: "forbidden",
    not_found: "not_found",
    unknown_game: "unknown_game",
    not_matchmakable: "unknown_game",
    room_full: "room_full",
    already_started: "already_started",
    not_host: "not_host",
    not_enough_players: "not_enough_players",
    invalid_bot_count: "invalid_input",
    invalid_input: "invalid_input",
    invalid_body: "invalid_input",
    invalid_json: "invalid_input",
    version_conflict: "version_conflict",
    deal_failed: "deal_failed",
    rate_limited: "rate_limited",
    maintenance: "maintenance",
    payload_too_large: "payload_too_large",
    db_error: "server",
} as const;

export type ApiErrorKey =
    | (typeof API_ERROR_KEYS)[keyof typeof API_ERROR_KEYS]
    | "generic";

function isMappedCode(code: unknown): code is keyof typeof API_ERROR_KEYS {
    return typeof code === "string" && Object.hasOwn(API_ERROR_KEYS, code);
}

export function apiErrorKey(code: unknown): ApiErrorKey {
    return isMappedCode(code) ? API_ERROR_KEYS[code] : "generic";
}
