// Build: data/*.yaml  ->  validated graph  ->  Graphviz layout  ->  mahabharata.html
//
// Layout rules (see CLAUDE.md for the reasoning):
//  * Only lineage links position people: birth mother/father, legal father, adoptive parents.
//  * Each child hangs from a small "family dot" joined to its primary parents
//    (mother + legal father if any, else birth father). Spouses share a dot even if childless.
//  * A biological father who is not the legal one (Vyasa) gets a direct edge to the child.
//  * Divine fathers, incarnations and "returned to" links are NOT given to Graphviz;
//    the viewer draws them as overlay arrows, so 40-generation jumps don't wreck the layout.

import { readFile, writeFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as yaml from "js-yaml";
import { Graphviz } from "@hpcc-js/wasm-graphviz";
import { toDevanagari } from "./iast.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const PARENT_RELS = new Set([
  "mother", "father", "legal-father", "divine-father", "divine-mother",
  "adoptive-father", "adoptive-mother",
]);
const INCARNATION_KINDS = new Set(["avatar", "portion", "rebirth"]);
const KINDS = new Set(["human", "god", "rishi", "asura", "rakshasa", "naga", "apsara",
  "gandharva", "yaksha", "animal", "group", "other"]);

const NODE_H = 30;
const charW = (s) => [...s].reduce((w, c) => w + (/[A-Z]/.test(c) ? 8.6 : /[ il.'’]/.test(c) ? 4 : 7.1), 0);
const nodeWidth = (name) => Math.max(44, Math.round(charW(name) + 22));

async function loadPeople() {
  const dir = join(ROOT, "data");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".yaml")).sort();
  const people = [];
  for (const f of files) {
    const docs = yaml.load(await readFile(join(dir, f), "utf8")) || [];
    for (const p of docs) people.push({ ...p, _file: f });
  }
  return people;
}

function validate(people) {
  const errors = [];
  const warn = [];
  const byId = new Map();
  for (const p of people) {
    if (!p.id || !/^[a-z0-9-]+$/.test(p.id)) errors.push(`${p._file}: bad id ${JSON.stringify(p.id)}`);
    if (byId.has(p.id)) errors.push(`duplicate id ${p.id} (${byId.get(p.id)._file}, ${p._file})`);
    byId.set(p.id, p);
    if (!p.name) errors.push(`${p.id}: missing name`);
    if (!KINDS.has(p.kind)) errors.push(`${p.id}: unknown kind ${p.kind}`);
    if (!p.summary) warn.push(`${p.id}: no summary`);
  }
  const ref = (from, id, what) => {
    if (!byId.has(id)) errors.push(`${from}: ${what} refers to unknown id "${id}"`);
  };
  let links = 0, uncited = 0;
  const cited = (l) => { links++; if (!l.cite) uncited++; };
  // Unknown keys usually mean a YAML slip, e.g. an unquoted "cite: adi 63, 95" inside { }
  // which parses as cite "adi 63" plus a stray key "95".
  const PERSON_KEYS = new Set(["id", "name", "aka", "sex", "kind", "house", "title", "summary", "wiki", "pe",
    "birth", "parents", "spouses", "incarnation", "returned", "ver", "notes", "members", "membersCite", "cite", "_file"]);
  const LINK_KEYS = {
    parents: new Set(["id", "rel", "cite", "note", "ver", "far"]),
    spouses: new Set(["id", "cite", "note", "ver"]),
    incarnation: new Set(["of", "kind", "cite", "note", "ver"]),
    returned: new Set(["to", "cite", "note", "ver"]),
  };
  for (const p of people) {
    for (const k of Object.keys(p)) if (!PERSON_KEYS.has(k)) errors.push(`${p.id}: unknown field "${k}"`);
    for (const [field, keys] of Object.entries(LINK_KEYS))
      for (const l of p[field] || [])
        for (const k of Object.keys(l)) if (!keys.has(k)) errors.push(`${p.id}: ${field} entry has unknown key "${k}" (unquoted comma?)`);
    for (const l of p.parents || []) {
      ref(p.id, l.id, "parent");
      if (!PARENT_RELS.has(l.rel)) errors.push(`${p.id}: unknown parent rel ${l.rel}`);
      cited(l);
    }
    for (const l of p.spouses || []) { ref(p.id, l.id, "spouse"); cited(l); }
    for (const l of p.incarnation || []) {
      ref(p.id, l.of, "incarnation");
      if (!INCARNATION_KINDS.has(l.kind)) errors.push(`${p.id}: unknown incarnation kind ${l.kind}`);
      cited(l);
    }
    for (const l of p.returned || []) { ref(p.id, l.to, "returned"); cited(l); }
  }
  return { byId, errors, warn, links, uncited };
}

function buildGraph(people, byId) {
  const families = new Map();
  const famOf = (ids) => {
    const key = [...new Set(ids)].sort().join("+");
    if (!families.has(key)) families.set(key, { id: "f" + families.size, parents: key.split("+"), children: [] });
    return families.get(key);
  };
  const lineage = [];
  const overlays = [];
  const sameRank = [];

  const spousePairs = new Set();
  for (const p of people) {
    for (const s of p.spouses || []) {
      const key = [p.id, s.id].sort().join("+");
      if (spousePairs.has(key)) continue;
      spousePairs.add(key);
      famOf([p.id, s.id]);
      sameRank.push([p.id, s.id]);
    }
  }

  for (const p of people) {
    const all = p.parents || [];
    // "far" links (an ordinary parent dozens of generations away, e.g. Surya -> Tapati)
    // would drag the whole layout; draw them as overlays instead.
    for (const l of all) if (l.far) overlays.push({ from: l.id, to: p.id, type: "far", cite: l.cite || null });
    const ps = all.filter((l) => !l.far);
    const get = (rel) => ps.filter((l) => l.rel === rel).map((l) => l.id);
    const mothers = get("mother");
    const legal = get("legal-father");
    const bio = get("father");
    const primary = [...mothers, ...(legal.length ? legal : bio)];
    if (primary.length) famOf(primary).children.push({ id: p.id, type: "birth" });
    if (legal.length) for (const b of bio) lineage.push({ from: b, to: p.id, type: "bio" });
    const adoptive = [...get("adoptive-father"), ...get("adoptive-mother")];
    if (adoptive.length) famOf(adoptive).children.push({ id: p.id, type: "adoptive" });
    for (const l of ps) {
      if (l.rel === "divine-father" || l.rel === "divine-mother")
        overlays.push({ from: l.id, to: p.id, type: "divine", cite: l.cite || null });
    }
    for (const l of p.incarnation || [])
      overlays.push({ from: l.of, to: p.id, type: "incarnation", kind: l.kind, cite: l.cite || null });
    for (const l of p.returned || [])
      overlays.push({ from: p.id, to: l.to, type: "returned", cite: l.cite || null });
  }

  // How each parent is drawn into a family dot: legal fathers dashed, adoptive dotted.
  const relOf = new Map();
  for (const p of people) for (const l of p.parents || []) relOf.set(l.id + ">" + p.id, l.rel);
  for (const f of families.values()) {
    f.parentRel = {};
    for (const par of f.parents) {
      const rels = f.children.map((c) => relOf.get(par + ">" + c.id)).filter(Boolean);
      f.parentRel[par] = rels.includes("legal-father") ? "legal"
        : rels.some((r) => r.startsWith("adoptive")) ? "adoptive"
        : f.children.length ? "birth" : "spouse";
    }
  }
  return { families, lineage, overlays, sameRank };
}

function toDot(people, g) {
  const q = (s) => JSON.stringify(s);
  const lines = [
    "digraph G {",
    "graph [rankdir=TB, nodesep=0.16, ranksep=0.30, splines=spline, newrank=true, mclimit=4, remincross=true];",
    "node [shape=box, fixedsize=true, label=\"\", height=" + (NODE_H / 72).toFixed(3) + "];",
    "edge [arrowhead=none];",
  ];
  for (const p of people) lines.push(`${q(p.id)} [width=${(nodeWidth(p.name) / 72).toFixed(3)}];`);
  g.directType = new Map();
  for (const f of g.families.values()) {
    if (f.parents.length === 1) {
      // One known parent: no family dot, just a line straight to each child
      // (minlen=2 keeps the same generation spacing as parent -> dot -> child).
      const par = f.parents[0];
      for (const c of f.children) {
        lines.push(`${q(par)} -> ${q(c.id)} [minlen=2, weight=${c.type === "birth" ? 3 : 1}];`);
        g.directType.set(par + ">" + c.id, f.parentRel[par] === "legal" ? "legal" : c.type);
      }
      continue;
    }
    lines.push(`${q(f.id)} [shape=point, width=0.07, height=0.07];`);
    for (const par of f.parents) lines.push(`${q(par)} -> ${q(f.id)} [weight=3];`);
    for (const c of f.children)
      lines.push(`${q(f.id)} -> ${q(c.id)} [weight=${c.type === "birth" ? 3 : 1}];`);
  }
  for (const e of g.lineage) lines.push(`${q(e.from)} -> ${q(e.to)} [minlen=2, weight=1];`);
  for (const [a, b] of g.sameRank) lines.push(`{rank=same; ${q(a)}; ${q(b)};}`);
  lines.push("}");
  return lines.join("\n");
}

function parseSpline(pos, H) {
  const pts = [];
  for (const tok of pos.split(" ")) {
    if (tok.startsWith("e,") || tok.startsWith("s,")) continue;
    const [x, y] = tok.split(",").map(Number);
    pts.push([x, H - y]);
  }
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i + 2 < pts.length; i += 3)
    d += `C${pts[i].map((v) => v.toFixed(1))} ${pts[i + 1].map((v) => v.toFixed(1))} ${pts[i + 2].map((v) => v.toFixed(1))}`;
  return d;
}

// Background verses: each line must appear verbatim in the GRETIL Critical Edition text
// under its verse id (as the a- or c-half), so the Devanagari is always derived from the source.
async function loadVerses() {
  const verses = yaml.load(await readFile(join(ROOT, "src", "verses.yaml"), "utf8"));
  const ce = await readFile(join(ROOT, "refs", "gretil", "mbh", "MBH1-18U.HTM"), "utf8").catch(() => null);
  for (const v of verses)
    for (const l of v.lines)
      if (ce && !ce.includes(`${v.ce}a\t${l}`) && !ce.includes(`${v.ce}c\t${l}`))
        throw new Error(`verse ${v.ce}: line not found verbatim in GRETIL: ${l}`);

  // Lay out one repeating tile: a grid of cells, verses in a fixed pseudo-random order
  // (so Gita and epic verses mix), each jittered inside its cell without leaving it.
  // Width estimate: ~10px of Devanagari at 30px per IAST character, measured on the page.
  const hash = (s, salt) => {
    let h = 2166136261 ^ salt;
    for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
    return ((h >>> 0) % 10000) / 10000;
  };
  const COLS = 4, CW = 860, CH = 240;
  const order = [...verses].sort((a, b) => hash(a.ce, 1) - hash(b.ce, 1));
  const placed = order.map((v, i) => {
    const col = i % COLS, row = Math.floor(i / COLS);
    const w = Math.max(...v.lines.map((l) => l.length)) * 10 + 40;
    const slack = Math.max(0, CW - w - 40);
    return {
      ref: v.ref, ce: v.ce, lines: v.lines.map(toDevanagari),
      x: Math.round(col * CW + 20 + hash(v.ce, 2) * slack),
      y: Math.round(row * CH + 70 + hash(v.ce, 3) * 60),
    };
  });
  return { tile: [COLS * CW, Math.ceil(order.length / COLS) * CH + 40], items: placed };
}

async function main() {
  const people = await loadPeople();
  const verses = await loadVerses();
  const { byId, errors, warn, links, uncited } = validate(people);
  if (errors.length) {
    console.error("DATA ERRORS:\n  " + errors.join("\n  "));
    process.exit(1);
  }
  const g = buildGraph(people, byId);
  const dot = toDot(people, g);
  await writeFile(join(ROOT, "build", "graph.dot"), dot, "utf8").catch(async () => {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(join(ROOT, "build"), { recursive: true });
    await writeFile(join(ROOT, "build", "graph.dot"), dot, "utf8");
  });

  const gv = await Graphviz.load();
  const t0 = Date.now();
  const lay = JSON.parse(gv.layout(dot, "json0", "dot"));
  const [, , W, H] = lay.bb.split(",").map(Number);
  const pos = {};
  for (const o of lay.objects || []) {
    if (!o.pos) continue;
    const [x, y] = o.pos.split(",").map(Number);
    pos[o.name] = [Math.round(x * 10) / 10, Math.round((H - y) * 10) / 10];
  }
  const objName = (i) => lay.objects[i].name;
  const famById = new Map([...g.families.values()].map((f) => [f.id, f]));
  const edges = [];
  for (const e of lay.edges || []) {
    const from = objName(e.tail), to = objName(e.head);
    let type;
    if (famById.has(to)) type = famById.get(to).parentRel[from];
    else if (famById.has(from)) type = famById.get(from).children.find((c) => c.id === to).type;
    else type = g.directType.get(from + ">" + to) || "bio";
    edges.push({ from, to, type, d: parseSpline(e.pos, H) });
  }

  const outPeople = people.map(({ _file, ...p }) => ({ ...p, w: nodeWidth(p.name) }));
  const data = {
    built: new Date().toISOString().slice(0, 10),
    home: "pandu",
    size: [Math.ceil(W), Math.ceil(H)],
    nodeH: NODE_H,
    people: outPeople,
    pos,
    families: [...g.families.values()].map((f) => ({ id: f.id, parents: f.parents, children: f.children })),
    edges,
    overlays: g.overlays,
    verses,
  };

  const [tpl, css, js] = await Promise.all([
    readFile(join(ROOT, "src", "viewer.html"), "utf8"),
    readFile(join(ROOT, "src", "viewer.css"), "utf8"),
    readFile(join(ROOT, "src", "viewer.js"), "utf8"),
  ]);
  const html = tpl
    .replace("/*CSS*/", () => css)
    .replace("/*DATA*/", () => "const DATA = " + JSON.stringify(data).replace(/</g, "\\u003c") + ";")
    .replace("/*JS*/", () => js);
  await writeFile(join(ROOT, "mahabharata.html"), html, "utf8");

  // GitHub Pages serves docs/index.html.
  const { mkdir } = await import("node:fs/promises");
  await mkdir(join(ROOT, "docs"), { recursive: true });
  await writeFile(join(ROOT, "docs", "index.html"), html, "utf8");

  // Artifact (claude.ai) variant: the publish step adds its own <html>/<head>/<body>
  // skeleton with charset and viewport, so ship only title, styles, markup and script.
  // (DATA escapes "<", so these tag searches cannot hit the embedded JSON.)
  const head = html.slice(html.indexOf("<head>") + 6, html.indexOf("</head>"))
    .replace(/<meta charset[^>]*>\s*/, "").replace(/<meta name="viewport"[^>]*>\s*/, "");
  const body = html.slice(html.indexOf("<body>") + 6, html.lastIndexOf("</body>"));
  await writeFile(join(ROOT, "build", "artifact.html"), head.trim() + "\n" + body.trim() + "\n", "utf8");

  console.log(`people: ${people.length}, families: ${g.families.size}, layout edges: ${edges.length}, overlay links: ${g.overlays.length}`);
  console.log(`links: ${links}, without citation: ${uncited}`);
  console.log(`layout ${Date.now() - t0} ms, canvas ${Math.round(W)} x ${Math.round(H)} pt`);
  if (warn.length) console.log("warnings:\n  " + warn.join("\n  "));
  console.log("wrote mahabharata.html");
}

main().catch((e) => { console.error(e); process.exit(1); });
