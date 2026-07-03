# Keeping the Adonis Co site secure

This site is **static** — plain HTML, CSS and images. There is no database, no
login page and no server-side code running for visitors to attack. That already
removes the most common ways a website gets hacked.

What is left to protect is **the place the site is published from** (your GitHub
account and, later, your domain). If someone got into those, they could change
the site. Here is how to make sure only you can.

## What is already done in the code

- **Content-Security-Policy** on every page: the browser will only run scripts
  and load images/fonts from this site and Google Fonts. Injected or third-party
  scripts are blocked — this is the main defence against site defacement and
  cross-site scripting (XSS).
- **No inline scripts and no secrets** anywhere in the code (nothing to steal).
- **Security headers** (`_headers` and `netlify.toml`): clickjacking protection
  (`X-Frame-Options: DENY`), MIME-sniffing off, a strict referrer policy, a
  locked-down permissions policy, and HTTPS-only (HSTS). These apply when the
  site is hosted on **Netlify** or **Cloudflare Pages**. GitHub Pages does not
  let a site set its own headers, so the in-page CSP is the protection there —
  if you want the full set, host on Netlify or put Cloudflare in front.

## What only you can do (please do these)

1. **Turn on two-factor authentication (2FA) on GitHub.** This is the single
   most important step. GitHub → Settings → Password and authentication. Use an
   authenticator app, and save the recovery codes somewhere safe.
2. **Turn on 2FA on the email** that your GitHub account uses. Whoever controls
   the email can reset the GitHub password.
3. **Use a long, unique password** for GitHub (a password manager is ideal).
   Never reuse it anywhere else.
4. **Protect the branch.** GitHub → repo → Settings → Branches → add a rule for
   your main branch so changes need a pull request and nobody can force-push.
5. **Keep collaborators to a minimum.** Settings → Collaborators. Only add people
   you trust; remove them when they no longer need access.
6. **Review access tokens and deploy keys** now and then (Settings →
   Developer settings → Personal access tokens). Delete anything you do not
   recognise.
7. **When you buy a domain**, turn on 2FA at the registrar and enable
   *registrar lock* / *transfer lock* so the domain can't be moved without you.
8. **If you ever add a contact form** with a real backend, use a reputable
   service (Formspree, Web3Forms) and turn on their spam protection — don't
   build your own mail server.

## If something looks wrong

- Unexpected change to the live site, or a login alert you didn't make:
  change your GitHub and email passwords immediately, then check
  Settings → Sessions and Settings → Security log on GitHub.

Do these and, in practical terms, only you can change this site.
