# Image manifest — deduplicated & grouped

Result of the two rules given for the source photos:

1. **No duplicate pictures.** Files sent more than once were removed.
2. **Group related pictures together.** Every image belongs to exactly one project; a
   project gallery only ever shows its own images.

Source: 5 zips (folders `111–115`) = 94 files. After dedup → **81 images** placed below,
each web-optimised (auto-oriented, long edge ≤1920px photos / ≤2000px drawings, progressive JPEG).
The site reads these via each project's `data-gallery` in `index.html`; the modal builds a
thumbnail gallery from that list.

## Projects (folder → count)

| Project | Folder | Images | In site as |
|---|---|---|---|
| Marble House | `marble-house/` | 35 (12 featured) | Works /01 · hero · studio · journal |
| Timber Villa (curved wood) | `curved-wood-villa/` | 8 | Works /02 · page hero |
| Woven Brick Apartments (built) | `apartment-tower/` | 20 | Works /03 · quote band · journal |
| Courtyard House | `courtyard-villa/` | 10 | Works /04 · journal |
| Riverfront Park (Baghshahr 937339) | `riverfront-park/` | 7 | Works /05 |
| Saba Steel Gateway (2nd prize) | `saba-steel-gateway/` | 1 | Works /06 |

`★ featured` = shown in the project gallery; the rest are kept in the folder for future use.
Drawings/boards keep the `dwg-` / `board-` / `plan-` / `elevation-` / `section-` prefixes.

## Duplicates removed
- `video2website.md` == `video2website (1).md` (identical, md5 ef09830f) — not portfolio imagery.
- `IMG_4517.PNG` == `IMG_4517 (1).PNG`; `02.jpg` == `02 (1).jpg` (byte-identical).
- `fff11.jpg` (curved-villa garden + plan inset) ≈ `fff10.jpg` — kept `garden-elevation` only.
- `112/3A.jpg` ≈ `112/3.jpg`; `111/1A.jpg` ≈ pool already kept; `113/009.jpg` (two-up montage);
  duplicate plan/board variants (`IMG_4509`, teal plan copies, `113/012`) — dropped.
- `Baghshahr-001.png` was a 320px thumbnail of `Baghshahr-003` → used the full-res one as the aerial.

## Ambiguous groupings to confirm
- **Courtyard House vs Marble House** — the `courtyard-villa` drawings (section / plans /
  elevations) and the warm dressing-room + hallway *may* be the same building as the Marble House
  renders. They're kept separate; tell me if they should merge.
- **`elevation-east` / `elevation-south`** (`nama2/nama3`) assigned to Courtyard House by style.
- **Project names, locations, years and areas** in `index.html` are my best reading and are easy
  to edit (each is a `data-*` attribute on the project `<article>`).
