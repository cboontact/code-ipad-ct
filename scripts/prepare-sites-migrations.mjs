import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = path.join(projectRoot, "migrations");
const targetDirectory = path.join(projectRoot, "drizzle");
const metaDirectory = path.join(targetDirectory, "meta");

const migrationFiles = (await readdir(sourceDirectory))
  .filter((file) => /^\d{4}_.+\.sql$/.test(file))
  .sort((left, right) => left.localeCompare(right));

if (migrationFiles.length === 0) {
  throw new Error("No application migrations were found.");
}

const statements = [];

for (const file of migrationFiles) {
  const sql = await readFile(path.join(sourceDirectory, file), "utf8");
  const fileStatements = sql
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  fileStatements.forEach((statement, index) => {
    const sourceComment = index === 0 ? `-- Source: migrations/${file}\n` : "";
    statements.push(`${sourceComment}${statement};`);
  });
}

await mkdir(metaDirectory, { recursive: true });

for (const file of await readdir(targetDirectory)) {
  if (file.endsWith(".sql")) {
    await rm(path.join(targetDirectory, file));
  }
}

const tag = "0000_sites_initial";
const combinedSql = `${statements.join("\n\n--> statement-breakpoint\n\n")}\n`;
const journal = {
  version: "7",
  dialect: "sqlite",
  entries: [
    {
      idx: 0,
      version: "7",
      when: 1787840000000,
      tag,
      breakpoints: true,
    },
  ],
};

await writeFile(path.join(targetDirectory, `${tag}.sql`), combinedSql, "utf8");
await writeFile(
  path.join(metaDirectory, "_journal.json"),
  `${JSON.stringify(journal, null, 2)}\n`,
  "utf8",
);

console.log(`Prepared ${migrationFiles.length} migrations for Sites.`);
