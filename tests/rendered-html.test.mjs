import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const serverRoot = new URL("../dist/server/", import.meta.url);
const clientRoot = new URL("../dist/client/", import.meta.url);

test("builds a complete Cloudflare production artifact", async () => {
  await Promise.all([
    access(new URL("index.js", serverRoot)),
    access(new URL("wrangler.json", serverRoot)),
    access(new URL("logo.png", clientRoot)),
    access(new URL("images/ipad-real.png", clientRoot)),
    access(new URL("awat-assets/moe.jpg", clientRoot)),
    access(new URL("fonts/THSarabunNew.ttf", clientRoot)),
    access(new URL("fonts/THSarabunNew-Bold.ttf", clientRoot)),
  ]);
});

test("keeps production bindings unique and local secrets out of the build", async () => {
  const config = JSON.parse(
    await readFile(new URL("wrangler.json", serverRoot), "utf8"),
  );
  const bindings = [
    ...(config.d1_databases ?? []).map(({ binding }) => binding),
    ...(config.r2_buckets ?? []).map(({ binding }) => binding),
  ];

  assert.equal(new Set(bindings).size, bindings.length);
  assert.deepEqual(config.d1_databases.map(({ binding }) => binding), ["DB"]);
  assert.deepEqual(config.r2_buckets.map(({ binding }) => binding), ["FILES"]);
  assert.equal(config.images?.binding, "IMAGES");
  assert.equal(config.cache?.enabled, true);
  await assert.rejects(access(new URL(".dev.vars", serverRoot)));
});

test("ships responsive styles and the current registration experience", async () => {
  const assets = await readdir(new URL("assets/", clientRoot));
  const cssName = assets.find((name) => name.endsWith(".css"));
  assert.ok(cssName, "production CSS bundle is missing");

  const [css, home, project, ipadVisual, studentAdmin, packageJson, previewScript] = await Promise.all([
    readFile(new URL(`assets/${cssName}`, clientRoot), "utf8"),
    readFile(new URL("components/public/survey-audience-gateway.tsx", root), "utf8"),
    readFile(new URL("components/public/project-documents.tsx", root), "utf8"),
    readFile(new URL("components/public/ipad-product-visual.tsx", root), "utf8"),
    readFile(new URL("components/admin/student-admin.tsx", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
    readFile(new URL("scripts/start-worker-preview.mjs", root), "utf8"),
  ]);

  assert.match(css, /@media/);
  assert.match(home, /ลงทะเบียน/);
  assert.match(home, /ครูและบุคลากร/);
  assert.match(home, /นักเรียน/);
  assert.match(project, /1,890|1890/);
  assert.match(project, /Apple iPad A16/);
  assert.match(project, /\/preview\?w=1200/);
  assert.match(project, /srcSet/);
  assert.match(ipadVisual, /quality=\{92\}/);
  assert.doesNotMatch(ipadVisual, /unoptimized/);
  assert.match(studentAdmin, /const visibleTotals = useMemo/);
  assert.match(studentAdmin, /void load\(\{ silent: true \}\)/);
  assert.match(packageJson, /start-worker-preview\.mjs/);
  assert.match(previewScript, /wrangler\.json/);
  assert.match(previewScript, /\.dev\.vars/);
});
