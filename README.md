# Adonis Co — Stone, Brick &amp; Ceramic Export Website

A complete, ready-to-host website for **Adonis Co**, exporting natural stone,
clay brick and ceramic from **Iran to Armenia**. Built as plain HTML, CSS and
JavaScript — no build step, no framework, no dependencies. Open it, host it,
edit it with any text editor.

Instagram: [@adonisco.am](https://www.instagram.com/adonisco.am)

---

## 1. What's in the box

| Page | File | What it does |
|------|------|--------------|
| Home | `index.html` | Hero, the Iran→Armenia story, the three collections, featured "data-sheet" products, the export process, a projects preview, about + contact form |
| Stone | `collection-stone.html` | Full natural-stone catalogue — Pietra Grey, travertine, Marsh White, honey &amp; green onyx — each with a spec sheet |
| Bricks | `collection-bricks.html` | Clay facing brick, glazed brick, thin slips, plus specials |
| Ceramics | `collection-ceramics.html` | Glazed wall tile, stone-look porcelain, mosaic &amp; décor |
| Projects | `projects.html` | Portfolio case studies, each with the materials used |

```
.
├── index.html
├── collection-stone.html
├── collection-bricks.html
├── collection-ceramics.html
├── projects.html
└── assets/
    ├── css/styles.css     ← all styling + design tokens (colours, fonts)
    ├── js/main.js         ← menu, scroll effects, quote form
    └── img/               ← all photography (see §3)
```

## 2. Preview it locally

Just open `index.html` in a browser, **or** run a tiny local server (better,
because the menu and links behave exactly as they will live):

```bash
# from this folder
python3 -m http.server 8000
# then open http://localhost:8000
```

## 3. Replace the photos with your own ⭐ important

The images shipped here are **placeholder visuals** that show the design
finished. **Swap them for your real product photos and project photos** — you
mentioned you have pictures and PDFs of your stones, bricks and ceramics.

Drop your file into `assets/img/` and either give it the **same name** (easiest
— nothing else to change) or update the `src="assets/img/..."` in the HTML.

| Filename | Replace with a photo of… | Best shape |
|----------|--------------------------|-----------|
| `hero.jpg` | Your best wide "wow" shot (a slab wall, your yard) | very wide (21:9) |
| `cat-stone.jpg` / `cat-brick.jpg` / `cat-ceramic.jpg` | Each category, in your showroom/yard | landscape (3:2) |
| `stone-pietra-grey.jpg`, `stone-travertine.jpg`, `stone-onyx.jpg`, `stone-white.jpg`, `stone-green-onyx.jpg` | Each stone, close-up swatch | portrait (4:5) |
| `brick-facing.jpg`, `brick-glazed.jpg` | Each brick type, close-up | square |
| `ceramic-glazed.jpg`, `ceramic-porcelain.jpg`, `ceramic-mosaic.jpg` | Each tile, close-up | square / portrait |
| `project-lobby.jpg`, `project-travertine.jpg`, `project-kitchen.jpg`, `project-brick.jpg`, `project-onyx.jpg` | Your completed projects | landscape (3:2) |

**Keep file sizes small** (these are ~150–400 KB each). Before adding a big
photo from a phone, shrink it to ~1600 px wide and save as JPEG ~80% quality so
the site stays fast.

## 4. Edit the words and the contact details

All text lives directly in the HTML — search for the phrase you want to change.
A few **placeholders you must update before going live** (all on `index.html`,
in the `#contact` section, and repeated in the footer):

- **Phone / WhatsApp** — currently `+374 00 000 000` / `+98 000 000 0000`
- **Address** — currently "Yerevan, Armenia *(address — to add)*"
- **Email** — currently `info@adonisco.am` and `sales@adonisco.am`
- **Project copy** on `projects.html` — replace with your real jobs (there's a
  note in the file marking exactly where).

Brand colours and fonts are defined once at the top of `assets/css/styles.css`
under `:root` — change them there and the whole site follows.

## 5. Make the quote form actually send email

Right now the **Request a quote** form opens the visitor's email app with the
details filled in (works everywhere, needs no server). To receive submissions
straight to your inbox without that step, use a free form service:

1. Sign up at [Web3Forms](https://web3forms.com) (free) or
   [Formspree](https://formspree.io) and get your endpoint URL / access key.
2. In `index.html`, find `<form ... data-quote-form ...>` and change it to:
   ```html
   <form action="https://api.web3forms.com/submit" method="POST">
     <input type="hidden" name="access_key" value="YOUR-KEY-HERE">
     <!-- keep the existing fields -->
   </form>
   ```
3. Remove the `data-quote-form` attribute so the email-app fallback turns off.

## 6. Put it online (free options)

**GitHub Pages** — Settings → Pages → Build from branch → pick this branch,
folder `/ (root)`. Your site appears at `https://<user>.github.io/<repo>/`.

**Netlify / Vercel** — drag this folder onto [Netlify Drop](https://app.netlify.com/drop),
or "Import" the repo on [Vercel](https://vercel.com). Both are free and give you
a custom-domain option (e.g. point `adonisco.am` at it).

## 7. Your Instagram, tied in

The site links to [@adonisco.am](https://www.instagram.com/adonisco.am)
from the footer, contact section and social icons. To make the Instagram pull
its weight alongside the site:

- **Bio:** say what + where in one line, e.g.
  *"Persian stone · brick · ceramic → Armenia 🇦🇲 | Quarry-direct to Yerevan |
  Quote ⬇️"* and put your site link in the website field.
- **Highlights:** one cover each for **Stone**, **Brick**, **Ceramic**,
  **Projects**, **Delivery** — mirroring the site so visitors recognise it.
- **Grid:** post in sets of three (a swatch, a detail, the material in a
  finished room) so the profile reads as organised as the catalogue.
- **Every caption** ends with a call to action and the site link.
- Use the same photos on both, so the brand looks consistent.

---

*Design note: type is Fraunces (display), Manrope (body) and Space Mono (the
spec sheets); the accent amber is the colour shared by Persian saffron and the
Armenian apricot, and the teal comes from Persian–Armenian tile glaze. Imagery
in this starter set is generated placeholder photography — replace it with your
own before launch.*
