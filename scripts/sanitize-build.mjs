import { rm } from "node:fs/promises";
import { resolve } from "node:path";

// Local secrets are loaded during the build so server modules can be analyzed,
// but they must never be included in an archive or uploaded with the Worker.
await rm(resolve("dist/server/.dev.vars"), { force: true });
