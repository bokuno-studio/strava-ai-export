import assert from "node:assert/strict";
import test from "node:test";
import { toCsv } from "./csv";

test("toCsv escapes spreadsheet formula prefixes", () => {
  const csv = toCsv([{ name: "=cmd", plus: "+1", minus: "-2", at: "@me", ok: "ride" }]);
  assert.match(csv, /"'=cmd"/);
  assert.match(csv, /"'\+1"/);
  assert.match(csv, /"'-2"/);
  assert.match(csv, /"'@me"/);
  assert.match(csv, /"ride"/);
});
