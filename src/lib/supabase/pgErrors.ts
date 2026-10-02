/** SQLSTATE codes the models branch on. */
export const UNIQUE_VIOLATION = "23505";
export const CHECK_VIOLATION = "23514";
/** RLS `with check` refusal. */
export const INSUFFICIENT_PRIVILEGE = "42501";
/** Raised by `room_players_lobby_only` when a seat write reaches a started room. */
export const ROOM_NOT_IN_LOBBY = "WCL01";
