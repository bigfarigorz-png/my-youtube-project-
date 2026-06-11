# Bahareh Hajizadeh — Architecture & Interior Design Portfolio

A premium dark portfolio website for architect & interior designer **Bahareh Hajizadeh**,
working between **Yerevan, Tehran and Mashhad**. Inspired by high-end studio sites
(structure & feel sampled from borisstudio.ua) — built with pure HTML, CSS and
JavaScript: **no frameworks, no build step, no dependencies**.

## ✨ Features

- **Premium dark design** — near-black canvas, warm ivory type, champagne-gold accents
- **Cinematic hero** — full-screen photography, staggered name animation, subtle parallax
- **Filterable project gallery** — Residential / Interior / Cultural / Commercial, editorial offset grid
- **Project lightbox** — click any work for photo, story and facts (location, year, area, scope)
- **Services + 5-step Process** — the business skeleton: what's offered and how it runs
- **Client testimonials slider** — auto-advancing, wraps around, pauses on hover
- **Scroll storytelling** — reveal-on-scroll, animated stat counters, scrolling marquee
- **Working contact form** — delivers to your inbox via FormSubmit (no backend)
- **Custom cursor, preloader, full-screen mobile menu**
- **Accessible & responsive** — keyboard navigation (Enter/Esc), `prefers-reduced-motion`, semantic HTML

## 🌍 Live site

**https://bigfarigorz-png.github.io/my-youtube-project-/**

Deployment is automatic: every push to `main` (or the current working branch) runs
`.github/workflows/deploy.yml`, which publishes the site to GitHub Pages.

> **One-time prerequisite:** GitHub Pages on a free plan requires a **public**
> repository. Make the repo public via **Settings → General → Danger Zone →
> Change visibility**, then re-run the failed *"Deploy portfolio to GitHub Pages"*
> workflow from the **Actions** tab (or just push any commit). After that, every
> push deploys automatically.

### Run locally

Just open `index.html` in a browser, or serve it:

```bash
npx serve .
# or
python3 -m http.server 8000
```

## ✉️ Contact form

The form posts to [FormSubmit](https://formsubmit.co) (free, no signup, no backend)
and delivers messages to the email in the form's `action` attribute
(`bigfarigorz@gmail.com`). **One-time activation:** the first submission sends an
activation link to that inbox — click it once and the form is live. After activating,
FormSubmit gives you a random alias string you can swap into the `action` URL so your
raw email isn't exposed in the page source.

## 🎨 Make it yours

| What | Where |
| --- | --- |
| Name / brand | Search & replace `Bahareh Hajizadeh` in `index.html` |
| Projects (title, photos, story, facts) | The `<article class="project">` blocks in `index.html` — each card's `data-*` attributes feed the lightbox |
| Photos | Swap the Unsplash `src` URLs for your own images (keep `loading="lazy"`) |
| Cities / locations | Hero top bar, mobile menu footer, `#contact` city cards, footer |
| Colors | CSS variables at the top of `css/style.css` (`--bg`, `--ink`, `--accent`, …) |
| Fonts | The Google Fonts `<link>` in `index.html` + `--font-display` / `--font-text` in the CSS |
| Contact email (mailto + form) | Replace `bigfarigorz@gmail.com` in `index.html` (3 places) |
| Stats | `data-count` attributes in the Studio section |
| Testimonials | The `.testi__slide` blocks in `index.html` |
| Services & process steps | The `#services` and `#process` sections in `index.html` |

## 📁 Structure

```
├── index.html                    # All content & sections
├── css/style.css                 # Dark design system & layout
├── js/main.js                    # Interactions (zero dependencies)
└── .github/workflows/deploy.yml  # Auto-deploy to GitHub Pages
```

Placeholder photography via [Unsplash](https://unsplash.com); project stories, stats,
awards and testimonials are **sample content** — replace them with your real work
before going live.
