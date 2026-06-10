# Atelier March — Architecture Portfolio

A stunning, fast, single-page portfolio website for an architect. Built with pure
HTML, CSS and JavaScript — **no frameworks, no build step, no dependencies**.
Open it anywhere, host it anywhere.

## ✨ Features

- **Cinematic hero** — full-screen photography, staggered title animation, subtle parallax
- **Filterable project gallery** — Residential / Cultural / Commercial / Interior, with an editorial offset grid
- **Project lightbox** — click any work to open a detail panel with photo, story and facts (location, year, area, scope)
- **Scroll storytelling** — reveal-on-scroll animations, animated stat counters, scrolling marquee
- **Custom cursor** — grows over links, shows "View project" over work (desktop only)
- **Preloader** — studio name + loading counter intro
- **Fully responsive** — full-screen mobile menu, adaptive grids
- **Accessible** — keyboard-navigable gallery and modal (Enter / Esc), `prefers-reduced-motion` support, semantic HTML

## 🚀 View it

Just open `index.html` in a browser, or serve it locally:

```bash
npx serve .
# or
python3 -m http.server 8000
```

### Deploy free with GitHub Pages

Repo → **Settings → Pages** → Source: *Deploy from a branch* → pick your branch, folder `/ (root)` → Save.
Your portfolio goes live at `https://<username>.github.io/<repo>/`.

## 🎨 Make it yours

| What | Where |
| --- | --- |
| Architect / studio name | Search & replace `Atelier March` and `Alina March` in `index.html` |
| Projects (title, photos, story, facts) | The `<article class="project">` blocks in `index.html` — each card's `data-*` attributes feed the lightbox |
| Photos | Swap the Unsplash `src` URLs for your own images (keep `loading="lazy"`) |
| Colors | CSS variables at the top of `css/style.css` (`--bg`, `--ink`, `--accent`, …) |
| Fonts | The Google Fonts `<link>` in `index.html` + `--font-display` / `--font-text` in the CSS |
| Contact details | The `#contact` section and footer in `index.html` |
| Stats | `data-count` attributes in the Studio section |

## 📁 Structure

```
├── index.html      # All content & sections
├── css/style.css   # Design system & layout
└── js/main.js      # Interactions (zero dependencies)
```

Placeholder photography via [Unsplash](https://unsplash.com). Replace with your own project photography before going live.
