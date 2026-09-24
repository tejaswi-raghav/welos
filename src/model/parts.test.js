import assert from "node:assert/strict";
import test from "node:test";
import { parts, systems } from "./parts.js";

test("hardware manifest has unique codes and valid systems", () => {
  const systemIds = new Set(systems.map(({ id }) => id));
  const ids = parts.map(({ id }) => id);
  const codes = parts.map(({ code }) => code);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(codes).size, codes.length);
  parts.forEach(({ system, role, status }) => {
    assert.ok(systemIds.has(system));
    assert.ok(role.length > 20);
    assert.ok(status.length > 20);
  });
});

test("every product subsystem is represented by hardware", () => {
  systems.filter(({ id }) => id !== "overview").forEach(({ id }) => {
    assert.ok(parts.some(({ system }) => system === id), `${id} has no parts`);
  });
});
