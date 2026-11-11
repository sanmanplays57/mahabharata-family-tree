// Find verses in the GRETIL Critical Edition (refs/gretil/mbh/MBH1-18U.HTM).
// usage: node tools/find-verse.mjs "<iast fragment>" ["<fragment>" ...]
//        node tools/find-verse.mjs --id 06,024.022 [--id ...]
// Prints, per hit, the verse id and its a/c lines, and says whether it is main text
// or a star / appendix passage (ids containing * or @), which the CE excludes.
import { readFileSync } from "node:fs";

const lines = readFileSync("refs/gretil/mbh/MBH1-18U.HTM", "utf8").split(/\r?\n/);
const byId = new Map();
for (const l of lines) {
  const m = l.match(/^(\d\d,\d\d\d\.\d\d\d)([a-f])(\S*)\t(.*)$/);
  if (!m || m[3]) continue;
  if (!byId.has(m[1])) byId.set(m[1], {});
  byId.get(m[1])[m[2]] = m[4];
}
const show = (id, note = "") => {
  const v = byId.get(id);
  if (!v) return console.log(`${id}  NOT FOUND`);
  console.log(`${id}  main text${note}\n    a: ${v.a || ""}\n    c: ${v.c || ""}`);
};
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--id") { show(args[++i]); continue; }
  const frag = args[i];
  const hits = lines.filter((l) => l.includes(frag));
  if (!hits.length) { console.log(`"${frag}"  NO HIT`); continue; }
  const main = hits.map((l) => l.match(/^(\d\d,\d\d\d\.\d\d\d)[a-f]\t/)).filter(Boolean);
  if (main.length) show(main[0][1], `  (fragment "${frag}")`);
  else console.log(`"${frag}"  only in star/appendix passages: ${hits[0].split("\t")[0]}`);
}
