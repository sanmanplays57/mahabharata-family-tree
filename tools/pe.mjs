// Print entries of Vettam Mani's Puranic Encyclopaedia (OCR text) by headword.
// usage: node tools/pe.mjs <HEADWORD> [maxLines] [grepRegex]
//   Matches headwords like "SATYABHAMA", "SOMA II", "BUDHA I". With a regex, prints only
//   matching lines of the entry (case-insensitive) — handy for checking one relation.
import { readFileSync } from "node:fs";

const [head, max = "25", grep] = process.argv.slice(2);
const L = readFileSync("refs/puranic-encyclopaedia/mani_1975_djvu.txt", "utf8").split(/\r?\n/);
const isHead = (l) => /^[A-Z][A-ZÀ-ſl]{2,}( [IVXl]+)?\.? /.test(l) || /^[A-Z][A-ZÀ-ſl]{2,}( [IVXl]+)?\.?\s*$/.test(l);
const want = new RegExp(`^${head.replace(/ /g, "\\s+")}(\\s+[IVXl]+)?\\.?(\\s|$)`);
let shown = 0;
for (let i = 0; i < L.length && shown < 4; i++) {
  if (!want.test(L[i])) continue;
  const body = [L[i]];
  for (let j = i + 1; j < L.length && body.length < 400 && !(isHead(L[j]) && !want.test(L[j])); j++) body.push(L[j]);
  const text = body.map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (text.length < 2) continue;
  console.log(`--- line ${i + 1}`);
  const out = grep ? text.filter((l) => new RegExp(grep, "i").test(l)) : text.slice(0, +max);
  console.log(out.slice(0, +max).join("\n"));
  shown++;
}
if (!shown) console.log(`no entry ${head}`);
