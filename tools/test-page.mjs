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

check(await page.$eval("#canvas", (e) => !e.classList.contains("hide-legal") && !e.classList.contains("hide-birth")),
  "by default birth-parent and legal-father lines are switched on");
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
check(await page.evaluate(() => document.querySelectorAll("#edges .e-legal.rel").length > 0 && document.querySelectorAll("#overlay path").length === 0),
  "Arjuna selected with defaults: his legal-father line to Pandu shows, and no arrows (unticked types stay hidden)");
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

// vulgate-only links are tagged, and the Critical Edition's own version stands beside them
await page.evaluate(() => window.__tree.select("mahabhauma"));
const mb = await page.$eval("#panelBody", (e) => e.innerText);
check(/vulgate only/.test(mb) && /Avachina/.test(mb) && /Arihan/.test(mb) && /texts differ/.test(mb),
  "Mahabhauma: Arihan (vulgate only) or Avachina (CE 1.90.18), as a dispute");
// a group member who is a person in the tree links to their own box
await page.evaluate(() => window.__tree.select("saptarishi-vaivasvata", { fly: true }));
await new Promise((r) => setTimeout(r, 1500));
const refBox = await page.$('#expand .mem-ref[data-ref="vasishtha"]');
check(!!refBox, "Saptarishi group expands with a linked member box for Vasishtha");
if (refBox) {
  const bb = await refBox.boundingBox();
  await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await new Promise((r) => setTimeout(r, 1500));
  check((await page.evaluate(() => location.hash)) === "#vasishtha", "clicking it selects Vasishtha himself");
}
await page.evaluate(() => window.__tree.select("radha-krishna"));
const rk = await page.$eval("#panelBody", (e) => e.innerText);
check(/Vrishabhanu/.test(rk) && /Krishna/.test(rk) && !/Adhiratha/.test(rk), "Krishna's Radha is a separate person from Adhiratha's wife");

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

// expandable group: click the Kauravas, then one of the names, then Esc
await page.evaluate(() => window.__tree.select("kauravas"));
await new Promise((r) => setTimeout(r, 2000));
const ex = await page.evaluate(() => ({ on: document.querySelector("#canvas").classList.contains("expanded"), n: document.querySelectorAll("#expand .mem").length, want: 0 }));
check(ex.on && ex.n > 90, `clicking the Kauravas expands them into ${ex.n} name boxes`);
await page.screenshot({ path: join(shots, "04c-kauravas.png") });
const memBox = await page.evaluate(() => { const r = [...document.querySelectorAll("#expand .mem")].find((g) => g.dataset.member === "Bhimaratha").getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
await page.mouse.click(memBox[0], memBox[1]);
await new Promise((r) => setTimeout(r, 400));
check((await page.$eval("#panelBody h2", (e) => e.textContent)) === "Bhimaratha", "clicking a name in the group opens that person's panel");
await page.keyboard.press("Escape");
await page.keyboard.press("Escape");
check(await page.evaluate(() => !document.querySelector("#canvas").classList.contains("expanded")), "Esc collapses the group again");
const viaSearch = await page.evaluate(() => window.__tree.search("Bhimaratha").some((r) => r.it.member === "Bhimaratha"));
check(viaSearch, "search finds a group member by name (alongside the Yadava king Bhimaratha)");

await page.evaluate(() => window.__tree.select("barbarika", { fly: true }));
await new Promise((r) => setTimeout(r, 2200));
const bt = await page.$eval("#panelBody", (e) => e.innerText);
check(/Maurvi/.test(bt) && /Yaksha/.test(bt), "Barbarika panel shows Maurvi and his Yaksha previous life");
await page.screenshot({ path: join(shots, "04b-barbarika.png") });

// texts that disagree: both versions drawn, each line marked "?", the panel tags them
await page.evaluate(() => window.__tree.select("ravana", { fly: true }));
await new Promise((r) => setTimeout(r, 2200));
const dq = await page.evaluate(() => ({
  marks: document.querySelectorAll("#edges .dq").length, lit: document.querySelectorAll("#edges .dq.rel").length,
  panel: document.querySelector("#panelBody").innerText,
}));
check(dq.marks >= 14 && dq.lit >= 2, `"?" marks on disputed lines (${dq.marks} in all, ${dq.lit} lit for Ravana)`);
check(/Pushpotkata.*\bor\b.*Kaikasi/s.test(dq.panel) && (dq.panel.match(/texts differ/g) || []).length === 1, "Ravana's panel: one “texts differ”, then mother: Pushpotkata (…) or Kaikasi (…)");
// clicking a "?" opens the disputed person's panel
await page.evaluate(() => window.__tree.clearSelection());
const dqAt = await page.evaluate(() => {
  for (const g of document.querySelectorAll("#edges .dq[data-id]")) {
    const r = g.getBoundingClientRect();
    if (r.width > 4 && r.x > 60 && r.x < innerWidth - 460 && r.y > 80 && r.y < innerHeight - 80) {
      const x = r.x + r.width / 2, y = r.y + r.height / 2, top = document.elementFromPoint(x, y), dq = top && top.closest(".dq[data-id]");
      if (dq) return { x, y, id: dq.dataset.id };
    }
  }
  return null;
});
if (dqAt) {
  await page.mouse.click(dqAt.x, dqAt.y);
  await new Promise((r) => setTimeout(r, 500));
  const opened = await page.evaluate((id) => location.hash === "#" + id && document.querySelector("#panel").classList.contains("open"), dqAt.id);
  check(opened, `clicking a “?” on screen opens ${dqAt.id}'s panel`);
} else check(false, "found a “?” on screen to click");
const ana = await page.evaluate(() => { window.__tree.select("anasuya"); return document.querySelector("#panelBody").innerText; });
check(/Daksha/.test(ana) && /Kardama/.test(ana) && /Bhagavata Purana 3\.24\.22/.test(ana), "Anasuya shows both Puranic parentages with their verses");

// "possibly the same being": Dharma and Yama, drawn only when ticked, listed in both panels
const same = await page.evaluate(() => {
  window.__tree.select("dharma");
  const panel = document.querySelector("#panelBody").innerText;
  const off = document.querySelectorAll("#overlay .ov-same").length;
  document.querySelector("#tSame").click();
  const on = document.querySelectorAll("#overlay .ov-same").length, q = document.querySelectorAll("#overlay .dq-ov").length;
  document.querySelector("#tSame").click();
  return { panel, off, on, q };
});
check(/possibly the same being as/i.test(same.panel) && /Yama/.test(same.panel) && same.off === 0 && same.on === 1 && same.q >= 1,
  `Dharma ≟ Yama: listed in the panel, drawn with a “?” only when ticked (${same.off} → ${same.on})`);
const fam = await page.evaluate(() => {
  const t = window.__tree, first = (a, b) => { const r = t.findRoutes(a, b, false); return r.length ? t.kinPhrase(r[0].path) : null; };
  return { drona: first("drona", "brihaspati"), subhadra: first("balarama", "subhadra"), rama: t.findRoutes("rama", "krishna", false).map((r) => t.routeLabel(r.path)), kaur: [t.findRoutes("vamana", "krishna", false).map((r) => t.routeLabel(r.path))[0]],
    sanjna: first("yama", "shani"), yami: first("yama", "yami") };
});
check(fam.drona === "grandfather", `Brihaspati is Drona's ${fam.drona} (and Drona is a portion of him)`);
check(fam.subhadra === "sister", `Subhadra is Balarama's ${fam.subhadra} (Rohini's daughter, Harivamsa 25.3)`);
check(/^both .*Vishnu$/.test(fam.rama[0] || "") && fam.rama.some((x) => /cousin/.test(x)), `Rama → Krishna: ${fam.rama.join(" / ")}`);
check(fam.kaur[0] === "both avatars of Vishnu", `Vamana → Krishna: ${fam.kaur[0]}`);
check(fam.sanjna === "half-brother" && fam.yami === "sister", `Sun's children: Shani is Yama's ${fam.sanjna}, Yami his ${fam.yami}`);

// dynasties: bands drawn, panel names the dynasty chain, search finds a dynasty by name
const dyn = await page.evaluate(() => {
  window.__tree.select("arjuna");
  const t = document.querySelector("#panelBody .dynline");
  const r = window.__tree.search("Ikshvaku dynasty")[0];
  return { bands: document.querySelectorAll("#dynasty .dyn").length, labels: document.querySelectorAll("#dynLabels text").length,
    line: t ? t.innerText : "", hit: r && r.it.dyn, hitId: r && r.it.id };
});
check(dyn.bands >= 20 && dyn.labels >= 20, `dynasty bands drawn (${dyn.bands} bands, ${dyn.labels} labels)`);
check(/Kuru dynasty/.test(dyn.line) && /Paurava/.test(dyn.line) && /Lunar/.test(dyn.line), `Arjuna's panel: "${dyn.line.replace(/\s+/g, " ")}"`);
check(dyn.hit === "ikshvaku" && dyn.hitId === "ikshvaku", `search "Ikshvaku dynasty" -> the dynasty, founded by ${dyn.hitId}`);
const hid = await page.evaluate(() => { const cb = document.querySelector("#tDyn"); cb.click(); const off = getComputedStyle(document.querySelector("#dynsvg")).display === "none"; cb.click(); return off; });
check(hid, "unticking “dynasty bands” hides them");
await page.evaluate(() => window.__tree.clearSelection());

// relationship finder: R opens it, two picks run it, the route is drawn and explained
const kin = await page.evaluate(() => {
  const t = window.__tree, first = (a, b, l) => { const r = t.findRoutes(a, b, l); return r.length ? t.kinPhrase(r[0].path) : null; };
  return {
    karna: first("karna", "arjuna"), mil: first("draupadi", "kunti"), bil: t.findRoutes("arjuna", "krishna").map((r) => t.kinPhrase(r.path)),
    gu: first("duryodhana", "bhishma"), line: first("janamejaya", "pururavas"), drona: (t.findRoutes("drona", "ghritachi", true)[0] || { path: [] }).path.length,
  };
});
check(kin.karna === "half-brother", `finder: Arjuna is Karna's ${kin.karna}`);
check(kin.mil === "mother-in-law", `finder: Kunti is Draupadi's ${kin.mil}`);
check(kin.bil.includes("brother-in-law") && kin.bil.includes("first cousin"), `finder: Krishna is Arjuna's ${kin.bil.join(" / ")}`);
check(kin.gu === "great-uncle", `finder: Bhishma is Duryodhana's ${kin.gu}`);
check(/^[0-9]+× great-grandfather$/.test(kin.line || ""), `finder: direct line Janamejaya -> Pururavas is "${kin.line}"`);
check(kin.drona === 2, `finder with rebirth links: Drona -> Ghritachi is one link (birth sparked by), got ${kin.drona - 1}`);
await page.evaluate(() => window.__tree.clearSelection());
await page.keyboard.press("r");
check(await page.$eval("#finder", (e) => e.classList.contains("open")), "R opens the relationship finder");
await page.type("#fA", "Radheya");
await page.keyboard.press("Enter");
await page.type("#fB", "Bhimasena");
await page.keyboard.press("Enter");
await new Promise((r) => setTimeout(r, 2200));
const fin = await page.evaluate(() => ({
  open: document.querySelector("#finder").classList.contains("open"), panel: document.querySelector("#panelBody").innerText,
  segs: document.querySelectorAll("#pathLayer .pl").length, on: document.querySelectorAll("#nodes .on-path").length,
  hash: location.hash, cls: document.querySelector("#canvas").classList.contains("has-path"),
}));
check(!fin.open && /half-brother/.test(fin.panel) && fin.segs === 2 && fin.on === 3 && fin.cls, `typing Radheya / Bhimasena shows the route (${fin.segs} segments, ${fin.on} people lit)`);
check(fin.hash === "#karna~bhima", `relation hash is ${fin.hash}`);
await page.screenshot({ path: join(shots, "04d-relation.png") });
await page.evaluate(() => [...document.querySelectorAll("#panelBody a.go")].find((a) => a.textContent === "Kunti").click());
await new Promise((r) => setTimeout(r, 600));
const back = await page.evaluate(() => ({ path: document.querySelector("#canvas").classList.contains("has-path"), back: !!document.querySelector("#panelBody .back") }));
check(!back.path && back.back, "clicking Kunti in the chain opens her panel, with a link back to the relation");
await page.evaluate(() => document.querySelector("#panelBody .back").click());
await new Promise((r) => setTimeout(r, 600));
check(await page.evaluate(() => document.querySelector("#canvas").classList.contains("has-path")), "the back link restores the relation");
await page.keyboard.press("Escape");

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
