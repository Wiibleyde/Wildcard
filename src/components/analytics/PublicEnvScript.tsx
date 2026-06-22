import { readPublicEnvFromProcess } from "@/lib/public-env";
import { EnvBootstrap } from "./EnvBootstrap";

/**
 * Server component → reads live `process.env` at request time (not baked), so a
 * single CI-built image is configured at container start. Public-safe values
 * only (anon key + public URLs, never the service-role key).
 */
export function PublicEnvScript() {
    return <EnvBootstrap env={readPublicEnvFromProcess()} />;
}
