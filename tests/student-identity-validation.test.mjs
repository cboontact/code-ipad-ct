import assert from "node:assert/strict";
import test from "node:test";

import {
  isValidStudentIdentityId,
  isValidThaiCitizenId,
  normalizeStudentIdentityId,
} from "../lib/validation/student-identity.ts";

test("validates Thai citizen IDs with the official checksum", () => {
  assert.equal(isValidThaiCitizenId("8000000000006"), true);
  assert.equal(isValidThaiCitizenId("8000000000007"), false);
  assert.equal(isValidThaiCitizenId("9000000000005"), false);
  assert.equal(isValidThaiCitizenId("1111111111111"), false);
});

test("accepts 13-character Ministry of Education G-codes", () => {
  assert.equal(isValidStudentIdentityId("G123456789012"), true);
  assert.equal(isValidStudentIdentityId("g123456789012"), true);
  assert.equal(isValidStudentIdentityId("G12345678901"), false);
  assert.equal(isValidStudentIdentityId("G000000000000"), false);
});

test("accepts non-Thai registry IDs beginning with zero", () => {
  assert.equal(isValidStudentIdentityId("0123456789012"), true);
  assert.equal(isValidStudentIdentityId("0000000000000"), false);
});

test("accepts passport numbers without weakening Thai ID validation", () => {
  assert.equal(isValidStudentIdentityId("AB1234567"), true);
  assert.equal(isValidStudentIdentityId("p123456"), true);
  assert.equal(isValidStudentIdentityId("A12B34C56"), true);
  assert.equal(isValidStudentIdentityId("ABC12"), false);
  assert.equal(isValidStudentIdentityId("123456789"), false);
  assert.equal(isValidStudentIdentityId("AAAAAA"), false);
  assert.equal(isValidStudentIdentityId("AB12/3456"), false);
});

test("normalizes spaces, hyphens, casing, and full-width characters", () => {
  assert.equal(normalizeStudentIdentityId(" g-１２３ ４５６７８９０１２ "), "G123456789012");
});
