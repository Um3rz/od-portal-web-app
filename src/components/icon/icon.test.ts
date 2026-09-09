// Minimal self-check -- run with: npx tsx src/components/icon/icon.test.ts
import assert from "node:assert";
import { resolveIcon, vizIcon, fieldIcon } from "./icon";
import { ICONS } from "./icons";

assert.strictEqual(Object.keys(ICONS).length, 79, "expected 68 base + 11 drawn gap icons (icons.ts)");
assert.strictEqual(resolveIcon("times"), "close", "alias should resolve");
assert.strictEqual(resolveIcon("tile"), "tile", "already-valid name should pass through");
assert.strictEqual(resolveIcon("totally-unknown-icon"), "help", "unknown name falls back to help, never blank");
assert.strictEqual(vizIcon("horizontal_bar_chart"), "bar-horizontal");
assert.strictEqual(vizIcon("some_future_type"), "tile", "unknown analytical_type falls back to tile");
assert.strictEqual(fieldIcon("many2one"), "relation-one");
assert.strictEqual(fieldIcon("binary"), "type-char", "unmapped Odoo field type falls back to type-char");

console.log("icon.test.ts: all checks passed");
