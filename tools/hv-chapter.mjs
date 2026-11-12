// Rebuild a Harivamsa chapter in verse order from GRETIL's alphabetical pada index.
// usage: node tools/hv-chapter.mjs <chapter> [fromVerse] [toVerse]   e.g. node tools/hv-chapter.mjs 25 1 20
// Main text only (ids like HV_25.1a); star passages (*HV_...) and appendices are skipped.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const [ch, from = "1", to = "9999"] = process.argv.slice(2);
const raw = readFileSync(join(ROOT, "refs", "gretil", "harivamsa.htm"), "utf8").replace(/<[^>]*>/g, "");
const rows = [];
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^(.*\S)\s+HV_(\d+)\.(\d+)([a-f])\s*$/);
  if (!m || m[2] !== ch) continue;
  const v = +m[3];
  if (v < +from || v > +to) continue;
  rows.push({ v, p: m[4], t: m[1].trim() });
}
rows.sort((a, b) => a.v - b.v || a.p.localeCompare(b.p));
let cur = null, buf = [];
const flush = () => { if (cur !== null) console.log(`HV ${ch}.${cur}  ${buf.join(" | ")}`); };
for (const r of rows) {
  if (r.v !== cur) { flush(); cur = r.v; buf = []; }
  buf.push(r.t);
}
flush();
