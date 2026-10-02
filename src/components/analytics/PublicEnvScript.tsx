import { readPublicEnvFromProcess } from "@/lib/public-env";
import { EnvBootstrap } from "./EnvBootstrap";

// Read at request time, not baked at build: one image, configured at container start. Public-safe values only.
export function PublicEnvScript() {
    return <EnvBootstrap env={readPublicEnvFromProcess()} />;
}
