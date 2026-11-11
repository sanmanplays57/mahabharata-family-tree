// Checks every `wiki:` title in data/*.yaml against the Wikipedia API.
// Reports titles that are missing, redirects (with the target), and disambiguation pages.
import { readdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import * as yaml from "js-yaml";

const people = readdirSync("data").filter((f) => f.endsWith(".yaml"))
  .flatMap((f) => yaml.load(readFileSync(`data/${f}`, "utf8")) || []);
const titles = [...new Set(people.filter((p) => p.wiki).map((p) => p.wiki))];
let bad = 0;
for (let i = 0; i < titles.length; i += 45) {
  const batch = titles.slice(i, i + 45);
  const url = "https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=pageprops&ppprop=disambiguation&titles="
    + encodeURIComponent(batch.join("|"));
  // Wikipedia answers "You are making too many requests" (plain text) when rate-limited: wait and retry.
  let j = null;
  for (let attempt = 0; attempt < 6 && !j; attempt++) {
    const out = execFileSync("curl", ["-s", "--max-time", "60", "-A", "genealogy-research-script/0.1", url], { encoding: "utf8" });
    try { j = JSON.parse(out); } catch { execFileSync("powershell", ["-NoProfile", "-Command", "Start-Sleep -Seconds " + (10 * (attempt + 1))]); }
  }
  if (!j) throw new Error("Wikipedia kept rate-limiting; try again later");
  execFileSync("powershell", ["-NoProfile", "-Command", "Start-Sleep -Seconds 2"]);
  const norm = Object.fromEntries((j.query.normalized || []).map((n) => [n.from, n.to]));
  const redir = Object.fromEntries((j.query.redirects || []).map((r) => [r.from, r.to]));
  const pages = Object.values(j.query.pages);
  for (const t of batch) {
    const n = norm[t] || t, r = redir[n] || n;
    const pg = pages.find((p) => p.title === r);
    if (!pg || "missing" in pg) { console.log(`MISSING   ${t}`); bad++; }
    else if (pg.pageprops && "disambiguation" in pg.pageprops) { console.log(`DISAMBIG  ${t}`); bad++; }
    else if (r !== n) console.log(`redirect  ${t} -> ${r}`);
  }
}
console.log(`${titles.length} titles checked, ${bad} bad`);
console.log(bad ? "STATUS: FAIL" : "STATUS: OK");
