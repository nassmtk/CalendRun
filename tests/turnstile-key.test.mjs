// Garde-fou : TURNSTILE_SITE_KEY doit être la clé PUBLIQUE (courte), jamais la clé secrète
// Lancer : node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (f) => readFileSync(new URL(f, root), "utf8");

const keys = [
  ...[...read("brand.config.js").matchAll(/TURNSTILE_SITE_KEY:\s*"([^"]*)"/g)].map((m) => ["brand.config.js", m[1]]),
  ...[...read("wrangler.toml").matchAll(/^\s*TURNSTILE_SITE_KEY\s*=\s*"([^"]*)"/gm)].map((m) => ["wrangler.toml", m[1]])
];

test("TURNSTILE_SITE_KEY est définie dans brand.config.js et wrangler.toml ([vars] + [env.preview.vars])", () => {
  assert.equal(keys.filter(([f]) => f === "brand.config.js").length, 1);
  assert.equal(keys.filter(([f]) => f === "wrangler.toml").length, 2);
});

test("TURNSTILE_SITE_KEY ressemble à une clé publique (≤ 30 caractères, sans - ni _)", () => {
  for (const [file, key] of keys) {
    assert.ok(key.length <= 30, `${file} : clé de ${key.length} caractères (> 30) — clé secrète ?`);
    assert.ok(!/[-_]/.test(key), `${file} : la clé contient "-" ou "_" — clé secrète ?`);
  }
});
