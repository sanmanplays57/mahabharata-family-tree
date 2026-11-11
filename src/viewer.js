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
const childrenOf = new Map(), spousesOf = new Map(), bornAs = new Map(), returnedFrom = new Map();
for (const p of DATA.people) {
  for (const l of p.parents || []) push(childrenOf, l.id, { ...l, id: p.id });
  for (const s of p.spouses || []) {
    push(spousesOf, p.id, s);
    push(spousesOf, s.id, { ...s, id: p.id });
  }
  for (const l of p.incarnation || []) push(bornAs, l.of, { ...l, id: p.id });
  for (const l of p.returned || []) push(returnedFrom, l.to, { ...l, id: p.id });
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
  const t = el("text", { x: w / 2, y: NH / 2 + 4.5, "text-anchor": "middle" }, g);
  t.textContent = p.name;
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
  const bend = Math.min(0.18 * dist, 420) * ({ divine: 1, incarnation: 1.5, returned: 1.2, far: 0.75 }[o.type] || 1);
  const c = [(a[0] + b[0]) / 2 - (dy / dist) * bend, (a[1] + b[1]) / 2 + (dx / dist) * bend];
  const s = clip(a, people.get(o.from).w, c), t = clip(b, people.get(o.to).w, c);
  return `M${s[0].toFixed(1)},${s[1].toFixed(1)}Q${c[0].toFixed(1)},${c[1].toFixed(1)} ${t[0].toFixed(1)},${t[1].toFixed(1)}`;
}
// Legend checkboxes decide which line types are drawn at all; an unticked type stays
// hidden even for the selected person (the side panel still lists every relation).
// Ticked arrow types: everyone's arrows when nothing is selected, only the selected
// person's arrows when someone is.
const OV_TOGGLES = { divine: $("#tDivine"), incarnation: $("#tInc"), returned: $("#tReturned"), far: $("#tFar") };
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
    const path = el("path", { d, class: "ov ov-" + o.type, "marker-end": `url(#m-${o.type})` }, gOver);
    const tip = el("title", {}, path);
    const verb = o.type === "divine" ? "fathered" : o.type === "far" ? "is a distant parent of"
      : o.type === "returned" ? "rejoined after death:" : (o.kind || "incarnation") + " →";
    tip.textContent = `${people.get(o.from).name} ${verb} ${people.get(o.to).name}`;
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
const apply = () => {
  world.setAttribute("transform", `translate(${tx.toFixed(2)},${ty.toFixed(2)}) scale(${k.toFixed(5)})`);
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
function flyTo(id, done) {
  const p = pos[id];
  if (!p) return;
  stopAnim();
  const v = visibleRect(), vw = v.x1 - v.x0, cx = (v.x0 + v.x1) / 2, cy = (v.y0 + v.y1) / 2;
  const k1 = Math.min(2, Math.max(k, 1.15));
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
      const n = drag.target.closest && drag.target.closest(".n");
      if (n) {
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
function select(id, opts = {}) {
  if (!people.has(id)) return;
  sel = id;
  highlight(id);
  refreshEdges();
  showPanel(id, opts.member);
  drawOverlays();
  setHash("#" + id);
  if (opts.fly) flyTo(id, () => {
    const g = nodeEls.get(id);
    g.classList.remove("flash"); void g.getBBox(); g.classList.add("flash");
  });
}
function clearSelection() {
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
};
const KIND_LABEL = { avatar: "avatar of", portion: "portion of", rebirth: "rebirth of" };
const VER_LABEL = { folk: "folk tradition, not in the epic", later: "later retellings", purana: "from the Puranas, not the epic" };
const VER_SHORT = { folk: "folk", later: "later", purana: "Purana" };
const HOUSE_LABEL = { kuru: "Kuru / Puru line", yadava: "Yadava", panchala: "Panchala" };
const li = (label, body, link) =>
  `<li><span class="rel">${esc(label)}</span>${body}${link && link.ver ? ` <span class="tag folk">${esc(VER_SHORT[link.ver] || link.ver)}</span>` : ""}${link ? " " + citeHTML(link.cite) : ""}${link && link.note ? `<span class="note">${esc(link.note)}</span>` : ""}</li>`;

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
  chips.push(p.kind === "human" ? (HOUSE_LABEL[p.house] || p.house || "human") : p.kind);
  if (p.title) chips.push(p.title);
  h.push(`<div class="chips">${chips.map((c) => `<span class="tag">${esc(c)}</span>`).join("")}${p.ver ? `<span class="tag folk">${esc(VER_LABEL[p.ver] || p.ver)}</span>` : ""}</div>`);
  if (p.aka && p.aka.length) h.push(`<p class="aka">Also called ${p.aka.map(esc).join(", ")}</p>`);
  if (p.summary) h.push(`<p class="summary">${esc(p.summary)}</p>`);
  if (p.birth) h.push(`<p class="birth"><b>Birth:</b> ${esc(p.birth)}</p>`);
  const acts = [];
  if (p.wiki) acts.push(`<a class="btn" href="https://en.wikipedia.org/wiki/${encodeURIComponent(p.wiki.replace(/ /g, "_"))}" target="_blank" rel="noopener">Wikipedia ↗</a>`);
  if (p.pe) acts.push(`<a class="btn" href="https://archive.org/details/puranicencyclopa00maniuoft/mode/2up?q=${encodeURIComponent(p.pe)}" target="_blank" rel="noopener" title="Vettam Mani, Puranic Encyclopaedia (1975)">Puranic Encyclopaedia ↗</a>`);
  if (acts.length) h.push(`<div class="actions">${acts.join("")}</div>`);
  if (p.wiki) h.push(`<p class="wiki">Loading Wikipedia summary…</p>`);

  // lives: previous births -> this person -> merged into
  const prev = p.incarnation || [], ret = p.returned || [];
  if (prev.length || ret.length) {
    h.push(`<h3>Lives</h3><ul>`);
    for (const l of prev) h.push(li(KIND_LABEL[l.kind] || l.kind, go(l.of), l));
    for (const l of ret) h.push(li("after death", go(l.to), l));
    h.push(`</ul>`);
  }
  const born = bornAs.get(id) || [];
  if (born.length) {
    h.push(`<h3>Born on earth as</h3><ul>`);
    for (const l of born) h.push(li(l.kind, go(l.id), l));
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
    h.push(`<h3>Parents</h3><ul>`);
    for (const l of parents) {
      const label = l.rel === "father" && hasLegal ? "biological father" : PARENT_LABEL[l.rel];
      h.push(li(label, go(l.id), l));
    }
    h.push(`</ul>`);
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
      const how = c.rel === "legal-father" ? " (legal)" : c.rel.startsWith("divine") ? " (divine)"
        : c.rel.startsWith("adoptive") ? " (adopted)" : c.rel === "father" && legalElse ? " (biological)" : "";
      const other = (cp.parents || []).filter((l) => l.id !== id && ["mother", "father", "legal-father"].includes(l.rel)).map((l) => people.get(l.id).name);
      h.push(li(kidWord(cp) + how, go(c.id, other.length ? ` <span class="cite">with ${other.map(esc).join(", ")}</span>` : ""), c));
    }
    h.push(`</ul>`);
  }
  // siblings: share a birth or legal parent
  const sib = new Map();
  for (const l of parents) {
    if (!["mother", "father", "legal-father"].includes(l.rel)) continue;
    for (const c of childrenOf.get(l.id) || []) {
      if (c.id === id || !["mother", "father", "legal-father"].includes(c.rel)) continue;
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
    h.push(`<h3>Members (${p.members.length})</h3><ul class="members">${p.members.map((m) => `<li${m === member ? ' class="hit"' : ""}>${esc(m)}</li>`).join("")}</ul>`);
    if (p.membersCite) h.push(`<p>${citeHTML(p.membersCite)}</p>`);
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
    const key = it.id + (it.member ? "|" + it.member : "");
    if (!best.has(key) || best.get(key).s < s) best.set(key, { s, it });
  }
  return [...best.values()].sort((a, b) => b.s - a.s).slice(0, 15);
}
let results = [], cursor = 0;
function renderResults() {
  if (!qEl.value.trim()) { resultsEl.innerHTML = ""; return; }
  if (!results.length) { resultsEl.innerHTML = `<li class="r-empty">No one by that name yet</li>`; return; }
  resultsEl.innerHTML = results.map(({ it }, i) => {
    const p = people.get(it.id);
    const via = it.member ? `one of: ${esc(it.text)}` : it.primary ? "" : `“${esc(it.text)}”`;
    const desc = p.title || (p.summary || "").split(/(?<=[.;])\s/)[0];
    return `<li data-i="${i}" class="${i === cursor ? "on" : ""}"><span class="r-name">${esc(p.name)}</span>${via ? `<span class="r-via">${via}</span>` : ""}<span class="r-desc">${esc(desc)}</span></li>`;
  }).join("");
  const on = resultsEl.querySelector(".on");
  on && on.scrollIntoView({ block: "nearest" });
}
function openSearch() {
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
    if (isOpen(searchEl)) closeSearch();
    else if (isOpen(legend)) setLegend(false);
    else if (isOpen(panel)) closePanel();
    else clearSelection();
    return;
  }
  if (typing) return;
  if (e.key === "/") { e.preventDefault(); openSearch(); }
  else if (e.key === "+" || e.key === "=") zoomAt(innerWidth / 2, innerHeight / 2, 1.3);
  else if (e.key === "-") zoomAt(innerWidth / 2, innerHeight / 2, 1 / 1.3);
});

/* ---------- start ---------- */
window.__tree = { select, clearSelection, search, fold, flyTo, fit };
refreshEdges();
const start = decodeURIComponent(location.hash.slice(1));
if (start && people.has(start)) {
  const p = pos[start];
  k = 1; tx = innerWidth / 2 - p[0]; ty = innerHeight / 2 - p[1]; apply();
  select(start, { fly: true });
} else {
  const home = pos[DATA.home] || pos[DATA.people[0].id];
  k = 0.85; tx = innerWidth / 2 - home[0] * k; ty = innerHeight / 2 - home[1] * k; apply();
}
drawOverlays();
})();
