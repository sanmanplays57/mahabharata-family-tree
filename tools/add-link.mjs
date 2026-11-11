// Appends a link to a person's block in data/*.yaml, creating the field if needed.
// usage: node tools/add-link.mjs <personId> <field> '<flow mapping>' [<personId> <field> '<mapping>' ...]
//   field: parents | spouses | incarnation | returned
//   e.g.   node tools/add-link.mjs karna returned '{ to: surya, cite: "svargarohana 4, 5" }'
// A link whose target already appears in that field of that person is skipped.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
if (args.length % 3) throw new Error("arguments come in triples: person field mapping");
const files = readdirSync("data").filter((f) => f.endsWith(".yaml")).map((f) => [f, readFileSync(`data/${f}`, "utf8").split("\n")]);
const FIELDS = ["parents", "spouses", "incarnation", "returned"];

for (let i = 0; i < args.length; i += 3) {
  const [person, field, mapping] = args.slice(i, i + 3);
  if (!FIELDS.includes(field)) throw new Error(`unknown field ${field}`);
  const target = (mapping.match(/\{ (?:id|of|to): ([a-z0-9-]+)/) || [])[1];
  let done = false;
  for (const [, L] of files) {
    const start = L.indexOf(`- id: ${person}`);
    if (start < 0) continue;
    let end = L.findIndex((l, j) => j > start && l.startsWith("- id: "));
    if (end < 0) end = L.length;
    while (end > start + 1 && (L[end - 1].trim() === "" || L[end - 1].startsWith("#"))) end--;
    const fieldAt = L.findIndex((l, j) => j > start && j < end && l === `  ${field}:`);
    if (fieldAt >= 0) {
      let last = fieldAt;
      while (last + 1 < end && L[last + 1].startsWith("    - ")) last++;
      if (L.slice(fieldAt + 1, last + 1).some((l) => new RegExp(`(id|of|to): ${target}[ ,}]`).test(l))) {
        console.log(`skip  ${person}.${field} -> ${target}: exists`); done = true; break;
      }
      L.splice(last + 1, 0, `    - ${mapping}`);
    } else {
      L.splice(end, 0, `  ${field}:`, `    - ${mapping}`);
    }
    console.log(`add   ${person}.${field} -> ${target}`);
    done = true;
    break;
  }
  if (!done) console.log(`MISS  ${person}: no such person`);
}
for (const [f, L] of files) writeFileSync(`data/${f}`, L.join("\n"));
