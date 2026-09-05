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

  const [css, home, project, ipadVisual, studentAdmin, documentCheckin, documentCheckinApi, documentMigration, handovers, handoversApi, handoversMigration, returnsApi, adminShell, adminUsers, adminUsersApi, packageJson, previewScript] = await Promise.all([
    readFile(new URL(`assets/${cssName}`, clientRoot), "utf8"),
    readFile(new URL("components/public/survey-audience-gateway.tsx", root), "utf8"),
    readFile(new URL("components/public/project-documents.tsx", root), "utf8"),
    readFile(new URL("components/public/ipad-product-visual.tsx", root), "utf8"),
    readFile(new URL("components/admin/student-admin.tsx", root), "utf8"),
    readFile(new URL("components/admin/document-checkin.tsx", root), "utf8"),
    readFile(new URL("app/api/admin/document-checkin/route.ts", root), "utf8"),
    readFile(new URL("migrations/0019_add_student_document_checkin.sql", root), "utf8"),
    readFile(new URL("components/admin/device-handovers.tsx", root), "utf8"),
    readFile(new URL("app/api/admin/device-handovers/route.ts", root), "utf8"),
    readFile(new URL("migrations/0020_add_student_device_handovers.sql", root), "utf8"),
    readFile(new URL("app/api/admin/returns/route.ts", root), "utf8"),
    readFile(new URL("components/admin/admin-shell.tsx", root), "utf8"),
    readFile(new URL("components/admin/admin-users-manager.tsx", root), "utf8"),
    readFile(new URL("app/api/admin/admin-users/route.ts", root), "utf8"),
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
  assert.match(documentCheckin, /ตรวจรับเอกสารแบบรวดเร็ว/);
  assert.match(documentCheckin, /กดอีกครั้งเพื่อยืนยันรับเอกสาร/);
  assert.match(documentCheckin, /ตรวจเอกสารรายห้อง/);
  assert.match(documentCheckin, /ประวัติการตรวจรับเอกสาร/);
  assert.match(documentCheckinApi, /requireAdminApi/);
  assert.match(documentCheckinApi, /RECEIVE_STUDENT_DOCUMENT/);
  assert.match(documentCheckinApi, /CANCEL_STUDENT_DOCUMENT/);
  assert.match(documentMigration, /student_document_receipt_events/);
  assert.match(handovers, /สถานะการรับเครื่อง/);
  assert.match(handovers, /ไม่ระบุ \(ไม่บังคับ\)/);
  assert.match(handoversApi, /STUDENT_DEVICE_HANDOVER/);
  assert.match(handoversApi, /r\.approval_status='APPROVED'/);
  assert.match(handoversMigration, /student_device_handover_events/);
  assert.match(returnsApi, /student_device_handovers/);
  assert.match(returnsApi, /WHERE h\.status='ACTIVE'/);
  assert.doesNotMatch(returnsApi, /h\.status='ACTIVE' OR h\.student_id IS NULL/);
  assert.match(returnsApi, /'RETURN'/);
  assert.match(adminShell, /\/admin\/document-checkin/);
  assert.match(adminShell, /\/admin\/device-handovers/);
  assert.match(adminUsers, /แก้ไขข้อมูลผู้ดูแลระบบ/);
  assert.match(adminUsersApi, /export async function PATCH/);
  assert.match(adminUsersApi, /UPDATE_ADMIN/);
  assert.match(packageJson, /start-worker-preview\.mjs/);
  assert.match(previewScript, /wrangler\.json/);
  assert.match(previewScript, /\.dev\.vars/);
});
