// usage: node tools/find.mjs <book> <regex> [maxPerSection]
// Prints "section: sentence" for every sentence in refs/ganguli/<book>/*.txt matching the regex.
import { readdirSync, readFileSync } from "node:fs";
const [book, pat, maxS = "3"] = process.argv.slice(2);
const re = new RegExp(pat, "i");
const dir = `refs/ganguli/${book}`;
for (const f of readdirSync(dir).sort()) {
  const txt = readFileSync(`${dir}/${f}`, "utf8").replace(/^\[.*?\]\s*/s, "").replace(/\s+/g, " ");
  const sents = txt.split(/(?<=[.!?]['"]?)\s+(?=["'A-Z])/);
  let n = 0;
  for (const s of sents) if (re.test(s) && n++ < +maxS) console.log(`${+f.slice(0, 3)}: ${s.slice(0, 420)}`);
}
