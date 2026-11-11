// Headless check of mahabharata.html with the installed Edge: no JS errors,
// search finds people under variant spellings and epithets, selecting works.
// Screenshots go to build/shots/. Prints STATUS: OK at the end if all checks pass.

import puppeteer from "puppeteer-core";
import { mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const shots = join(ROOT, "build", "shots");
await mkdir(shots, { recursive: true });

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900 });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error" && !/wikipedia|ERR_|Failed to load/i.test(m.text())) errors.push("console: " + m.text()); });

await page.goto(pathToFileURL(join(ROOT, "mahabharata.html")).href, { waitUntil: "load" });
await page.screenshot({ path: join(shots, "01-start.png") });

let failed = 0;
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) failed++; };

const cases = [
  ["Yudhisthir", "yudhishthira"], ["Partha", "arjuna"], ["Gangeya", "bhishma"], ["Dwaipayana", "vyasa"],
  ["Krsna", "krishna"], ["Vrihaspati", "brihaspati"], ["Aswatthaman", "ashwatthama"], ["Sikhandin", "shikhandi"],
  ["Panchali", "draupadi"], ["Radheya", "karna"], ["Vikarna", "vikarna"], ["Bhimaratha", "kauravas"], ["Arjun", "arjuna"],
];
for (const [q, want] of cases) {
  const ids = await page.evaluate((q) => window.__tree.search(q).map((r) => r.it.id), q);
  check(ids.slice(0, 5).includes(want), `search "${q}" -> ${want} in top 5 (got ${ids.slice(0, 5).join(", ")})`);
}

check(await page.$eval("#canvas", (e) => e.classList.contains("hide-legal") && !e.classList.contains("hide-birth")),
  "by default only birth-parent lines are switched on");
await page.click("#legendBtn");
await new Promise((r) => setTimeout(r, 450));
check(await page.$eval("#legend", (e) => e.classList.contains("open")), "Legend button opens the legend");
await page.screenshot({ path: join(shots, "01b-legend.png") });
await page.click("#legendBtn");

await page.keyboard.down("Control"); await page.keyboard.press("f"); await page.keyboard.up("Control");
check(await page.$eval("#search", (e) => e.classList.contains("open")), "Ctrl+F opens the search box");
await page.type("#q", "Gudakesha");
await page.screenshot({ path: join(shots, "02-search.png") });
await page.keyboard.press("Enter");
await new Promise((r) => setTimeout(r, 2200));
check(await page.$eval("#panel", (e) => e.classList.contains("open")), "Enter opens the panel");
check(await page.$eval("#search", (e) => !e.classList.contains("open")), "search closes after choosing");
check(await page.evaluate(() => document.querySelectorAll("#edges .e-legal.rel").length === 0 && document.querySelectorAll("#overlay path").length === 0),
  "Arjuna selected with defaults: no legal lines and no arrows appear (unticked types stay hidden)");
const arrows = await page.evaluate(() => { document.querySelector("#tDivine").click(); const n = document.querySelectorAll("#overlay path").length; document.querySelector("#tDivine").click(); return n; });
check(arrows === 1, `ticking "divine father" with Arjuna selected draws only his arrow (${arrows})`);
check((await page.evaluate(() => location.hash)) === "#arjuna", "hash is #arjuna");
const panelText = await page.$eval("#panelBody", (e) => e.innerText);
check(/divine father/i.test(panelText) && /Indra/.test(panelText) && /Nara/.test(panelText), "panel shows Indra as divine father and Nara as previous self");
await page.screenshot({ path: join(shots, "03-arjuna.png") });

await page.evaluate(() => window.__tree.select("vidura", { fly: true }));
await new Promise((r) => setTimeout(r, 2200));
const vt = await page.$eval("#panelBody", (e) => e.innerText);
check(/biological|father/i.test(vt) && /Dharma/.test(vt), "Vidura panel shows Vyasa and Dharma");
await page.screenshot({ path: join(shots, "04-vidura.png") });

// clicking empty space (not dragging) closes the legend and the side panel
await page.click("#legendBtn");
await new Promise((r) => setTimeout(r, 400));
const empty = await page.evaluate(() => {
  for (let y = 120; y < innerHeight - 120; y += 23)
    for (let x = 420; x < innerWidth - 460; x += 29)
      if (document.elementFromPoint(x, y) === document.querySelector("#canvas")) return [x, y];
  return null;
});
check(!!empty, "found an empty spot on the canvas");
if (empty) {
  await page.mouse.click(empty[0], empty[1]);
  await new Promise((r) => setTimeout(r, 450));
  const st = await page.evaluate(() => [document.querySelector("#panel").classList.contains("open"), document.querySelector("#legend").classList.contains("open")]);
  check(!st[0] && !st[1], "clicking empty space closes the panel and the legend");
}

await page.evaluate(() => window.__tree.select("barbarika", { fly: true }));
await new Promise((r) => setTimeout(r, 2200));
const bt = await page.$eval("#panelBody", (e) => e.innerText);
check(/Maurvi/.test(bt) && /Yaksha/.test(bt), "Barbarika panel shows Maurvi and his Yaksha previous life");
await page.screenshot({ path: join(shots, "04b-barbarika.png") });

await page.evaluate(() => { window.__tree.clearSelection(); document.querySelector("#tInc").click(); document.querySelector("#tDivine").click(); window.__tree.fit(); });
await new Promise((r) => setTimeout(r, 400));
const nOverlay = await page.$$eval("#overlay path", (els) => els.length);
check(nOverlay > 40, `toggles draw overlay arrows (${nOverlay})`);
await page.screenshot({ path: join(shots, "05-fit-overlays.png") });

await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
await page.evaluate(() => { document.querySelector("#tInc").click(); document.querySelector("#tDivine").click(); window.__tree.select("karna", { fly: true }); });
await new Promise((r) => setTimeout(r, 2200));
await page.screenshot({ path: join(shots, "06-karna-dark.png") });

await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await page.evaluate(() => window.__tree.select("draupadi", { fly: true }));
await new Promise((r) => setTimeout(r, 2200));
await page.screenshot({ path: join(shots, "07-mobile.png") });

check(errors.length === 0, "no JS errors" + (errors.length ? ": " + errors.join(" | ") : ""));
await browser.close();
console.log(failed ? `STATUS: ${failed} FAILED` : "STATUS: OK");
process.exit(failed ? 1 : 0);
