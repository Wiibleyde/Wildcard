/**
 * Returns the required Supabase env vars, throwing early with a clear message
 * if either is missing — better than a cryptic runtime failure downstream.
 */
export function getSupabaseEnv(): { url: string; anonKey: string } {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
        throw new Error(
            "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set",
        );
    }
    return { url, anonKey };
}
