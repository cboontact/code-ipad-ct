import { performance } from "node:perf_hooks";

const baseUrl = (process.env.BASE_URL ?? "http://localhost:8787").replace(/\/$/, "");
const users = Math.max(1, Number.parseInt(process.env.USERS ?? "400", 10));
const concurrency = Math.max(
  1,
  Math.min(users, Number.parseInt(process.env.CONCURRENCY ?? "400", 10)),
);
const timeoutMs = Math.max(1_000, Number.parseInt(process.env.TIMEOUT_MS ?? "15000", 10));
const warmup = process.env.WARMUP !== "0";
const cacheBuster = process.env.CACHE_BUSTER?.trim() ?? "";
const paths = (process.env.PATHS ??
  "/,/api/public/bootstrap,/api/public/inventory,/api/public/documents,/api/public/logo,/api/public/addresses")
  .split(",")
  .map((path) => path.trim())
  .filter(Boolean);

const requestDurations = [];
const journeyDurations = [];
const statuses = new Map();
const cacheStatuses = new Map();
const errors = [];
let nextUser = 0;

function percentile(values, percentage) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((percentage / 100) * sorted.length) - 1)];
}

async function fetchPath(path) {
  const startedAt = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = new URL(path, baseUrl);
    if (cacheBuster) url.searchParams.set("load-test", cacheBuster);
    const response = await fetch(url, {
      headers: { accept: path === "/" ? "text/html" : "application/json" },
      redirect: "manual",
      signal: controller.signal,
    });
    await response.arrayBuffer();
    const statusKey = String(response.status);
    statuses.set(statusKey, (statuses.get(statusKey) ?? 0) + 1);
    const cacheStatus =
      response.headers.get("x-public-cache") ??
      response.headers.get("cf-cache-status") ??
      "NONE";
    cacheStatuses.set(cacheStatus, (cacheStatuses.get(cacheStatus) ?? 0) + 1);
  } catch (error) {
    statuses.set("ERROR", (statuses.get("ERROR") ?? 0) + 1);
    if (errors.length < 10)
      errors.push(error instanceof Error ? error.message : String(error));
  } finally {
    clearTimeout(timeout);
    requestDurations.push(performance.now() - startedAt);
  }
}

async function runUser() {
  const startedAt = performance.now();
  await Promise.all(paths.map(fetchPath));
  journeyDurations.push(performance.now() - startedAt);
}

async function worker() {
  while (true) {
    const user = nextUser++;
    if (user >= users) return;
    await runUser();
  }
}

console.log(
  `Load test: ${users} users, concurrency ${concurrency}, ${paths.length} requests/user, ${baseUrl}`,
);

if (warmup) for (const path of paths) await fetchPath(path);
requestDurations.length = 0;
statuses.clear();
cacheStatuses.clear();

const startedAt = performance.now();
await Promise.all(Array.from({ length: concurrency }, worker));
const elapsedMs = performance.now() - startedAt;
const totalRequests = users * paths.length;

console.log(
  JSON.stringify(
    {
      users,
      concurrency,
      totalRequests,
      elapsedMs: Math.round(elapsedMs),
      requestsPerSecond: Number((totalRequests / (elapsedMs / 1_000)).toFixed(1)),
      status: Object.fromEntries(statuses),
      cache: Object.fromEntries(cacheStatuses),
      requestLatencyMs: {
        p50: Math.round(percentile(requestDurations, 50)),
        p95: Math.round(percentile(requestDurations, 95)),
        p99: Math.round(percentile(requestDurations, 99)),
        max: Math.round(Math.max(...requestDurations, 0)),
      },
      userJourneyMs: {
        p50: Math.round(percentile(journeyDurations, 50)),
        p95: Math.round(percentile(journeyDurations, 95)),
        p99: Math.round(percentile(journeyDurations, 99)),
        max: Math.round(Math.max(...journeyDurations, 0)),
      },
      errors,
    },
    null,
    2,
  ),
);

if ((statuses.get("ERROR") ?? 0) > 0 || [...statuses.keys()].some((status) => Number(status) >= 500))
  process.exitCode = 1;
