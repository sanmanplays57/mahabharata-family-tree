(() => {
"use strict";
const $ = (s) => document.querySelector(s);
const NS = "http://www.w3.org/2000/svg";
const svg = $("#canvas"), world = $("#world");
const gEdges = $("#edges"), gOver = $("#overlay"), gNodes = $("#nodes");
const panel = $("#panel"), panelBody = $("#panelBody");
const searchEl = $("#search"), qEl = $("#q"), resultsEl = $("#results");
const legend = $("#legend"), legendBtn = $("#legendBtn");
// Panels stay in the DOM and animate between states via the "open" class.
const setOpen = (elm, on) => { elm.classList.toggle("open", on); elm.setAttribute("aria-hidden", on ? "false" : "true"); };
const isOpen = (elm) => elm.classList.contains("open");
function setLegend(on) { setOpen(legend, on); legendBtn.setAttribute("aria-expanded", on ? "true" : "false"); }
legendBtn.addEventListener("click", () => setLegend(!isOpen(legend)));

const NH = DATA.nodeH;
const people = new Map(DATA.people.map((p) => [p.id, p]));
const pos = DATA.pos;

const BOOK = {
  adi: "the-mahabharata-book-1-adi-parva",
  sabha: "the-mahabharata-book-2-sabha-parva",
  vana: "the-mahabharata-book-3-vana-parva",
  virata: "the-mahabharata-book-4-virata-parva",
  udyoga: "the-mahabharata-book-5-udyoga-parva",
  bhishma: "the-mahabharata-book-6-bhishma-parva",
  drona: "the-mahabharata-book-7-drona-parva",
  karna: "the-mahabharata-book-8-karna-parva",
  shalya: "the-mahabharata-book-9-shalya-parva",
  sauptika: "the-mahabharata-book-10-sauptika-parva",
  stri: "the-mahabharata-book-11-stri-parva",
  shanti: "the-mahabharata-book-12-santi-parva",
  anushasana: "the-mahabharata-book-13-anusasana-parva",
  ashvamedhika: "the-mahabharata-book-14-aswamedha-parva",
  ashramavasika: "the-mahabharata-book-15-asramavasika-parva",
  mausala: "the-mahabharata-book-16-mausala-parva",
  mahaprasthanika: "the-mahabharata-book-17-mahaprasthanika-parva",
  svargarohana: "the-mahabharata-book-18-svargarohanika-parva",
};

/* ---------- relation indexes ---------- */
const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
const childrenOf = new Map(), spousesOf = new Map(), bornAs = new Map(), returnedFrom = new Map(), sameAs = new Map();
for (const p of DATA.people) {
  for (const l of p.parents || []) push(childrenOf, l.id, { ...l, id: p.id });
  for (const s of p.spouses || []) {
    push(spousesOf, p.id, s);
    push(spousesOf, s.id, { ...s, id: p.id });
  }
  for (const l of p.incarnation || []) push(bornAs, l.of, { ...l, id: p.id });
  for (const l of p.returned || []) push(returnedFrom, l.to, { ...l, id: p.id });
  for (const l of p.same || []) { push(sameAs, p.id, { ...l, id: l.as }); push(sameAs, l.as, { ...l, id: p.id }); }
}
for (const [k, list] of spousesOf) {
  const seen = new Set();
  spousesOf.set(k, list.filter((s) => !seen.has(s.id) && seen.add(s.id)));
}
const degree = (id) => {
  const p = people.get(id);
  return (p.parents || []).length + (childrenOf.get(id) || []).length + (spousesOf.get(id) || []).length
    + (p.incarnation || []).length + (bornAs.get(id) || []).length;
};
const famOfPerson = new Map();
for (const f of DATA.families) {
  for (const id of f.parents) push(famOfPerson, id, f.id);
  for (const c of f.children) push(famOfPerson, c.id, f.id);
}

/* ---------- drawing ---------- */
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
};
const nodeEls = new Map(), famEls = new Map(), edgeEls = [];

for (const e of DATA.edges) {
  const path = el("path", { d: e.d, class: "e e-" + e.type }, gEdges);
  edgeEls.push({ ...e, el: path });
}
// a "?" where the texts disagree about a line (two versions of someone's parentage)
// Clicking a "?" opens the panel of the person whose link is disputed (data-id).
const doubtMark = (x, y, cls, tip, parent, id) => {
  const g = el("g", { class: "dq " + cls, transform: `translate(${x.toFixed(1)},${y.toFixed(1)})`, ...(id && { "data-id": id }) }, parent);
  el("circle", { r: 6.5 }, g);
  el("text", { y: 3.6, "text-anchor": "middle" }, g).textContent = "?";
  el("title", {}, g).textContent = tip;
  return g;
};
for (const e of edgeEls) {
  if (!e.doubt) continue;
  const len = e.el.getTotalLength(), pt = e.el.getPointAtLength(len * 0.5);
  const child = people.get(e.to);
  e.dq = doubtMark(pt.x, pt.y, "dq-" + e.type, `The texts disagree about ${child ? child.name + "’s" : "this"} parentage. Click to see each version.`, gEdges, child && e.to);
}
for (const f of DATA.families) {
  const p = pos[f.id];
  if (!p) continue;
  const dot = el("circle", { cx: p[0], cy: p[1], r: 3.2, class: "fam" }, gEdges);
  const names = f.parents.map((id) => people.get(id).name).join(" and ");
  el("title", {}, dot).textContent = f.children.length ? `Children of ${names}` : `Marriage of ${names} (no children listed)`;
  famEls.set(f.id, dot);
}
const hasDivine = (p) => (p.parents || []).some((l) => l.rel.startsWith("divine"));
const hasInc = (p) => (p.incarnation || []).length > 0 || bornAs.has(p.id);
for (const p of DATA.people) {
  const [x, y] = pos[p.id];
  const w = p.w;
  let cls = "n k-" + p.kind;
  if (p.kind === "human") cls += " h-" + (p.house || "other");
  if (p.ver) cls += " v-" + p.ver;
  const g = el("g", { class: cls, transform: `translate(${x - w / 2},${y - NH / 2})`, "data-id": p.id }, gNodes);
  el("rect", { width: w, height: NH, rx: 7 }, g);
  // a group with listed members shows a "⋯ 94" pill and expands when clicked
  const hasMem = p.members && p.members.length;
  const t = el("text", { x: (hasMem ? w - 44 : w) / 2, y: NH / 2 + 4.5, "text-anchor": "middle" }, g);
  t.textContent = p.name;
  if (hasMem) {
    const pill = el("g", { class: "pill" }, g);
    el("rect", { x: w - 42, y: 5, width: 38, height: NH - 10, rx: 9, class: "pill-bg" }, pill);
    el("text", { x: w - 23, y: NH / 2 + 4, "text-anchor": "middle", class: "pill-t" }, pill).textContent = "⋯ " + p.members.length;
  }
  let bx = w - 3;
  const badge = (cls, text) => {
    const c = el("circle", { cx: bx, cy: 3, r: 4, class: "badge " + cls }, g);
    el("title", {}, c).textContent = text;
    bx -= 9;
  };
  if (hasDivine(p)) badge("b-divine", "Has a divine father");
  if (hasInc(p)) badge("b-incarnation", "Has incarnation / previous-birth links (click to see the arrows)");
  const tip = el("title", {}, g);
  tip.textContent = p.name + (p.title ? " — " + p.title : "");
  nodeEls.set(p.id, g);
}

/* ---------- dynasty bands ---------- */
// Each dynasty is a soft band behind its members, joining each member to their father
// inside the same dynasty. One group per dynasty, faded as a whole, so overlaps inside
// a band don't darken. Labels sit at the top of each stretch, repeated down long ones.
const dynasties = new Map((DATA.dynasties || []).map((d) => [d.id, d]));
const edgeByEnds = new Map(edgeEls.map((e) => [e.from + ">" + e.to, e]));
const famsOfChild = new Map();
for (const f of DATA.families) for (const c of f.children) push(famsOfChild, c.id, f);
function bandEdges(father, child) {
  const direct = edgeByEnds.get(father + ">" + child);
  if (direct) return [direct];
  for (const f of famsOfChild.get(child) || []) {
    if (!f.parents.includes(father)) continue;
    const up = edgeByEnds.get(father + ">" + f.id), down = edgeByEnds.get(f.id + ">" + child);
    if (up && down) return [up, down];
  }
  return [];
}
// The bands live in their own SVG layer behind the map, so a click that fades the
// map does not repaint thousands of thick strokes every frame; the layer is dimmed
// as a whole (a cheap opacity change on one element).
const dynWorld = $("#dynworld");
const gDyn = el("g", { id: "dynasty" }, dynWorld);
const gDynLabels = el("g", { id: "dynLabels" }, dynWorld);
let dynLabels = [];
for (const d of dynasties.values()) {
  if (!d.members.length) continue;
  const g = el("g", { class: "dyn", style: `--h:${d.hue}` }, gDyn);
  el("title", {}, g).textContent = d.name;
  // follow the drawn lines: father -> family dot -> child, or the direct line
  for (const [a, b] of d.links)
    for (const e of bandEdges(a, b)) el("path", { d: e.d }, g);
  for (const id of d.members) {
    const p = pos[id], w = people.get(id).w;
    if (p) el("rect", { x: p[0] - w / 2 - 6, y: p[1] - NH / 2 - 6, width: w + 12, height: NH + 12, rx: 14 }, g);
  }
  const up = new Map(d.members.map((m) => [m, m]));
  const find = (x) => { while (up.get(x) !== x) x = up.get(x); return x; };
  for (const [a, b] of d.links) up.set(find(a), find(b));
  const comps = new Map();
  for (const m of d.members) if (pos[m]) push(comps, find(m), m);
  for (const ms of comps.values()) {
    if (ms.length < 3 && !ms.includes(d.founder)) continue;
    ms.sort((x, y) => pos[x][1] - pos[y][1]);
    // repeat the name down a long column, but not beside a member drawn far off to the
    // side (Sita sits next to Rama, far from the Videha column)
    let lastY = -Infinity, lastX = null;
    for (const m of ms) {
      if (pos[m][1] - lastY < 1600 || (lastX !== null && Math.abs(pos[m][0] - lastX) > 600)) continue;
      lastY = pos[m][1]; lastX = pos[m][0];
      const t = el("text", { class: "dyn-label", "text-anchor": "middle", style: `--h:${d.hue}` }, gDynLabels);
      t.textContent = d.name.toUpperCase();
      dynLabels.push({ el: t, x: pos[m][0], y: pos[m][1], chars: d.name.length, rank: d.members.length });
    }
  }
}
dynLabels.sort((a, b) => b.rank - a.rank);
// labels keep a readable on-screen size at any zoom
// and where two would overlap, the bigger dynasty's label wins until you zoom in
function sizeDynLabels() {
  // about 19px on screen when zoomed out, growing gently (to ~32px) as you zoom in
  const fs = Math.min((19 * Math.min(1.7, Math.max(1, Math.pow(k, 0.35)))) / k, 230), placed = [];
  for (const L of dynLabels) {
    const ly = y0(L, fs), w = L.chars * fs * 0.8, h = fs * 1.1;
    const box = [L.x - w / 2, ly - h, L.x + w / 2, ly + h * 0.2];
    const hit = placed.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]);
    L.el.style.display = hit ? "none" : "";
    if (hit) continue;
    placed.push(box);
    L.el.setAttribute("font-size", fs.toFixed(1));
    L.el.setAttribute("stroke-width", (fs / 4).toFixed(1));
    L.el.setAttribute("x", L.x);
    L.el.setAttribute("y", ly.toFixed(1));
  }
}
function y0(L, fs) { return L.y - NH / 2 - 14 - fs * 0.35; }
$("#tDyn").addEventListener("change", (e) => svg.classList.toggle("hide-dyn", !e.target.checked));

/* ---------- overlay arrows (divine fathers, incarnations, returns) ---------- */
function clip(c, w, toward) {
  const ux = toward[0] - c[0], uy = toward[1] - c[1];
  const len = Math.hypot(ux, uy) || 1;
  const hw = w / 2 + 3, hh = NH / 2 + 3;
  const t = Math.min(ux ? hw / Math.abs(ux / len) : Infinity, uy ? hh / Math.abs(uy / len) : Infinity);
  return [c[0] + (ux / len) * t, c[1] + (uy / len) * t];
}
function overlayPath(o) {
  const a = pos[o.from], b = pos[o.to];
  if (!a || !b || o.from === o.to) return null;
  const dx = b[0] - a[0], dy = b[1] - a[1], dist = Math.hypot(dx, dy);
  // each arrow type bows by a different amount, so e.g. Surya -> Karna as divine father
  // and as "portion of" don't sit exactly on top of each other
  const bend = Math.min(0.18 * dist, 420) * ({ divine: 1, incarnation: 1.5, returned: 1.2, far: 0.75, cause: 1.3, same: 0.5 }[o.type] || 1);
  const c = [(a[0] + b[0]) / 2 - (dy / dist) * bend, (a[1] + b[1]) / 2 + (dx / dist) * bend];
  const s = clip(a, people.get(o.from).w, c), t = clip(b, people.get(o.to).w, c);
  o.mid = [(s[0] + t[0]) / 4 + c[0] / 2, (s[1] + t[1]) / 4 + c[1] / 2];
  return `M${s[0].toFixed(1)},${s[1].toFixed(1)}Q${c[0].toFixed(1)},${c[1].toFixed(1)} ${t[0].toFixed(1)},${t[1].toFixed(1)}`;
}
// Legend checkboxes decide which line types are drawn at all; an unticked type stays
// hidden even for the selected person (the side panel still lists every relation).
// Ticked arrow types: everyone's arrows when nothing is selected, only the selected
// person's arrows when someone is.
const OV_TOGGLES = { divine: $("#tDivine"), incarnation: $("#tInc"), returned: $("#tReturned"), far: $("#tFar"), cause: $("#tCause"), same: $("#tSame"), farspouse: $("#tSpouse") };
const EDGE_TOGGLES = { birth: $("#tBirth"), legal: $("#tLegal"), bio: $("#tBio"), adoptive: $("#tAdoptive"), spouse: $("#tSpouse") };
const edgeOn = (t) => (EDGE_TOGGLES[t] ? EDGE_TOGGLES[t].checked : true);
const ovOn = (t) => !!(OV_TOGGLES[t] && OV_TOGGLES[t].checked);
function drawOverlays() {
  gOver.textContent = "";
  for (const o of DATA.overlays) {
    if (!ovOn(o.type)) continue;
    if (sel && o.from !== sel && o.to !== sel) continue;
    const d = overlayPath(o);
    if (!d) continue;
    const path = el("path", { d, class: "ov ov-" + o.type, ...(o.type !== "same" && o.type !== "farspouse" && { "marker-end": `url(#m-${o.type})` }) }, gOver);
    const tip = el("title", {}, path);
    const verb = o.type === "divine" ? "fathered" : o.type === "cause" ? "brought about the birth of" : o.type === "far" ? "is a distant parent of"
      : o.type === "same" ? "may be the same being as"
      : o.type === "returned" ? "rejoined after death:" : (o.kind || "incarnation") + " →";
    tip.textContent = `${people.get(o.from).name} ${verb} ${people.get(o.to).name}`;
    if (o.doubt) doubtMark(o.mid[0], o.mid[1], "dq-ov", tip.textContent + " — the texts disagree. Click to see each version.", gOver, o.type === "same" ? o.from : o.to);
  }
}
// Hidden line types fade out; a family dot fades out when none of its lines are visible.
const famEdges = new Map();
for (const e of edgeEls) {
  if (famEls.has(e.from)) push(famEdges, e.from, e);
  if (famEls.has(e.to)) push(famEdges, e.to, e);
}
function refreshEdges() {
  for (const [t, cb] of Object.entries(EDGE_TOGGLES)) svg.classList.toggle("hide-" + t, !cb.checked);
  for (const [fid, c] of famEls) c.classList.toggle("off", !(famEdges.get(fid) || []).some((e) => edgeOn(e.type)));
}
function onToggle() {
  refreshEdges();
  if (sel) highlight(sel);
  drawOverlays();
}
for (const cb of [...Object.values(OV_TOGGLES), ...Object.values(EDGE_TOGGLES)]) cb.addEventListener("change", onToggle);

/* ---------- background verses ---------- */
// One tile holding every verse, drawn 3x3 times; the whole 3x3 block slides with the pan
// at a fraction of its speed and wraps every tile, so the plane of verses is endless and
// panning across the tree brings different verses into view.
const TILE = DATA.verses.tile, PARALLAX = 0.45, LINE_H = 46;
const verseTile = $("#verseTile"), verseLayer = $("#verseLayer");
for (const v of DATA.verses.items) {
  v.lines.forEach((line, i) => {
    el("text", { x: v.x, y: v.y + i * LINE_H, class: "vs" }, verseTile).textContent =
      line + (i === v.lines.length - 1 ? " ॥" : " ।");
  });
  el("text", { x: v.x + 2, y: v.y + (v.lines.length - 1) * LINE_H + 30, class: "vs-ref" }, verseTile).textContent = v.ref;
}
for (let i = 0; i < 3; i++)
  for (let j = 0; j < 3; j++)
    el("use", { href: "#verseTile", x: i * TILE[0], y: j * TILE[1] }, verseLayer);
const mod = (a, n) => ((a % n) + n) % n;

/* ---------- pan & zoom ---------- */
let k = 1, tx = 0, ty = 0, anim = null;
// names along a found relation keep a readable on-screen size when zoomed far out
let pathLabels = [];
function sizePathLabels() {
  const show = k < 0.95, fs = 14 / k;
  for (const { el: t, x, y } of pathLabels) {
    t.style.display = show ? "" : "none";
    if (!show) continue;
    t.setAttribute("font-size", fs.toFixed(1));
    t.setAttribute("stroke-width", (4 / k).toFixed(1));
    t.setAttribute("x", x);
    t.setAttribute("y", (y - NH / 2 - 7 / k).toFixed(1));
  }
}
const apply = () => {
  const tf = `translate(${tx.toFixed(2)},${ty.toFixed(2)}) scale(${k.toFixed(5)})`;
  world.setAttribute("transform", tf);
  dynWorld.setAttribute("transform", tf);
  if (pathLabels.length) sizePathLabels();
  if (dynLabels.length) sizeDynLabels();
  verseLayer.setAttribute("transform",
    `translate(${(mod(tx * PARALLAX, TILE[0]) - TILE[0]).toFixed(1)},${(mod(ty * PARALLAX, TILE[1]) - TILE[1]).toFixed(1)})`);
};
const [W, H] = DATA.size;
const fitScale = () => Math.min(innerWidth / (W + 80), (innerHeight - 70) / (H + 80));
const kMin = () => Math.min(0.08, fitScale() * 0.8), kMax = 4;
function zoomAt(sx, sy, f) {
  const nk = Math.max(kMin(), Math.min(kMax, k * f));
  tx = sx - ((sx - tx) * nk) / k;
  ty = sy - ((sy - ty) * nk) / k;
  k = nk;
  apply();
}
function fit() {
  stopAnim();
  k = fitScale();
  tx = (innerWidth - W * k) / 2;
  ty = 60 + (innerHeight - 60 - H * k) / 2;
  apply();
}
function visibleRect() {
  const wide = innerWidth > 640, open = isOpen(panel);
  return {
    x0: 0, y0: 56,
    x1: innerWidth - (open && wide ? panel.offsetWidth + 24 : 0),
    y1: innerHeight - (open && !wide ? panel.offsetHeight + 8 : 0),
  };
}
// Smooth zoom path (van Wijk & Nuij 2003), same curve d3.interpolateZoom uses.
function interpolateZoom(p0, p1) {
  const rho = Math.SQRT2, rho2 = 2, rho4 = 4;
  const [ux0, uy0, w0] = p0, [ux1, uy1, w1] = p1;
  const dx = ux1 - ux0, dy = uy1 - uy0, d2 = dx * dx + dy * dy;
  let S, f;
  if (d2 < 1e-12) {
    S = Math.log(w1 / w0) / rho;
    f = (t) => [ux0 + t * dx, uy0 + t * dy, w0 * Math.exp(rho * t * S)];
  } else {
    const d1 = Math.sqrt(d2);
    const b0 = (w1 * w1 - w0 * w0 + rho4 * d2) / (2 * w0 * rho2 * d1);
    const b1 = (w1 * w1 - w0 * w0 - rho4 * d2) / (2 * w1 * rho2 * d1);
    const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0), r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
    S = (r1 - r0) / rho;
    f = (t) => {
      const s = t * S, c0 = Math.cosh(r0);
      const u = (w0 / (rho2 * d1)) * (c0 * Math.tanh(rho * s + r0) - Math.sinh(r0));
      return [ux0 + u * dx, uy0 + u * dy, (w0 * c0) / Math.cosh(rho * s + r0)];
    };
  }
  f.duration = Math.abs(S) * 1000;
  return f;
}
function stopAnim() { if (anim) cancelAnimationFrame(anim); anim = null; }
// Fly to a person, or (with box = [x0, y0, x1, y1]) to fit that box on screen.
function flyTo(id, done, box) {
  const p = box ? [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2] : pos[id];
  if (!p) return;
  stopAnim();
  const v = visibleRect(), vw = v.x1 - v.x0, cx = (v.x0 + v.x1) / 2, cy = (v.y0 + v.y1) / 2;
  const k1 = box
    ? Math.min(1.6, (vw - 60) / (box[2] - box[0]), (v.y1 - v.y0 - 60) / (box[3] - box[1]))
    : Math.min(2, Math.max(k, 1.15));
  const from = [(cx - tx) / k, (cy - ty) / k, vw / k], to = [p[0], p[1], vw / k1];
  const f = interpolateZoom(from, to);
  const dur = Math.max(450, Math.min(1900, f.duration * 0.9));
  const t0 = performance.now();
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const step = (now) => {
    const t = Math.min(1, (now - t0) / dur);
    const [ux, uy, w] = f(ease(t));
    k = vw / w; tx = cx - ux * k; ty = cy - uy * k;
    apply();
    if (t < 1) anim = requestAnimationFrame(step);
    else { anim = null; done && done(); }
  };
  anim = requestAnimationFrame(step);
}

svg.addEventListener("wheel", (e) => {
  e.preventDefault();
  stopAnim();
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
  zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.0018)));
}, { passive: false });

const pointers = new Map();
let drag = null, pinch = null, lastClick = { id: null, t: 0 };
svg.addEventListener("pointerdown", (e) => {
  stopAnim();
  svg.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, [e.clientX, e.clientY]);
  if (pointers.size === 1) drag = { x: e.clientX, y: e.clientY, tx, ty, moved: false, target: e.target };
  else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) };
    if (drag) drag.moved = true;
  }
});
svg.addEventListener("pointermove", (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, [e.clientX, e.clientY]);
  if (pointers.size === 2 && pinch) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, d / pinch.d);
    pinch.d = d;
  } else if (drag) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > 4) { drag.moved = true; svg.classList.add("panning"); }
    if (drag.moved) { tx = drag.tx + dx; ty = drag.ty + dy; apply(); }
  }
});
const endPointer = (e) => {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (pointers.size === 0 && drag) {
    if (!drag.moved && e.type === "pointerup") {
      const dq = drag.target.closest && drag.target.closest(".dq[data-id]");
      const mem = !dq && drag.target.closest && drag.target.closest("[data-member]");
      const n = !dq && !mem && drag.target.closest && drag.target.closest(".n");
      if (dq) {
        // a "?" opens the disputed person's panel, scrolled to where the texts differ
        select(dq.dataset.id, { fly: true });
        const at = panelBody.querySelector(".differ, .tag.doubt");
        if (at) at.scrollIntoView({ block: "center" });
      } else if (mem) {
        // a member who is a person in the tree in their own right: go to their box
        if (mem.dataset.ref) { collapseGroup(); select(mem.dataset.ref, { fly: true }); }
        else if (expanded) showMemberPanel(expanded.id, mem.dataset.member);
      } else if (n) {
        const id = n.dataset.id, now = performance.now();
        if (lastClick.id === id && now - lastClick.t < 380) openWiki(id);
        lastClick = { id, t: now };
        select(id);
      } else {
        // a click (not a drag) on empty space closes the legend and the side panel
        setLegend(false);
        closePanel();
      }
    }
    drag = null;
    svg.classList.remove("panning");
  }
};
svg.addEventListener("pointerup", endPointer);
svg.addEventListener("pointercancel", endPointer);

// A pinch over the panel or legend zooms the page itself, as the browser does; the
// header (search, relation, zoom) is pinned to what is on screen so it never gets lost.
const vv = window.visualViewport;
if (vv) {
  const pinned = [[$("#bar"), "0 0"]];
  const pin = () => {
    const s = vv.scale, zoomed = s > 1.01 || Math.abs(vv.offsetLeft) > 1 || Math.abs(vv.offsetTop) > 1;
    const W0 = document.documentElement.clientWidth, H0 = document.documentElement.clientHeight;
    for (const [e, origin] of pinned) {
      if (!zoomed) { e.style.scale = ""; e.style.translate = ""; continue; }
      const r = { "0 0": [12, 12], "0 100%": [12, H0 - 12], "100% 0": [W0 - 12, 60] }[origin];
      const want = { "0 0": [vv.offsetLeft + 12 / s, vv.offsetTop + 12 / s],
        "0 100%": [vv.offsetLeft + 12 / s, vv.offsetTop + vv.height - 12 / s],
        "100% 0": [vv.offsetLeft + vv.width - 12 / s, vv.offsetTop + 60 / s] }[origin];
      e.style.transformOrigin = origin;
      e.style.translate = `${(want[0] - r[0]).toFixed(1)}px ${(want[1] - r[1]).toFixed(1)}px`;
      e.style.scale = (1 / s).toFixed(4);
    }
  };
  // Re-pinning on every frame of a pinch forced the whole map to repaint each frame
  // (the user saw it stutter), so wait until the gesture settles, then pin once.
  let pinTimer = 0;
  const pinSoon = () => { clearTimeout(pinTimer); pinTimer = setTimeout(pin, 150); };
  vv.addEventListener("resize", pinSoon);
  vv.addEventListener("scroll", pinSoon);
}
$("#zoomIn").onclick = () => { stopAnim(); zoomAt(innerWidth / 2, innerHeight / 2, 1.35); };
$("#zoomOut").onclick = () => { stopAnim(); zoomAt(innerWidth / 2, innerHeight / 2, 1 / 1.35); };
$("#fit").onclick = fit;

/* ---------- selection ---------- */
let sel = null;
// Inside some embeds (sandboxed iframes) history is off limits; the hash is a convenience.
const setHash = (h) => { try { history.replaceState(null, "", h || location.pathname + location.search); } catch {} };

// Light up the selected person and whoever their *visible* lines reach.
function highlight(id) {
  for (const g of gNodes.querySelectorAll(".sel, .rel")) g.classList.remove("sel", "rel");
  for (const x of gEdges.querySelectorAll(".rel")) x.classList.remove("rel");
  const fams = new Set(famOfPerson.get(id) || []);
  const relNodes = new Set([id]), litFams = new Set();
  for (const e of edgeEls) {
    if (!edgeOn(e.type)) continue;
    if (e.from === id || e.to === id || fams.has(e.from) || fams.has(e.to)) {
      e.el.classList.add("rel");
      if (e.dq) e.dq.classList.add("rel");
      for (const end of [e.from, e.to]) (famEls.has(end) ? litFams : relNodes).add(end);
    }
  }
  for (const o of DATA.overlays)
    if (ovOn(o.type) && (o.from === id || o.to === id)) { relNodes.add(o.from); relNodes.add(o.to); }
  for (const f of litFams) famEls.get(f).classList.add("rel");
  for (const r of relNodes) nodeEls.get(r) && nodeEls.get(r).classList.add("rel");
  nodeEls.get(id).classList.add("sel");
  svg.classList.add("has-sel");
}
/* ---------- expandable groups ---------- */
// A group with listed members opens into a panel of name boxes below it while the
// rest of the tree fades back; Esc, a click on empty space or another selection closes it.
const gExpand = el("g", { id: "expand" }, world);
let expanded = null;
function expandGroup(id, hit) {
  collapseGroup();
  const p = people.get(id);
  const [gx, gy] = pos[id];
  const n = p.members.length;
  const cellW = Math.max(...p.members.map((m) => Math.max(60, [...m].length * 7.6 + 22))) + 8, cellH = NH + 8;
  // as many columns as fit the visible screen at normal zoom, so the names stay readable
  const vis = visibleRect();
  const cols = Math.min(n, Math.max(3, Math.floor((vis.x1 - vis.x0 - 100) / cellW)), Math.max(3, Math.round(Math.sqrt(n * 2.4))));
  const rows = Math.ceil(n / cols);
  const W = cols * cellW + 20, H = rows * cellH + 46;
  const x0 = gx - W / 2, y0 = gy + NH / 2 + 22;
  const parent = (p.parents || []).map((l) => people.get(l.id)).find((q) => q && q.house);
  const house = parent ? parent.house : "other";
  el("path", { d: `M${gx},${gy + NH / 2}V${y0}`, class: "ex-link" }, gExpand);
  el("rect", { x: x0, y: y0, width: W, height: H, rx: 12, class: "ex-back" }, gExpand);
  el("text", { x: x0 + 14, y: y0 + 22, class: "ex-title" }, gExpand).textContent = `${p.name} · ${n}`;
  p.members.forEach((m, i) => {
    const ref = p.memberRefs && p.memberRefs[i];
    const g = el("g", { class: `n mem k-human h-${house}${m === hit ? " sel" : ""}${ref ? " mem-ref" : ""}`, "data-member": m, ...(ref && { "data-ref": ref }),
      transform: `translate(${x0 + 10 + (i % cols) * cellW},${y0 + 34 + Math.floor(i / cols) * cellH})` }, gExpand);
    el("rect", { width: cellW - 8, height: NH, rx: 7 }, g);
    el("text", { x: (cellW - 8) / 2, y: NH / 2 + 4.5, "text-anchor": "middle" }, g).textContent = m;
  });
  expanded = { id, box: [x0 - 20, gy - NH, x0 + W + 20, y0 + H + 20] };
  svg.classList.add("expanded");
  return expanded.box;
}
function collapseGroup() {
  gExpand.textContent = "";
  expanded = null;
  svg.classList.remove("expanded");
}
function showMemberPanel(gid, name) {
  const p = people.get(gid);
  for (const g of gExpand.querySelectorAll(".mem")) g.classList.toggle("sel", g.dataset.member === name);
  const parents = (p.parents || []).filter((l) => ["mother", "father", "legal-father"].includes(l.rel));
  const h = [`<h2>${esc(name)}</h2>`, `<div class="chips"><span class="tag">one of ${esc(p.name)}</span></div>`,
    `<p class="summary">${esc(p.summary || "")}</p>`];
  if (parents.length) h.push(`<h3>Parents</h3><ul>${parents.map((l) => li(PARENT_LABEL[l.rel], go(l.id), l)).join("")}</ul>`);
  if (p.membersCite) h.push(`<h3>Listed in</h3><p>${citeHTML(p.membersCite)}</p>`);
  h.push(`<p><a class="go" data-go="${esc(gid)}">← all of ${esc(p.name)}</a></p>`);
  panelBody.innerHTML = h.join("");
  if (isOpen(panel)) { panelBody.classList.remove("swap"); void panelBody.offsetWidth; panelBody.classList.add("swap"); }
  setOpen(panel, true);
}

function select(id, opts = {}) {
  if (!people.has(id)) return;
  clearPath();
  sel = id;
  highlight(id);
  refreshEdges();
  const p = people.get(id);
  const box = p.members && p.members.length ? expandGroup(id, opts.member) : (collapseGroup(), null);
  if (box && opts.member) showMemberPanel(id, opts.member);
  else showPanel(id, opts.member);
  drawOverlays();
  setHash("#" + id);
  if (opts.fly || box) flyTo(id, () => {
    const g = nodeEls.get(id);
    g.classList.remove("flash"); void g.getBBox(); g.classList.add("flash");
  }, box);
}
function clearSelection() {
  clearPath();
  collapseGroup();
  sel = null;
  svg.classList.remove("has-sel");
  for (const g of svg.querySelectorAll(".sel, .rel")) g.classList.remove("sel", "rel");
  refreshEdges();
  drawOverlays();
}
function closePanel() { setOpen(panel, false); clearSelection(); setHash(""); }
$("#panelClose").onclick = closePanel;
function openWiki(id) {
  const p = people.get(id);
  if (!p || !p.wiki) return;
  try { window.open("https://en.wikipedia.org/wiki/" + encodeURIComponent(p.wiki.replace(/ /g, "_")), "_blank", "noopener"); } catch {}
}

/* ---------- panel ---------- */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function roman(n) {
  const t = [[1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"], [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]];
  let s = "";
  for (const [v, r] of t) while (n >= v) { s += r; n -= v; }
  return s;
}
function citeHTML(c) {
  if (!c) return `<span class="unv" title="Not yet checked against the text">unverified</span>`;
  const parts = String(c).split(/\s*;\s*/).map((part) => {
    let m = part.match(/^([a-z]+)\s+([\d,\s]+)$/i);
    if (m && BOOK[m[1].toLowerCase()]) {
      const b = m[1].toLowerCase();
      const secs = m[2].split(/[,\s]+/).filter(Boolean);
      // Adi 190-199 are missing from sacred-texts (Ganguli printed them as CLXL-CLXLIX).
      const url = (s) => b === "adi" && s >= 190 && s <= 199
        ? "https://www.gutenberg.org/ebooks/15474"
        : `https://sacred-texts.com/book/${BOOK[b]}/section-${["mausala", "mahaprasthanika", "svargarohana"].includes(b) ? +s : roman(+s)}`;
      return b[0].toUpperCase() + b.slice(1) + " " + secs.map((s) =>
        `<a href="${url(+s)}" target="_blank" rel="noopener" title="Ganguli translation, section ${s}">${s}</a>`).join(", ");
    }
    m = part.match(/^PE:\s*(.+)$/i);
    if (m) return `<a href="https://archive.org/details/puranicencyclopa00maniuoft/mode/2up?q=${encodeURIComponent(m[1])}" target="_blank" rel="noopener" title="Vettam Mani, Puranic Encyclopaedia">PE “${esc(m[1])}”</a>`;
    // "CE 3.259.7, 3.260.2" or "CE 3.258.13, 14": Sanskrit Critical Edition, one GRETIL page per book.
    m = part.match(/^CE\s+(.+)$/);
    if (m) {
      let book = null, chap = null;
      const pad = (v, n) => String(v).padStart(n, "0");
      return "CE " + m[1].split(/\s*,\s*/).map((ref) => {
        const full = ref.match(/^(\d+)\.(\d+)\.(\d+)/);
        if (full) [book, chap] = [full[1], full[2]];
        const verse = full ? full[3] : (ref.match(/^\d+/) || [])[0];
        if (!book || !verse) return esc(ref);
        return `<a href="https://gretil.sub.uni-goettingen.de/gretil/1_sanskr/2_epic/mbh/mbh_${pad(book, 2)}_u.htm" target="_blank" rel="noopener" title="Sanskrit Critical Edition on GRETIL: find ${pad(book, 2)},${pad(chap, 3)}.${pad(verse, 3)} on the page">${esc(ref)}</a>`;
      }).join(", ");
    }
    // "Vishnu Purana 4.21.2": Wilson's English translation on sacred-texts, where repeated
    // chapter numbers get suffixes in book order (Book IV ch. 21 = chapter-xxi-2).
    m = part.match(/^Vishnu Purana\s+(\d+)\.(\d+)/);
    if (m) {
      const book = +m[1], ch = +m[2];
      const occ = [22, 16, 18, 24, 38, 8].slice(0, book - 1).filter((n) => n >= ch).length + 1;
      const url = `https://sacred-texts.com/book/the-vishnu-purana/chapter-${roman(ch)}${occ > 1 ? "-" + occ : ""}`;
      return `<a href="${url}" target="_blank" rel="noopener" title="Wilson's English translation, Book ${book} chapter ${ch} (checked against the Sanskrit critical edition)">${esc(part)}</a>`;
    }
    // "Ramayana 7.9.27": Valmiki Ramayana, Baroda critical edition, on GRETIL
    m = part.match(/^Ramayana\s+(\d+)\.(\d+)\.(\d+)/);
    if (m) {
      const id = `R_${m[1]},${m[2].padStart(3, "0")}.${m[3].padStart(3, "0")}`;
      return `<a href="https://gretil.sub.uni-goettingen.de/gretil/corpustei/transformations/html/sa_rAmAyaNa.htm" target="_blank" rel="noopener" title="Valmiki Ramayana, critical edition, on GRETIL: find ${id} on the page">${esc(part)}</a>`;
    }
    // "Harivamsa 25.1": the Critical Edition on GRETIL (an alphabetical pada index), one page
    m = part.match(/^Harivamsa\s+(\d+)\.([\d-]+)/);
    if (m) return `<a href="https://gretil.sub.uni-goettingen.de/gretil/1_sanskr/2_epic/mbh/ext/hv_cumiu.htm" target="_blank" rel="noopener" title="Harivamsa, Critical Edition, on GRETIL: find HV_${m[1]}.${m[2].split("-")[0]} on the page">${esc(part)}</a>`;
    // "Brahma Purana 4.8": Motilal Banarsidass translation, Part I (1955), on archive.org
    m = part.match(/^Brahma Purana\s+(\d+)\.([\d-]+)/);
    if (m) return `<a href="https://archive.org/details/dli.bengal.10689.20566/mode/2up?q=${encodeURIComponent("CHAPTER " + (["", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN"][+m[1]] || m[1]))}" target="_blank" rel="noopener" title="Brahma Purana, Motilal Banarsidass translation, Part I (1955): chapter ${m[1]}, verse ${m[2]}">${esc(part)}</a>`;
    // "Brahmavaivarta Purana 2.49": khanda.chapter, Nagar's translation (not online; plain text)
    if (/^Brahmavaivarta Purana\s+[1-4]\.\d+/.test(part)) return `<span title="Brahmavaivarta Purana, khanda.chapter: 1 Brahma, 2 Prakriti, 3 Ganesha, 4 Krishna-janma khanda">${esc(part)}</span>`;
    // "Bhagavata Purana 4.1.15": Sanskrit on GRETIL, one page
    m = part.match(/^Bhagavata Purana\s+(\d+)\.(\d+)\.(\d+)/);
    if (m) {
      const id = `bhp_${m[1].padStart(2, "0")}.${m[2].padStart(2, "0")}.${m[3].padStart(3, "0")}`;
      return `<a href="https://gretil.sub.uni-goettingen.de/gretil/corpustei/transformations/html/sa_bhAgavatapurANa.htm" target="_blank" rel="noopener" title="Bhagavata Purana, Sanskrit text on GRETIL: find ${id} on the page">${esc(part)}</a>`;
    }
    return esc(part);
  });
  return `<span class="cite">${parts.join("; ")}</span>`;
}
const go = (id, extra = "") => {
  const p = people.get(id);
  return `<a class="go" data-go="${esc(id)}">${esc(p ? p.name : id)}</a>${extra}`;
};
const kidWord = (p) => (p.sex === "f" ? "daughter" : p.sex === "m" ? "son" : "child");
const PARENT_LABEL = {
  mother: "mother", father: "father", "legal-father": "legal father", "divine-father": "divine father",
  "divine-mother": "divine mother", "adoptive-father": "adoptive father", "adoptive-mother": "adoptive mother",
  "birth-cause": "birth sparked by",
};
const KIND_LABEL = { avatar: "avatar of", portion: "portion of", rebirth: "rebirth of" };
const VER_LABEL = { folk: "folk tradition, not in the epic", later: "later retellings", purana: "from the Puranas, not the epic", ramayana: "from the Valmiki Ramayana, not the Mahabharata", harivamsa: "from the Harivamsa, the epic’s appendix", vulgate: "only in the vulgate (Ganguli’s text): the Critical Edition puts this passage in its notes" };
const VER_SHORT = { folk: "folk", later: "later", purana: "Purana", ramayana: "Ramayana", harivamsa: "Harivamsa", vulgate: "vulgate only" };
const HOUSE_LABEL = { kuru: "Kuru / Puru line", yadava: "Yadava", panchala: "Panchala" };
const DOUBT_TAG = `<span class="tag doubt" title="The texts disagree here; each version is listed with its source">? texts differ</span>`;
// A panel section of relations. Where the texts disagree, the section opens with one
// "? texts differ" tag, and each disputed relation becomes a single row of versions:
//   mother   Pushpotkata (CE 3.259.7)  or  Kaikasi (Ramayana 7.9.21–25)
// Each version's note follows, prefixed with its name.
function relSection(title, rows) {
  const groups = new Map();
  for (const r of rows) push(groups, r.key, r);
  const out = [];
  let differ = false;
  for (const rs of groups.values()) {
    if (rs.length > 1 && rs.some((r) => r.link && r.link.doubt)) {
      differ = true;
      const alt = (r) => `<span class="alt">${go(r.id)}${r.kind ? ` <span class="cite">${esc(r.kind)}</span>` : ""}${r.link.ver ? ` <span class="tag folk" title="${esc(VER_LABEL[r.link.ver] || "")}">${esc(VER_SHORT[r.link.ver] || r.link.ver)}</span>` : ""} <span class="cite">(</span>${citeHTML(r.link.cite)}<span class="cite">)</span></span>`;
      const notes = rs.filter((r) => r.link.note).map((r) => `<span class="note"><b>${esc(people.get(r.id).name)}:</b> ${esc(r.link.note)}</span>`).join("");
      out.push(`<li class="alts"><span class="rel">${esc(rs[0].label)}</span><span class="alt-list">${rs.map(alt).join(` <span class="or">or</span> `)}</span>${notes}</li>`);
    } else for (const r of rs) out.push(li(r.label, go(r.id), r.link));
  }
  return `<h3>${esc(title)}</h3>${differ ? `<p class="differ">${DOUBT_TAG}</p>` : ""}<ul>${out.join("")}</ul>`;
}
const li = (label, body, link) =>
  `<li><span class="rel">${esc(label)}</span>${body}${link && link.doubt ? " " + DOUBT_TAG : ""}${link && link.ver ? ` <span class="tag folk" title="${esc(VER_LABEL[link.ver] || "")}">${esc(VER_SHORT[link.ver] || link.ver)}</span>` : ""}${link ? " " + citeHTML(link.cite) : ""}${link && link.note ? `<span class="note">${esc(link.note)}</span>` : ""}</li>`;

const wikiCache = new Map();
function loadWikiSummary(p) {
  const box = panelBody.querySelector(".wiki");
  if (!box) return;
  const fill = (txt) => { if (sel === p.id && txt) box.innerHTML = `<b>Wikipedia:</b> ${esc(txt)}`; else if (!txt) box.remove(); };
  if (wikiCache.has(p.wiki)) return fill(wikiCache.get(p.wiki));
  fetch("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(p.wiki.replace(/ /g, "_")))
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => { const t = j && j.extract ? j.extract : ""; wikiCache.set(p.wiki, t); fill(t); })
    .catch(() => fill(""));
}

function showPanel(id, member) {
  const p = people.get(id);
  const h = [];
  h.push(`<h2>${esc(p.name)}</h2>`);
  const chips = [];
  chips.push(p.kind === "human" ? HOUSE_LABEL[p.house] || "human" : p.kind);
  if (p.title) chips.push(p.title);
  h.push(`<div class="chips">${chips.map((c) => `<span class="tag">${esc(c)}</span>`).join("")}${p.ver ? `<span class="tag folk">${esc(VER_LABEL[p.ver] || p.ver)}</span>` : ""}</div>`);
  if (p.aka && p.aka.length) h.push(`<p class="aka">Also called ${p.aka.map(esc).join(", ")}</p>`);
  // dynasty: nearest first, then the dynasties it sits inside; names fly to the founder
  if (p.dyn) {
    const chain = [];
    for (let d = dynasties.get(p.dyn); d; d = d.parent && dynasties.get(d.parent)) chain.push(d);
    const dlink = (d, label) => `<a class="go" data-go="${esc(d.founder)}" title="${esc(d.summary || "")} Founder: ${esc(people.get(d.founder).name)}.">${esc(label)}</a>`;
    const own = chain[0], founder = own.founder === id;
    h.push(`<p class="dynline" style="--h:${own.hue}"><span class="dyn-dot"></span>${founder ? "Founder of the " : ""}${dlink(own, own.name)}${chain.length > 1 ? ` <span class="dyn-in">in ${chain.slice(1).map((d) => dlink(d, d.name)).join(" › ")}</span>` : ""}</p>`);
    if (founder) h.push(`<p class="dynsum">${esc(own.summary || "")} ${citeHTML(own.cite)}</p>`);
  }
  if (p.summary) h.push(`<p class="summary">${esc(p.summary)}</p>`);
  if (p.birth) h.push(`<p class="birth"><b>Birth:</b> ${esc(p.birth)}</p>`);
  // a long list of names (the Sahasranamas) in a dropdown that scrolls inside its own
  // box, so its header, and the way to fold it, never leaves the screen
  for (const nl of (DATA.namelists || {})[id] || [])
    h.push(`<details class="names-d"><summary>${esc(nl.title)} <span class="cite">${nl.verses.length} verses</span></summary>`
      + `<p class="names-intro">${esc(nl.intro)} ${citeHTML(nl.cite)}</p><ol class="names-scroll">`
      + nl.verses.map((v) => `<li><span class="vid">${esc(v.v.split(".").pop())}</span><span class="vl">${v.lines.map(esc).join("<br>")}</span></li>`).join("")
      + `</ol></details>`);
  const acts = [];
  if (p.wiki) acts.push(`<a class="btn" href="https://en.wikipedia.org/wiki/${encodeURIComponent(p.wiki.replace(/ /g, "_"))}" target="_blank" rel="noopener">Wikipedia ↗</a>`);
  if (p.pe) acts.push(`<a class="btn" href="https://archive.org/details/puranicencyclopa00maniuoft/mode/2up?q=${encodeURIComponent(p.pe)}" target="_blank" rel="noopener" title="Vettam Mani, Puranic Encyclopaedia (1975)">Puranic Encyclopaedia ↗</a>`);
  acts.push(`<button class="btn" data-act="rel-from" data-id="${esc(id)}" title="How is ${esc(p.name)} related to someone else?">Relation to…</button>`);
  h.push(`<div class="actions">${acts.join("")}</div>`);
  const lr = lastRel && lastRel.routes[lastRel.idx];
  if (lr && lr.path.some((s) => s.id === id))
    h.push(`<a class="back" data-act="rel-back">← back to ${esc(people.get(lastRel.a).name)} → ${esc(people.get(lastRel.b).name)}</a>`);
  if (p.wiki) h.push(`<p class="wiki">Loading Wikipedia summary…</p>`);

  // lives: previous births -> this person -> merged into
  const prev = p.incarnation || [], ret = p.returned || [];
  if (prev.length || ret.length) {
    // disputed previous lives are alternatives to one another whatever their kind
    // (Draupadi: a portion of Shachi, or Sri herself), so they share one row
    const rows = prev.map((l) => l.doubt
      ? { key: "previous life", label: "previous life", id: l.of, link: l, kind: l.kind }
      : { key: "k:" + l.kind + l.of, label: KIND_LABEL[l.kind] || l.kind, id: l.of, link: l });
    for (const l of ret) rows.push({ key: "ret" + l.to, label: "after death", id: l.to, link: l });
    h.push(relSection("Lives", rows));
  }
  const born = bornAs.get(id) || [];
  if (born.length) {
    h.push(`<h3>Born on earth as</h3><ul>`);
    for (const l of born) h.push(li(l.kind, go(l.id), l));
    h.push(`</ul>`);
  }
  const same = sameAs.get(id) || [];
  if (same.length) {
    h.push(`<h3>Possibly the same being as</h3><ul>`);
    for (const l of same) h.push(li("", go(l.id), l));
    h.push(`</ul>`);
  }
  const back = returnedFrom.get(id) || [];
  if (back.length) {
    h.push(`<h3>Rejoined ${esc(p.name)} after death</h3><ul>`);
    for (const l of back) h.push(li("", go(l.id), l));
    h.push(`</ul>`);
  }

  const parents = p.parents || [];
  if (parents.length) {
    const hasLegal = parents.some((l) => l.rel === "legal-father");
    h.push(relSection("Parents", parents.map((l) => {
      const label = l.rel === "father" && hasLegal ? "biological father" : PARENT_LABEL[l.rel];
      return { key: label, label, id: l.id, link: l };
    })));
  }
  const sp = spousesOf.get(id) || [];
  if (sp.length) {
    h.push(`<h3>Spouses</h3><ul>`);
    for (const s of sp) h.push(li(people.get(s.id).sex === "f" ? "wife" : people.get(s.id).sex === "m" ? "husband" : "spouse", go(s.id), s));
    h.push(`</ul>`);
  }
  const kids = childrenOf.get(id) || [];
  if (kids.length) {
    h.push(`<h3>Children</h3><ul>`);
    for (const c of kids) {
      const cp = people.get(c.id);
      const legalElse = (cp.parents || []).some((l) => l.rel === "legal-father" && l.id !== id);
      const how = c.rel === "birth-cause" ? " (birth sparked)" : c.rel === "legal-father" ? " (legal)" : c.rel.startsWith("divine") ? " (divine)"
        : c.rel.startsWith("adoptive") ? " (adopted)" : c.rel === "father" && legalElse ? " (biological)" : "";
      // "with" names the other parent: mothers for a father, fathers for a mother —
      // never another text's alternative father
      const otherRels = c.rel === "mother" ? ["father", "legal-father"] : ["mother"];
      const other = (cp.parents || []).filter((l) => l.id !== id && otherRels.includes(l.rel)).map((l) => people.get(l.id).name);
      h.push(li(kidWord(cp) + how, go(c.id, other.length ? ` <span class="cite">with ${other.map(esc).join(", ")}</span>` : ""), c));
    }
    h.push(`</ul>`);
  }
  // siblings: share a birth or legal parent. When texts disagree, one version's parent can be
  // another version's sibling (Arihan and Mahabhauma); a parent is never also listed as a sibling.
  const sib = new Map();
  const myParents = new Set(parents.map((l) => l.id));
  for (const l of parents) {
    if (!["mother", "father", "legal-father"].includes(l.rel)) continue;
    for (const c of childrenOf.get(l.id) || []) {
      if (c.id === id || myParents.has(c.id) || !["mother", "father", "legal-father"].includes(c.rel)) continue;
      if (!sib.has(c.id)) sib.set(c.id, new Set());
      sib.get(c.id).add(people.get(l.id).name);
    }
  }
  if (sib.size) {
    h.push(`<h3>Siblings</h3><ul>`);
    for (const [sid, via] of sib) h.push(li("", go(sid, ` <span class="cite">via ${[...via].map(esc).join(", ")}</span>`)));
    h.push(`</ul>`);
  }
  if (p.members && p.members.length) {
    // a long list (Krishna's queens' sons, the Kauravas) folds away behind a dropdown
    const list = `<ul class="members">${p.members.map((m, i) => `<li${m === member ? ' class="hit"' : ""}>${p.memberRefs && p.memberRefs[i] ? go(p.memberRefs[i]) : esc(m)}</li>`).join("")}</ul>`;
    const cite = p.membersCite ? `<p>${citeHTML(p.membersCite)}</p>` : "";
    if (p.members.length > 12)
      h.push(`<details class="members-d"${member ? " open" : ""}><summary>Members (${p.members.length})</summary>${list}${cite}</details>`);
    else h.push(`<h3>Members (${p.members.length})</h3>${list}${cite}`);
  }
  if (p.notes) h.push(`<h3>Notes</h3><p>${esc(p.notes)}</p>`);
  if (p.cite) h.push(`<p>Source: ${citeHTML(p.cite)}</p>`);

  panelBody.innerHTML = h.join("");
  if (isOpen(panel)) {
    // already showing someone: cross-fade the new content in
    panelBody.classList.remove("swap"); void panelBody.offsetWidth; panelBody.classList.add("swap");
  }
  setOpen(panel, true);
  panel.scrollTop = 0;
  if (p.wiki) loadWikiSummary(p);
}
panelBody.addEventListener("click", (e) => {
  const a = e.target.closest("a.go");
  if (a) { e.preventDefault(); select(a.dataset.go, { fly: true }); }
});

/* ---------- search ---------- */
// Folds transliteration variants together: Yudhiṣṭhira / Yudhishthira / Yudhisthir -> "yudistir".
function fold(s) {
  s = s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]+/g, " ");
  s = s.replace(/([kgcjtdpb])h/g, "$1").replace(/sh/g, "s").replace(/x/g, "ks")
    .replace(/w/g, "v").replace(/b/g, "v").replace(/ee/g, "i").replace(/oo/g, "u")
    .replace(/([kgtdpvsmnjc])r[iu](?=[^aeiou ]|$)/g, "$1r")
    .replace(/(.)\1+/g, "$1");
  return s.split(" ").filter(Boolean).map((w) => (w.length > 3 ? w.replace(/[a]$/, "") : w)).join(" ");
}
function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
const index = [];
for (const p of DATA.people) {
  index.push({ key: fold(p.name), text: p.name, id: p.id, primary: true });
  for (const a of p.aka || []) index.push({ key: fold(a), text: a, id: p.id });
  for (const m of p.members || []) index.push({ key: fold(m), text: m, id: p.id, member: m });
}
for (const d of dynasties.values())
  for (const n of [d.name, ...(d.aka || [])]) index.push({ key: fold(n), text: n, id: d.founder, dyn: d.id });
function search(q) {
  const fq = fold(q);
  if (!fq) return [];
  const best = new Map();
  const maxD = fq.length >= 8 ? 2 : fq.length >= 4 ? 1 : 0;
  for (const it of index) {
    let s = 0;
    if (it.key === fq) s = 100;
    else if (it.key.startsWith(fq)) s = 86 - Math.min(12, it.key.length - fq.length) * 0.4;
    else if ((" " + it.key).includes(" " + fq)) s = 72;
    else if (it.key.includes(fq)) s = 56;
    else if (maxD) {
      let d = editDistance(fq, it.key, maxD);
      for (const w of it.key.split(" ")) d = Math.min(d, editDistance(fq, w, maxD));
      if (d <= maxD) s = 42 - d * 8;
    }
    if (!s) continue;
    s += (it.primary ? 4 : 0) - (it.member ? 6 : 0) + Math.min(6, degree(it.id) / 3);
    const key = it.id + (it.member ? "|" + it.member : "") + (it.dyn ? "#" + it.dyn : "");
    if (!best.has(key) || best.get(key).s < s) best.set(key, { s, it });
  }
  return [...best.values()].sort((a, b) => b.s - a.s).slice(0, 15);
}
let results = [], cursor = 0;
function resultLI({ it }, i, on) {
  const p = people.get(it.id), d = it.dyn && dynasties.get(it.dyn);
  const name = d ? d.name : p.name;
  const via = d ? `founded by ${esc(p.name)}` : it.member ? `one of: ${esc(it.text)}` : it.primary ? "" : `“${esc(it.text)}”`;
  const desc = d ? `${d.members.length} people` : p.title || (p.summary || "").split(/(?<=[.;])\s/)[0];
  return `<li data-i="${i}" class="${on ? "on" : ""}"><span class="r-name">${esc(name)}</span>${via ? `<span class="r-via">${via}</span>` : ""}<span class="r-desc">${esc(desc)}</span></li>`;
}
function renderResults() {
  if (!qEl.value.trim()) { resultsEl.innerHTML = ""; return; }
  if (!results.length) { resultsEl.innerHTML = `<li class="r-empty">No one by that name yet</li>`; return; }
  resultsEl.innerHTML = results.map((r, i) => resultLI(r, i, i === cursor)).join("");
  const on = resultsEl.querySelector(".on");
  on && on.scrollIntoView({ block: "nearest" });
}
function openSearch() {
  closeFinder();
  setOpen(searchEl, true);
  qEl.focus();
  qEl.select();
  results = search(qEl.value); cursor = 0; renderResults();
}
function closeSearch() { setOpen(searchEl, false); qEl.blur(); }
function choose(i) {
  const r = results[i];
  if (!r) return;
  closeSearch();
  select(r.it.id, { fly: true, member: r.it.member });
}
qEl.addEventListener("input", () => { results = search(qEl.value); cursor = 0; renderResults(); });
qEl.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") { e.preventDefault(); cursor = Math.min(results.length - 1, cursor + 1); renderResults(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); cursor = Math.max(0, cursor - 1); renderResults(); }
  else if (e.key === "Enter") { e.preventDefault(); choose(cursor); }
});
resultsEl.addEventListener("click", (e) => { const li = e.target.closest("li[data-i]"); if (li) choose(+li.dataset.i); });
searchEl.addEventListener("pointerdown", (e) => { if (e.target === searchEl) closeSearch(); });
$("#searchBtn").onclick = openSearch;

window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === "f" || e.key === "F" || e.key === "k" || e.key === "K")) { e.preventDefault(); openSearch(); return; }
  const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement && document.activeElement.tagName);
  if (e.key === "Escape") {
    if (isOpen(finder)) closeFinder();
    else if (isOpen(searchEl)) closeSearch();
    else if (isOpen(legend)) setLegend(false);
    else if (isOpen(panel)) closePanel();
    else clearSelection();
    return;
  }
  if (typing) return;
  if (e.key === "/") { e.preventDefault(); openSearch(); }
  else if ((e.key === "r" || e.key === "R") && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); rel ? openFinder(rel.a, rel.b) : openFinder(sel); }
  else if (e.key === "+" || e.key === "=") zoomAt(innerWidth / 2, innerHeight / 2, 1.3);
  else if (e.key === "-") zoomAt(innerWidth / 2, innerHeight / 2, 1 / 1.3);
});

/* ---------- relationship finder ---------- */
// Every typed link becomes two arcs, each naming the far end as seen from the near end.
// Weights prefer birth and legal links, then marriage, adoption and divine parents;
// rebirth-type links (incarnation, after death, birth sparked by) only when asked for.
const adj = new Map();
const LIFE_KINDS = new Set(["inc", "ret", "cause", "same"]);
const sexWord = (p, f, m, n) => (p && p.sex === "f" ? f : p && p.sex === "m" ? m : n);
for (const p of DATA.people) {
  const hasLegal = (p.parents || []).some((l) => l.rel === "legal-father");
  for (const l of p.parents || []) {
    if (!people.has(l.id)) continue;
    let kind = "birth", w = 1;
    if (l.rel === "birth-cause") { kind = "cause"; w = 3; }
    else if (l.rel.startsWith("divine")) { kind = "divine"; w = 1.35; }
    else if (l.rel.startsWith("adoptive")) { kind = "adoptive"; w = 1.35; }
    else if (l.rel === "legal-father") kind = "legal";
    else if (l.rel === "father" && hasLegal) { kind = "bio"; w = 1.02; }
    if (l.far) w += 0.25;
    const life = kind === "cause";
    push(adj, p.id, { to: l.id, w, kind, up: true, t: life ? "X" : "P", rel: l.rel, link: l });
    push(adj, l.id, { to: p.id, w, kind, up: false, t: life ? "X" : "C", rel: l.rel, link: l });
  }
  for (const l of p.incarnation || []) {
    if (!people.has(l.of)) continue;
    push(adj, p.id, { to: l.of, w: 2.5, kind: "inc", up: true, t: "X", link: l });
    push(adj, l.of, { to: p.id, w: 2.5, kind: "inc", up: false, t: "X", link: l });
  }
  for (const l of p.returned || []) {
    if (!people.has(l.to)) continue;
    push(adj, p.id, { to: l.to, w: 3, kind: "ret", up: true, t: "X", link: l });
    push(adj, l.to, { to: p.id, w: 3, kind: "ret", up: false, t: "X", link: l });
  }
}
for (const [id, list] of sameAs)
  for (const l of list) if (people.has(l.id)) push(adj, id, { to: l.id, w: 2, kind: "same", t: "X", link: l });
for (const [id, list] of spousesOf)
  for (const s of list) if (people.has(s.id)) push(adj, id, { to: s.id, w: s.far ? 1.45 : 1.2, kind: "spouse", t: "S", link: s });

function arcLabel(a) {
  const to = people.get(a.to);
  if (a.kind === "spouse") return sexWord(to, "wife", "husband", "spouse");
  if (a.kind === "inc") return a.up ? KIND_LABEL[a.link.kind] || "previous life" : `born as (${a.link.kind || "incarnation"})`;
  if (a.kind === "ret") return a.up ? "rejoined after death" : "rejoined after death by";
  if (a.kind === "cause") return a.up ? "birth sparked by" : "sparked the birth of";
  if (a.kind === "same") return "possibly the same as";
  if (a.up) return a.kind === "bio" ? "biological father" : PARENT_LABEL[a.rel];
  return kidWord(to) + ({ legal: " (legal)", divine: " (divine)", adoptive: " (adopted)", bio: " (biological)" }[a.kind] || "");
}

// a small binary heap for Dijkstra
function heapPush(h, x) {
  h.push(x);
  for (let i = h.length - 1; i > 0;) {
    const p = (i - 1) >> 1;
    if (h[p][0] <= h[i][0]) break;
    [h[p], h[i]] = [h[i], h[p]]; i = p;
  }
}
function heapPop(h) {
  const top = h[0], last = h.pop();
  if (h.length) {
    h[0] = last;
    for (let i = 0; ;) {
      const l = 2 * i + 1, r = l + 1;
      let m = i;
      if (l < h.length && h[l][0] < h[m][0]) m = l;
      if (r < h.length && h[r][0] < h[m][0]) m = r;
      if (m === i) break;
      [h[m], h[i]] = [h[i], h[m]]; i = m;
    }
  }
  return top;
}
const arcOk = (arc, lives) => lives || !LIFE_KINDS.has(arc.kind);
// Passing *through* a group box ("The other Kauravas") or a god is allowed but costs
// extra, so a human family route wins over a shortcut via Kashyapa or Surya.
const arcCost = (arc, dst) => {
  if (arc.to === dst) return arc.w;
  const k = people.get(arc.to).kind;
  return arc.w + (k === "group" ? 1.5 : k === "god" ? 1 : 0);
};
function shortest(src, dst, ok, banNodes = new Set(), banArcs = new Set(), cost = arcCost) {
  const dist = new Map([[src, 0]]), prev = new Map(), done = new Set(), h = [[0, src]];
  while (h.length) {
    const [d, u] = heapPop(h);
    if (done.has(u)) continue;
    done.add(u);
    if (u === dst) break;
    for (const arc of adj.get(u) || []) {
      if (!ok(arc) || banNodes.has(arc.to) || banArcs.has(arc)) continue;
      const nd = d + cost(arc, dst);
      if (nd < (dist.has(arc.to) ? dist.get(arc.to) : Infinity)) { dist.set(arc.to, nd); prev.set(arc.to, [u, arc]); heapPush(h, [nd, arc.to]); }
    }
  }
  if (src !== dst && !prev.has(dst)) return null;
  const path = [];
  for (let v = dst; v !== src;) { const [u, arc] = prev.get(v); path.unshift({ id: v, arc }); v = u; }
  return [{ id: src }, ...path];
}
const pathCost = (path) => path.slice(1).reduce((s, st) => s + arcCost(st.arc, path[path.length - 1].id), 0);
const pathKey = (path) => path.map((s) => s.id).join(">");
// A detour route has a "chord": two of its people are linked directly, so a shorter
// route says the same thing. Only chord-free alternatives are offered.
function hasChord(path, ok) {
  const at = new Map(path.map((s, i) => [s.id, i]));
  for (let i = 0; i < path.length; i++)
    for (const arc of adj.get(path[i].id) || [])
      if (ok(arc) && at.has(arc.to) && at.get(arc.to) > i + 1) return true;
  return false;
}
// Yen's k-shortest simple paths.
function kShortest(a, b, ok, K) {
  const first = shortest(a, b, ok);
  if (!first) return [];
  const A = [first], cand = new Map();
  for (let k = 1; k < K; k++) {
    const last = A[k - 1];
    for (let i = 0; i < last.length - 1; i++) {
      const root = last.slice(0, i + 1);
      const banArcs = new Set(), banNodes = new Set(root.slice(0, -1).map((s) => s.id));
      for (const p of A)
        if (p.length > i + 1 && root.every((s, j) => p[j].id === s.id && p[j].arc === s.arc)) banArcs.add(p[i + 1].arc);
      const spur = shortest(root[i].id, b, ok, banNodes, banArcs);
      if (!spur) continue;
      const total = [...root, ...spur.slice(1)];
      const key = pathKey(total) + "|" + total.slice(1).map((s) => s.arc.kind).join(",");
      if (!cand.has(key) && !A.some((p) => pathKey(p) === pathKey(total))) cand.set(key, total);
    }
    if (!cand.size) break;
    let bestKey = null, best = Infinity;
    for (const [key, p] of cand) { const c = pathCost(p); if (c < best) { best = c; bestKey = key; } }
    A.push(cand.get(bestKey));
    cand.delete(bestKey);
  }
  return A;
}
// A line of descent is read through fathers (legal before biological) and only falls
// back on a mother, and then on adoption or a divine parent, where it must.
// A long-range link (most alternative king-list versions are drawn that way) costs a
// little more, so the main drawn line wins when both lead to the same ancestor.
const lineCost = (arc) => (arc.kind === "adoptive" || arc.kind === "divine" ? 1e4 : arc.rel === "mother" ? 100 : 1) + (arc.link && arc.link.far ? 0.5 : 0);
// Routes to offer: the direct line of descent if one exists (however long), the
// shortest route, and up to two more that read differently and stay simple
// ("brother-in-law", "first cousin"), never detours of a shorter route.
// The genealogist's answer for blood kin: climb from both people through parents only
// and meet at the nearest common ancestor, however many generations up. A god as the
// meeting point costs a little extra, adoption and divine parentage more.
function ancestors(src) {
  const dist = new Map([[src, 0]]), prev = new Map(), done = new Set(), h = [[0, src]];
  while (h.length) {
    const [d, u] = heapPop(h);
    if (done.has(u)) continue;
    done.add(u);
    for (const arc of adj.get(u) || []) {
      if (arc.t !== "P") continue;
      const nd = d + (arc.kind === "adoptive" || arc.kind === "divine" ? 3 : 1);
      if (nd < (dist.has(arc.to) ? dist.get(arc.to) : Infinity)) { dist.set(arc.to, nd); prev.set(arc.to, [u, arc]); heapPush(h, [nd, arc.to]); }
    }
  }
  return { dist, prev };
}
const downArc = (up, child) => (adj.get(up.to) || []).find((x) => x.to === child && x.link === up.link && x.t === "C");
function commonAncestorRoute(a, b) {
  if (a === b) return null;
  const A = ancestors(a), B = ancestors(b);
  let best = null, bc = Infinity;
  for (const [x, da] of A.dist) {
    if (!B.dist.has(x)) continue;
    const c = da + B.dist.get(x) + (people.get(x).kind === "god" ? 0.5 : 0);
    if (c < bc) { bc = c; best = x; }
  }
  if (!best || best === a || best === b) return null;
  const path = [];
  for (let v = best; v !== a;) { const [u, arc] = A.prev.get(v); path.unshift({ id: v, arc }); v = u; }
  path.unshift({ id: a });
  // B.prev maps each ancestor to the child below it on the way up from b
  for (let v = best; v !== b;) {
    const [u, arc] = B.prev.get(v), d = downArc(arc, u);
    if (!d) return null;
    path.push({ id: u, arc: d });
    v = u;
  }
  return path;
}
function findRoutes(a, b, lives) {
  const ok = (arc) => arcOk(arc, lives);
  const yen = kShortest(a, b, ok, 12);
  const line = a === b ? null : shortest(a, b, (arc) => arc.t === "P", undefined, undefined, lineCost)
    || shortest(a, b, (arc) => arc.t === "C", undefined, undefined, lineCost);
  const lca = line ? null : commonAncestorRoute(a, b);
  if (!yen.length) return [];
  const top = pathCost(yen[0]), out = [], seenIds = new Set(), seenPhrase = new Set();
  const add = (p) => {
    const ids = pathKey(p), ph = kinPhrase(p) || "~" + ids;
    if (seenIds.has(ids) || seenPhrase.has(ph)) return;
    seenIds.add(ids); seenPhrase.add(ph);
    out.push({ path: p });
  };
  // The common ancestor leads only when the shortest route can't be said simply:
  // Rama -> Krishna (a 19-link tangle) yes, Draupadi -> Kunti (mother-in-law) no.
  const simple = (p) => { const k = kinParts(p); return !!k && k.blood <= 1; };
  const first = line || (lca && !(simple(yen[0]) && pathCost(yen[0]) <= pathCost(lca)) ? lca : null);
  if (first) add(first);
  else add(yen[0]);
  const rest = [...(first ? yen : yen.slice(1)), ...(lca && lca !== first ? [lca] : [])];
  for (const p of rest) {
    if (out.length >= 4) break;
    const k = kinParts(p);
    if (!k || k.blood > 1 || pathCost(p) > top * 1.6 + 1.5 || hasChord(p, ok)) continue;
    add(p);
  }
  return out;
}

// English kinship words for a route: runs of up-steps then down-steps become
// grandfather / half-brother / second cousin once removed; marriages join them.
const GREAT = (n) => (n <= 0 ? "" : n === 1 ? "great-" : n === 2 ? "great-great-" : `${n}× great-`);
const ORD = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];
const ordinal = (n) => ORD[n] || n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th");
const coreParents = (id) => new Set((people.get(id).parents || []).filter((l) => ["mother", "father", "legal-father"].includes(l.rel)).map((l) => l.id));
function bloodTerm(a, b, fromId, toId, steps) {
  const B = people.get(toId), g = (f, m, n) => sexWord(B, f, m, n);
  let w;
  if (a && !b) w = a === 1 ? arcLabel(steps[0].arc) : GREAT(a - 2) + g("grandmother", "grandfather", "grandparent");
  else if (!a && b) w = b === 1 ? arcLabel(steps[0].arc) : GREAT(b - 2) + g("granddaughter", "grandson", "grandchild");
  else if (a === 1 && b === 1) {
    const pa = coreParents(fromId), pb = coreParents(toId);
    const full = pa.size >= 2 && pa.size === pb.size && [...pa].every((x) => pb.has(x));
    w = (full ? "" : "half-") + g("sister", "brother", "sibling");
  } else if (a === 1) w = (b === 2 ? "" : GREAT(b - 3) + "grand") + g("niece", "nephew", "nephew or niece");
  else if (b === 1) w = GREAT(a - 2) + g("aunt", "uncle", "uncle or aunt");
  else {
    const d = Math.min(a, b) - 1, r = Math.abs(a - b);
    w = `${ordinal(d)} cousin` + (r ? ` ${r === 1 ? "once" : r === 2 ? "twice" : r + " times"} removed` : "");
  }
  if (a + b > 1) {
    const kinds = new Set(steps.map((s) => s.arc.kind));
    const q = [kinds.has("divine") && "through a divine parent", kinds.has("adoptive") && "through adoption"].filter(Boolean);
    if (q.length) w += ` (${q.join(", ")})`;
  }
  return w;
}
function kinPhrase(path) { const k = kinParts(path); return k && k.phrase; }
function kinParts(path) {
  const steps = path.slice(1);
  if (!steps.length || steps.some((s) => s.arc.t === "X")) return null;
  const parts = [];
  for (let i = 0; i < steps.length;) {
    if (steps[i].arc.t === "S") { parts.push({ k: "S", w: arcLabel(steps[i].arc) }); i++; continue; }
    let j = i;
    while (j < steps.length && steps[j].arc.t === "P") j++;
    let e = j;
    while (e < steps.length && steps[e].arc.t === "C") e++;
    const from = i ? steps[i - 1].id : path[0].id;
    parts.push({ k: "B", a: j - i, b: e - j, w: bloodTerm(j - i, e - j, from, steps[e - 1].id, steps.slice(i, e)) });
    i = e;
  }
  const B = people.get(path[path.length - 1].id), g = (f, m, n) => sexWord(B, f, m, n);
  const is = (p, a, b) => p.k === "B" && p.a === a && p.b === b;
  const one = (phrase) => ({ phrase, blood: 1 });
  if (parts.length === 2) {
    const [x, y] = parts;
    if (x.k === "S" && is(y, 1, 0)) return one(g("mother", "father", "parent") + "-in-law");
    if ((x.k === "S" && is(y, 1, 1)) || (is(x, 1, 1) && y.k === "S")) return one(g("sister", "brother", "sibling") + "-in-law");
    if (is(x, 0, 1) && y.k === "S") return one(g("daughter", "son", "child") + "-in-law");
    if (is(x, 1, 0) && y.k === "S") return one("step" + g("mother", "father", "parent"));
    if (x.k === "S" && is(y, 0, 1)) return one("step" + g("daughter", "son", "child"));
  }
  if (parts.length > 3) return null;
  return { phrase: parts.map((p) => p.w).join("’s "), blood: parts.filter((p) => p.k === "B").length };
}

const gPath = el("g", { id: "pathLayer" });
world.insertBefore(gPath, gNodes);
const gPathTop = el("g", { id: "pathTop" }, world);
let rel = null, lastRel = null;
function clearPath() {
  rel = null;
  pathLabels = [];
  gPath.textContent = "";
  gPathTop.textContent = "";
  svg.classList.remove("has-path");
  for (const g of gNodes.querySelectorAll(".on-path")) g.classList.remove("on-path", "end");
}
function pathSeg(u, v) {
  const a = pos[u], b = pos[v];
  const dx = b[0] - a[0], dy = b[1] - a[1], dist = Math.hypot(dx, dy) || 1;
  const bend = Math.min(0.12 * dist, 140);
  const c = [(a[0] + b[0]) / 2 - (dy / dist) * bend, (a[1] + b[1]) / 2 + (dx / dist) * bend];
  const s = clip(a, people.get(u).w, c), t = clip(b, people.get(v).w, c);
  return `M${s[0].toFixed(1)},${s[1].toFixed(1)}Q${c[0].toFixed(1)},${c[1].toFixed(1)} ${t[0].toFixed(1)},${t[1].toFixed(1)}`;
}
function drawPath(fly) {
  gPath.textContent = "";
  gPathTop.textContent = "";
  for (const g of gNodes.querySelectorAll(".on-path")) g.classList.remove("on-path", "end");
  svg.classList.add("has-path");
  const r = rel.routes[rel.idx];
  const ids = r ? r.path.map((s) => s.id) : [rel.a, rel.b];
  for (let i = 1; r && i < ids.length; i++) {
    const d = pathSeg(ids[i - 1], ids[i]);
    el("path", { d, class: "pl" }, gPath);
    el("path", { d, class: "pl-flow" }, gPath);
  }
  for (const id of ids) nodeEls.get(id).classList.add("on-path");
  for (const id of [rel.a, rel.b]) nodeEls.get(id).classList.add("end");
  pathLabels = ids.map((id) => {
    const t = el("text", { class: "pl-name" + (id === rel.a || id === rel.b ? " end" : ""), "text-anchor": "middle" }, gPathTop);
    t.textContent = people.get(id).name;
    return { el: t, x: pos[id][0], y: pos[id][1] };
  });
  sizePathLabels();
  if (!fly) return;
  const xs = ids.map((id) => pos[id][0]), ys = ids.map((id) => pos[id][1]);
  const pad = 90;
  flyTo(null, null, [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad]);
}
const LIFE_WORD = { inc: "an incarnation or rebirth", ret: "a reunion after death", cause: "a birth sparked by someone", same: "two names that may be one being" };
const lower = (s) => s.replace(/^The /, "the ");
function relSentence(path) {
  const A = people.get(path[0].id), B = people.get(path[path.length - 1].id), n = path.length - 1;
  if (!n) return "The same person.";
  const ph = kinPhrase(path);
  if (!ph) {
    const s1 = path[1].arc, s2 = path[2] && path[2].arc;
    if (n === 2 && s1.kind === "inc" && s1.up && s2.kind === "inc" && !s2.up)
      return `<b>${esc(A.name)}</b> and <b>${esc(B.name)}</b> are both incarnations of <b class="term">${esc(people.get(path[1].id).name)}</b>.`;
    if (n === 1 && s1.kind === "same") return `<b>${esc(A.name)}</b> and <b>${esc(B.name)}</b> <b class="term">may be the same being</b>; the texts disagree.`;
    if (n === 1 && s1.kind === "inc") return `<b>${esc(A.name)}</b> is ${s1.up ? "an incarnation of" : "born again as"} <b class="term">${esc(B.name)}</b>.`;
    const life = [...new Set(path.slice(1).map((s) => s.arc.kind).filter((k) => LIFE_KINDS.has(k)))].map((k) => LIFE_WORD[k]);
    return `${n} links apart${life.length ? ", through " + life.join(" and ") : ""}.`;
  }
  const term = `<b class="term">${esc(ph)}</b>`;
  // for cousins and the like, name the common ancestor and the generations on each side
  const ts = path.slice(1).map((s) => s.arc.t).join(""), m = ts.match(/^(P+)(C+)$/);
  const apex = m && m[1].length + m[2].length >= 3 ? ` <span class="apex">Common ancestor: ${go(path[m[1].length].id)}, ${m[1].length} generation${m[1].length > 1 ? "s" : ""} above ${esc(A.name)} and ${m[2].length} above ${esc(B.name)}.</span>` : "";
  if (B.kind === "group") return `Each of <b>${esc(lower(B.name))}</b> is ${esc(A.name)}’s ${term}.${apex}`;
  if (A.kind === "group") return `<b>${esc(B.name)}</b> is the ${term} of each of ${esc(lower(A.name))}.${apex}`;
  return `<b>${esc(B.name)}</b> is ${esc(A.name)}’s ${term}.${apex}`;
}
function relate(a, b, opts = {}) {
  if (!people.has(a) || !people.has(b)) return;
  closeFinder();
  clearSelection();
  let lives = !!opts.lives, auto = false;
  let routes = findRoutes(a, b, lives);
  if (!routes.length && !lives) { routes = findRoutes(a, b, true); if (routes.length) { lives = true; auto = true; } }
  // with rebirth-type links off, say so when they would make the chain much shorter
  let hint = null;
  if (!lives) {
    const lr = shortest(a, b, () => true);
    const c0 = routes.length ? Math.min(...routes.map((r) => pathCost(r.path))) : Infinity;
    if (lr && pathCost(lr) + 2 < c0) hint = lr;
  }
  rel = lastRel = { a, b, routes, idx: 0, lives, auto, hint };
  showRelation(true);
  setHash("#" + a + "~" + b);
}
function showRelation(fly) {
  const { a, b, routes, idx, lives, auto, hint } = rel;
  const A = people.get(a), B = people.get(b);
  const h = [`<h2>${esc(A.name)} <span class="rel-arrow">→</span> ${esc(B.name)}</h2>`];
  if (!routes.length) h.push(`<p class="kin">No chain of recorded links joins ${esc(A.name)} and ${esc(B.name)} yet.</p>`);
  else {
    const r = routes[idx], n = r.path.length - 1;
    h.push(`<p class="kin">${relSentence(r.path)}</p>`);
    if (hint) {
      const n = hint.length - 1, say = n <= 2 && !kinPhrase(hint) ? relSentence(hint).replace(/<[^>]*>/g, "") : "";
      h.push(`<p class="cite">${say ? esc(say) + " " : ""}Through a rebirth, incarnation or similar link they are only ${n} link${n === 1 ? "" : "s"} apart. <a class="back" data-act="lives-on">Show that route</a></p>`);
    }
    if (auto) h.push(`<p class="cite">Only rebirth or incarnation links connect them, so those were switched on.</p>`);
    if (routes.length > 1)
      h.push(`<h3>Routes</h3><div class="routes">${routes.map((x, i) =>
        `<button class="btn${i === idx ? " on" : ""}" data-route="${i}">${esc(kinPhrase(x.path) || x.path.length - 1 + " links")}</button>`).join("")}</div>`);
    h.push(`<h3>Chain · ${n} link${n === 1 ? "" : "s"}</h3><ol class="chain"><li>${go(a)}</li>`);
    r.path.slice(1).forEach((s, i) => h.push(li(arcLabel(s.arc), go(s.id), s.arc.link).replace("<li>", i === n - 1 ? '<li class="c-end">' : "<li>")));
    h.push(`</ol>`);
  }
  h.push(`<label class="f-opt"><input type="checkbox" data-act="lives"${lives ? " checked" : ""}> also through rebirths, incarnations and “birth sparked by”</label>`);
  h.push(`<div class="actions"><button class="btn" data-act="swap">⇅ Swap</button><button class="btn" data-act="edit">Change people…</button></div>`);
  panelBody.innerHTML = h.join("");
  if (isOpen(panel)) { panelBody.classList.remove("swap"); void panelBody.offsetWidth; panelBody.classList.add("swap"); }
  setOpen(panel, true);
  panel.scrollTop = 0;
  drawPath(fly);
}
panelBody.addEventListener("click", (e) => {
  const rb = e.target.closest("[data-route]");
  if (rb && rel) { rel.idx = +rb.dataset.route; showRelation(true); return; }
  const act = e.target.closest("[data-act]");
  if (!act) return;
  const k = act.dataset.act;
  if (k === "swap" && rel) relate(rel.b, rel.a, { lives: rel.lives });
  else if (k === "edit" && rel) openFinder(rel.a, rel.b);
  else if (k === "rel-from") openFinder(act.dataset.id);
  else if (k === "lives-on" && rel) relate(rel.a, rel.b, { lives: true });
  else if (k === "rel-back" && lastRel) relate(lastRel.a, lastRel.b, { lives: lastRel.lives });
});
panelBody.addEventListener("change", (e) => {
  if (e.target.dataset.act === "lives" && rel) relate(rel.a, rel.b, { lives: e.target.checked });
});

// the two-person picker
const finder = $("#finder"), fA = $("#fA"), fB = $("#fB"), fRes = $("#fResults"), fLives = $("#fLives");
const pick = { fA: null, fB: null };
let fField = fA, fResults = [], fCursor = 0;
function fRender() {
  if (!fField.value.trim() || pick[fField.id]) { fRes.innerHTML = ""; return; }
  fRes.innerHTML = fResults.length ? fResults.map((r, i) => resultLI(r, i, i === fCursor)).join("") : `<li class="r-empty">No one by that name yet</li>`;
  const on = fRes.querySelector(".on");
  on && on.scrollIntoView({ block: "nearest" });
}
function fSet(input, id) {
  pick[input.id] = id || null;
  input.value = id ? people.get(id).name : "";
  input.classList.toggle("picked", !!id);
}
function openFinder(a, b) {
  closeSearch();
  fSet(fA, a && people.has(a) ? a : null);
  fSet(fB, b && people.has(b) ? b : null);
  if (rel) fLives.checked = rel.lives;
  setOpen(finder, true);
  fField = pick.fA && !pick.fB ? fB : fA;
  fResults = []; fCursor = 0;
  fField.focus(); fField.select();
  fRender();
}
function closeFinder() { setOpen(finder, false); fA.blur(); fB.blur(); }
function fGo() { if (pick.fA && pick.fB) relate(pick.fA, pick.fB, { lives: fLives.checked }); }
function fChoose(i) {
  const r = fResults[i];
  if (!r) return;
  fSet(fField, r.it.id);
  fResults = [];
  fRender();
  if (pick.fA && pick.fB) fGo();
  else { fField = pick.fA ? fB : fA; fField.focus(); }
}
for (const input of [fA, fB]) {
  input.addEventListener("focus", () => {
    fField = input;
    fResults = pick[input.id] ? [] : search(input.value); fCursor = 0;
    fRender();
  });
  input.addEventListener("input", () => {
    pick[input.id] = null; input.classList.remove("picked");
    fResults = search(input.value); fCursor = 0;
    fRender();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); fCursor = Math.min(fResults.length - 1, fCursor + 1); fRender(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); fCursor = Math.max(0, fCursor - 1); fRender(); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (!pick[input.id]) fChoose(fCursor);
      else if (pick.fA && pick.fB) fGo();
      else (input === fA ? fB : fA).focus();
    }
  });
}
fRes.addEventListener("pointerdown", (e) => e.preventDefault());
fRes.addEventListener("click", (e) => { const x = e.target.closest("li[data-i]"); if (x) fChoose(+x.dataset.i); });
finder.addEventListener("pointerdown", (e) => { if (e.target === finder) closeFinder(); });
$("#fSwap").onclick = () => {
  const a = pick.fA, b = pick.fB, va = fA.value, vb = fB.value;
  fSet(fA, b); fSet(fB, a);
  if (!b) fA.value = vb;
  if (!a) fB.value = va;
  if (a && b) fGo(); else fField.focus();
};
$("#relBtn").onclick = () => (rel ? openFinder(rel.a, rel.b) : openFinder(sel));

/* ---------- start ---------- */
const zoomTo = (id, kk) => { const p = pos[id]; if (!p) return; stopAnim(); k = kk; tx = innerWidth / 2 - p[0] * k; ty = innerHeight / 2 - p[1] * k; apply(); };
window.__tree = { select, clearSelection, search, fold, flyTo, fit, zoomTo, relate, findRoutes, kinPhrase };
refreshEdges();
const start = decodeURIComponent(location.hash.slice(1));
const [ra, rb] = start.split("~");
if (rb && people.has(ra) && people.has(rb)) {
  fit();
  relate(ra, rb);
} else if (start && people.has(start)) {
  const p = pos[start];
  k = 1; tx = innerWidth / 2 - p[0]; ty = innerHeight / 2 - p[1]; apply();
  select(start, { fly: true });
} else {
  const home = pos[DATA.home] || pos[DATA.people[0].id];
  k = 0.85; tx = innerWidth / 2 - home[0] * k; ty = innerHeight / 2 - home[1] * k; apply();
}
drawOverlays();
})();
