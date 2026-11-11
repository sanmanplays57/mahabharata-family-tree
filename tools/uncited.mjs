// Lists every link in data/*.yaml that has no `cite`, grouped by file.
import { readdirSync, readFileSync } from "node:fs";
import * as yaml from "js-yaml";
let n = 0;
for (const f of readdirSync("data").filter((f) => f.endsWith(".yaml")).sort()) {
  for (const p of yaml.load(readFileSync(`data/${f}`, "utf8")) || []) {
    const rows = [
      ...(p.parents || []).map((l) => [l.rel, l.id, l]),
      ...(p.spouses || []).map((l) => ["spouse", l.id, l]),
      ...(p.incarnation || []).map((l) => [l.kind, l.of, l]),
      ...(p.returned || []).map((l) => ["returned", l.to, l]),
    ];
    for (const [rel, to, l] of rows) if (!l.cite) { console.log(`${f.padEnd(15)} ${p.id.padEnd(22)} ${rel.padEnd(16)} ${to}${l.ver ? "  [" + l.ver + "]" : ""}`); n++; }
  }
}
console.log(`${n} uncited links`);
