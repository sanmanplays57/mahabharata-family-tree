// Adds a citation to existing links in data/*.yaml, editing the text in place.
// usage: node tools/set-cite.mjs <personId> <targetId> "<cite>" [<personId> <targetId> "<cite>" ...]
// The link is the line inside <personId>'s block whose `id:`, `of:` or `to:` is <targetId>
// (parents, spouses, incarnation or returned). Links that already have a cite are left alone.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
if (args.length % 3) throw new Error("arguments come in triples: person target cite");
const files = readdirSync("data").filter((f) => f.endsWith(".yaml")).map((f) => [f, readFileSync(`data/${f}`, "utf8").split("\n")]);
const quote = (c) => (/[,:{}\[\]#]/.test(c) ? JSON.stringify(c) : c);

for (let i = 0; i < args.length; i += 3) {
  const [person, target, cite] = args.slice(i, i + 3);
  let done = false;
  for (const [, L] of files) {
    const start = L.indexOf(`- id: ${person}`);
    if (start < 0) continue;
    let end = L.findIndex((l, j) => j > start && l.startsWith("- id: "));
    if (end < 0) end = L.length;
    for (let j = start + 1; j < end; j++) {
      if (!new RegExp(`\\{ (id|of|to): ${target}[ ,}]`).test(L[j])) continue;
      // the same target can appear in two fields (e.g. portion of Shesha, and rejoined Shesha): use the uncited one
      if (/cite:/.test(L[j])) continue;
      L[j] = L[j].replace(/ \}\s*$/, `, cite: ${quote(cite)} }`);
      console.log(`cite  ${person} -> ${target}: ${cite}`);
      done = true;
      break;
    }
    if (done) break;
  }
  if (!done) console.log(`MISS  ${person} -> ${target}: no uncited link to that target`);
}
for (const [f, L] of files) writeFileSync(`data/${f}`, L.join("\n"));
