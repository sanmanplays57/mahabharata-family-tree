// Regex search over the Sanskrit Critical Edition, main-text lines only.
// usage: node tools/grep-ce.mjs "<regex>" [book, e.g. 06] [max hits]
import { readFileSync } from "node:fs";

const [pat, book = "", max = "5"] = process.argv.slice(2);
const re = new RegExp(pat);
let n = 0;
for (const line of readFileSync("refs/gretil/mbh/MBH1-18U.HTM", "utf8").split(/\r?\n/)) {
  const m = line.match(/^(\d\d),(\d\d\d)\.(\d\d\d)([a-f])\t([^<]*)/);
  if (!m || (book && m[1] !== book)) continue;
  if (re.test(m[5])) {
    console.log(`CE ${+m[1]}.${+m[2]}.${+m[3]}${m[4]}  ${m[5]}`);
    if (++n >= +max) break;
  }
}
if (!n) console.log(`no main-text hit for /${pat}/${book ? " in book " + book : ""}`);
