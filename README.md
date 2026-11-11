# Mahabharata Family Tree

A searchable, zoomable family tree of the Mahabharata.

**Open it:** https://sanmanplays57.github.io/mahabharata-family-tree/

- **Search** with Ctrl+F. Spelling variants and epithets work: Partha, Gangeya, Yudhisthir.
- **Click a person** for a summary, their relationships, and the passage each
  link comes from. Double-click opens their Wikipedia article.
- **Parents are typed:** birth, legal (niyoga), adoptive, and divine fathers are
  kept apart, so Pandu, Indra and Kunti each show up as what they are to Arjuna.
- **Incarnations, previous births** and "rejoined after death" links are drawn as
  arrows. Turn each line type on or off in the Legend.
- **Every link cites its source:** K. M. Ganguli's translation (linked to
  sacred-texts.com), the Sanskrit Critical Edition (GRETIL), or Vettam Mani's
  *Puranic Encyclopaedia*.
  - Links that come only from the Puranas or later tradition are tagged as such.
  - Where the texts contradict each other, both versions are kept.

## Build

```
npm install
node src/build.mjs        # data/*.yaml -> docs/index.html (and mahabharata.html)
node tools/test-page.mjs  # headless check with Microsoft Edge
```

The people and links live in `data/*.yaml`. The layout is computed with Graphviz,
compiled to WebAssembly.
