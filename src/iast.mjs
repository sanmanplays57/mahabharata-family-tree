// IAST -> Devanagari, for verses copied verbatim from the GRETIL Critical Edition text.
// Consonant-final words are joined to the next word (sandhi spelling), as in printed editions:
// "glānir bhavati" -> ग्लानिर्भवति, "sṛjāmy aham" -> सृजाम्यहम्. A space before an avagraha is dropped.

const VOW = { a: "अ", "ā": "आ", i: "इ", "ī": "ई", u: "उ", "ū": "ऊ", "ṛ": "ऋ", "ṝ": "ॠ", "ḷ": "ऌ", e: "ए", ai: "ऐ", o: "ओ", au: "औ" };
const MATRA = { a: "", "ā": "ा", i: "ि", "ī": "ी", u: "ु", "ū": "ू", "ṛ": "ृ", "ṝ": "ॄ", "ḷ": "ॢ", e: "े", ai: "ै", o: "ो", au: "ौ" };
const CONS = {
  k: "क", kh: "ख", g: "ग", gh: "घ", "ṅ": "ङ", c: "च", ch: "छ", j: "ज", jh: "झ", "ñ": "ञ",
  "ṭ": "ट", "ṭh": "ठ", "ḍ": "ड", "ḍh": "ढ", "ṇ": "ण", t: "त", th: "थ", d: "द", dh: "ध", n: "न",
  p: "प", ph: "फ", b: "ब", bh: "भ", m: "म", y: "य", r: "र", l: "ल", v: "व", "ś": "श", "ṣ": "ष", s: "स", h: "ह",
};
const VIRAMA = "्";

function tokens(s) {
  const out = [];
  for (let i = 0; i < s.length;) {
    const two = s.slice(i, i + 2);
    if (two.length === 2 && (CONS[two] || VOW[two])) { out.push(two); i += 2; continue; }
    out.push(s[i]); i += 1;
  }
  return out;
}

export function toDevanagari(iast) {
  // The enclitics cana / cit are written as separate words in GRETIL but joined in print (kadācana, kvacit).
  const src = iast.normalize("NFC").toLowerCase().replace(/;\s*/g, " ").replace(/\s+'/g, "'")
    .replace(/ (cana|cit)\b/g, "$1").trim();
  let out = "", pending = false;
  for (const t of tokens(src)) {
    if (CONS[t]) { out += (pending ? VIRAMA : "") + CONS[t]; pending = true; }
    else if (VOW[t]) { out += pending ? MATRA[t] : VOW[t]; pending = false; }
    else if (t === "ṃ") { out += "ं"; pending = false; }
    else if (t === "ḥ") { out += "ः"; pending = false; }
    else if (t === "'") { out += "ऽ"; pending = false; }
    else if (t === " ") { if (!pending) out += " "; }
    else throw new Error(`unexpected character "${t}" in: ${iast}`);
  }
  return out + (pending ? VIRAMA : "");
}
