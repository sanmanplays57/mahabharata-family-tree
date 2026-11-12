// Small helpers for editing data/*.yaml as text, so comments and layout survive.
//   const E = require("../tools/lib-edit.cjs");
//   E.addParent("matinara", `{ id: anadhrishti, rel: father, cite: adi 94, far: true }`);
//   E.addSpouse(id, link)   E.alias(id, ["Name"])   E.note(id, "text")   E.append(file, yamlText)
//   E.save()  -> writes every file touched
const fs = require("fs");
const path = require("path");
const DIR = path.join(__dirname, "..", "data");
const files = new Map();
const load = (f) => { if (!files.has(f)) files.set(f, fs.readFileSync(path.join(DIR, f), "utf8")); return files.get(f); };
function locate(id) {
  for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".yaml")).sort()) {
    const s = load(f), a = s.indexOf(`\n- id: ${id}\n`);
    if (a < 0) continue;
    const ends = [s.indexOf("\n- id: ", a + 5), s.indexOf("\n# ", a + 5)].filter((x) => x > 0);
    return { f, a: a + 1, b: ends.length ? Math.min(...ends) : s.length };
  }
  throw new Error("no person " + id);
}
function edit(id, fn) {
  const { f, a, b } = locate(id), s = files.get(f);
  files.set(f, s.slice(0, a) + fn(s.slice(a, b)) + s.slice(b));
}
const addTo = (key) => (id, link) => edit(id, (t) => {
  const m = t.match(new RegExp(`\\n  ${key}:\\n((?:    - .*\\n)+)`));
  if (m) { const at = t.indexOf(m[0]) + m[0].length; return t.slice(0, at) + `    - ${link}\n` + t.slice(at); }
  if (new RegExp(`\\n  ${key}: \\[`).test(t)) throw new Error(`${id}: inline ${key} list, edit by hand`);
  return t.replace(/\n*$/, "") + `\n  ${key}:\n    - ${link}\n` + (t.endsWith("\n\n") ? "\n" : "");
});
module.exports = {
  addParent: addTo("parents"),
  addSpouse: addTo("spouses"),
  addIncarnation: addTo("incarnation"),
  alias(id, names) {
    edit(id, (t) => {
      const m = t.match(/\n  aka: \[(.*)\]/);
      if (m) {
        const have = m[1].split(/,\s*/), add = names.filter((n) => !have.includes(n));
        return add.length ? t.replace(m[0], `\n  aka: [${[...have, ...add].join(", ")}]`) : t;
      }
      return t.replace(/(\n  name: .*)/, `$1\n  aka: [${names.join(", ")}]`);
    });
  },
  note(id, text) {
    edit(id, (t) => {
      const m = t.match(/\n  notes: (".*")/);
      if (m) return t.replace(m[0], `\n  notes: ${JSON.stringify(JSON.parse(m[1]) + " " + text)}`);
      return t.replace(/(\n  summary: .*)/, `$1\n  notes: ${JSON.stringify(text)}`);
    });
  },
  append(file, text) { files.set(file, load(file).replace(/\n*$/, "\n") + text); },
  save() { for (const [f, s] of files) fs.writeFileSync(path.join(DIR, f), s); console.log("saved", [...files.keys()].join(", ")); },
};
