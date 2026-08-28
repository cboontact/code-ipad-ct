import { existsSync, symlinkSync, unlinkSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const serverDirectory = join(projectRoot, "dist", "server");
const sourceDevVars = join(projectRoot, ".dev.vars");
const linkedDevVars = join(serverDirectory, ".dev.vars");
let createdLink = false;

if (existsSync(sourceDevVars) && !existsSync(linkedDevVars)) {
  symlinkSync(relative(serverDirectory, sourceDevVars), linkedDevVars);
  createdLink = true;
}

const wrangler = join(projectRoot, "node_modules", "wrangler", "bin", "wrangler.js");
const child = spawn(
  process.execPath,
  [
    wrangler,
    "dev",
    "--config",
    join(serverDirectory, "wrangler.json"),
    "--local",
    "--persist-to",
    join(projectRoot, ".wrangler", "state"),
  ],
  { cwd: projectRoot, stdio: "inherit", env: process.env },
);

for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));

child.on("exit", (code, signal) => {
  if (createdLink) {
    try {
      unlinkSync(linkedDevVars);
    } catch {
      // The build directory may already have been removed by another process.
    }
  }
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
