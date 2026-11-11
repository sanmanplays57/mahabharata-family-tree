// Downloads sections of K. M. Ganguli's Mahabharata translation (public domain)
// from sacred-texts.com and saves each as plain text under refs/ganguli/<book>/NNN.txt.
//
// usage: node tools/fetch-ganguli.mjs <bookKey> <fromSection> <toSection>
//   bookKey is a key of BOOKS below (e.g. adi).
// Existing files are skipped, so the script can be re-run to resume.

import { mkdir, writeFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Books 16-18 number their sections 1, 2, 3 on the site instead of i, ii, iii.
const ARABIC = new Set(["mausala", "mahaprasthanika", "svargarohana"]);

const BOOKS = {
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

function roman(n) {
  const t = [[1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"],
    [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]];
  let s = "";
  for (const [v, r] of t) while (n >= v) { s += r; n -= v; }
  return s;
}

function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function extract(html) {
  const start = html.indexOf('data-slot="reader-prose"');
  if (start < 0) return null;
  let end = html.indexOf('data-slot="reader-chapter-nav-controls"', start);
  if (end < 0) end = html.length;
  let body = html.slice(html.indexOf(">", start) + 1, end);
  body = body
    .replace(/<a[^>]*>\s*p\.\s*\d+\s*<\/a>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|h\d|div|li|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  const junk = /^(Advertisement\b|Own the Wisdom|The archive, offline|Get the drive|Read ad-free|\[data-|<div|.*\{display:)/;
  return decode(body)
    .split("\n").map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l && !junk.test(l))
    .join("\n\n");
}

// Node's built-in fetch is refused (HTTP 403) by the site; curl with the same UA is not.
function curl(url) {
  const out = execFileSync("curl", ["-s", "-L", "--max-time", "60",
    "-A", "Mozilla/5.0 (genealogy-research-script)", "-w", "\n%{http_code}", url],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const cut = out.lastIndexOf("\n");
  return { status: +out.slice(cut + 1), html: out.slice(0, cut) };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const [bookKey, fromS, toS] = process.argv.slice(2);
  const slug = BOOKS[bookKey];
  if (!slug) throw new Error(`unknown book ${bookKey}; known: ${Object.keys(BOOKS).join(", ")}`);
  const outDir = join(ROOT, "refs", "ganguli", bookKey);
  await mkdir(outDir, { recursive: true });
  let misses = 0;
  for (let n = +fromS; n <= +toS; n++) {
    const file = join(outDir, String(n).padStart(3, "0") + ".txt");
    try { await access(file); continue; } catch {}
    const url = `https://sacred-texts.com/book/${slug}/section-${ARABIC.has(bookKey) ? n : roman(n)}`;
    let { status, html } = curl(url);
    // HTTP 429 = rate-limited: back off and retry the same section instead of counting a miss.
    for (let wait = 60; status === 429 && wait <= 480; wait *= 2) {
      console.log(`section ${n}: HTTP 429, waiting ${wait}s`);
      await sleep(wait * 1000);
      ({ status, html } = curl(url));
    }
    const text = status === 200 ? extract(html) : null;
    // Books 1-15 open with "SECTION N"; books 16-18 on the site open with just the number.
    if (!text || text.length < 300 || !(/SECTION/i.test(text.slice(0, 200)) || /^[0-9]+[^0-9]/.test(text))) {
      console.log(`section ${n}: not found (HTTP ${status}) ${text ? JSON.stringify(text.slice(0, 60)) + " len " + text.length : "no text"}`);
      if (++misses >= 2) break;
      continue;
    }
    misses = 0;
    const header = `[Ganguli translation, ${bookKey} parva, section ${n} (${roman(n).toUpperCase()}). Source: ${url}. Public domain.]\n\n`;
    await writeFile(file, header + text + "\n", "utf8");
    console.log(`section ${n}: ${text.length} chars`);
    await sleep(1500);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
