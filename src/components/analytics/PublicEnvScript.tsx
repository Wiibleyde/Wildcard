import { readPublicEnvFromProcess } from "@/lib/public-env";
import { EnvBootstrap } from "./EnvBootstrap";

/**
 * Ships the runtime public env to the browser as `window.__PUBLIC_ENV__`.
 *
 * Server component → reads live `process.env` at request time (not baked), so a
 * single CI-built image is configured at container start. The values (public-
 * safe only — anon key + public URLs, never the service-role key) are handed to
 * {@link EnvBootstrap}, a client component that publishes the global. See there
 * for why this is a render-time assignment and not an inline `<script>`.
 */
export function PublicEnvScript() {
    return <EnvBootstrap env={readPublicEnvFromProcess()} />;
}
